import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { db } from "./db";
import { sql, and, eq, ne, desc, asc, inArray } from "drizzle-orm";
import { articles, authors, categories, tags, articleTags, issues, issueContributors } from "@shared/schema";
import { ObjectStorageService, ObjectNotFoundError, objectStorageClient } from "./objectStorage";
import { insertArticleSchema, insertCategorySchema, insertTagSchema, insertAuthorSchema, insertMediaSchema, insertSubscriberSchema } from "@shared/schema";
import { z } from "zod";
import multer from "multer";
import { DOMParser } from "@xmldom/xmldom";
import { processImage, getPublicUrl } from "./imageProcessor";
import { r2Client, uploadToR2, getR2PublicUrl, getR2UrlPattern, getR2ImagePattern, extractR2Key, isR2Url, R2_PUBLIC_URL } from "./r2Client";
import { gateMutations, adminLoginHandler, adminLogoutHandler, adminMeHandler } from "./adminAuth";
import {
  archiveAvailable,
  listPackagedIssues,
  listIssueImages,
  listLayoutsForIssue,
  syncIssueImagesToR2,
  buildGalleryHtml,
  publicUrlForIssueImage,
} from "./featureImport";
import { getSitemapData, renderSitemapXml, renderRobotsTxt } from "./sitemap";
import { ListObjectsV2Command, DeleteObjectsCommand, HeadObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";

const upload = multer({ storage: multer.memoryStorage() });

export async function registerRoutes(app: Express): Promise<Server> {
  // Admin auth — gate mutations BEFORE any routes are registered so every
  // POST/PUT/PATCH/DELETE under /api/ is checked (except the public whitelist
  // inside gateMutations).
  app.use(gateMutations);
  app.post("/api/admin/login", adminLoginHandler);
  app.post("/api/admin/logout", adminLogoutHandler);
  app.get("/api/admin/me", adminMeHandler);

  // API Routes

  // Articles
  app.get("/api/articles", async (req, res) => {
    try {
      const {
        status = 'published',
        categoryId,
        authorId,
        search,
        year,
        page = 1,
        limit = 10,
        orderBy = 'publishedAt',
        orderDir = 'desc',
        contentType,
      } = req.query;

      const offset = (Number(page) - 1) * Number(limit);

      // When a category is given, include articles from all descendant
      // categories so e.g. /category/fashion rolls up Fashion Shoots and
      // Style Stalker too.
      let categoryIds: string[] | undefined;
      if (categoryId) {
        const tree = await db.execute(sql`
          WITH RECURSIVE descendants AS (
            SELECT id FROM categories WHERE id = ${categoryId}
            UNION ALL
            SELECT c.id FROM categories c
            INNER JOIN descendants d ON c.parent_id = d.id
          )
          SELECT id FROM descendants
        `);
        categoryIds = (tree.rows as { id: string }[]).map(r => r.id);
      }

      const result = await storage.getArticles({
        status: status as string,
        categoryIds,
        authorId: authorId as string,
        search: search as string,
        year: year as string,
        withImage: req.query.withImage === 'true' ? true : undefined,
        limit: Number(limit),
        offset,
        orderBy: orderBy as 'publishedAt' | 'createdAt' | 'views' | 'title',
        orderDir: orderDir as 'asc' | 'desc',
        contentType: contentType as string | undefined,
      });

      res.json({
        articles: result.articles,
        pagination: {
          total: result.total,
          page: Number(page),
          limit: Number(limit),
          totalPages: Math.ceil(result.total / Number(limit)),
        },
      });
    } catch (error) {
      console.error("Error fetching articles:", error);
      res.status(500).json({ error: "Failed to fetch articles" });
    }
  });

  // Current issue — articles grouped by issue_number
  app.get("/api/articles/current-issue", async (req, res) => {
    try {
      const issueParam = req.query.issue ? Number(req.query.issue) : null;
      const limit = req.query.limit ? Number(req.query.limit) : 200;

      // Find the target issue number (param or max)
      const [{ maxIssue }] = await db
        .select({ maxIssue: sql<number>`MAX(issue_number)` })
        .from(articles);
      const targetIssue = issueParam || maxIssue;

      let result;
      if (targetIssue) {
        // Articles with issue numbers — fetch by issue
        result = await storage.getArticles({
          status: "published",
          limit: 200,
          offset: 0,
          orderBy: "publishedAt",
          orderDir: "desc",
          issueNumber: targetIssue,
        });
      } else {
        // No issue numbers assigned — fall back to most recent published articles
        result = await storage.getArticles({
          status: "published",
          limit: Math.max(limit, 20),
          offset: 0,
          orderBy: "publishedAt",
          orderDir: "desc",
        });
      }

      // Separate edito from the rest
      const edito = result.articles.find(a => a.category?.slug === "edito") || null;
      const issueArticles = result.articles.filter(a => a.category?.slug !== "edito" && a.contentType === "article");

      res.json({ articles: issueArticles, edito, issueNumber: targetIssue || null });
    } catch (error) {
      console.error("Error fetching current issue:", error);
      res.status(500).json({ error: "Failed to fetch current issue" });
    }
  });

  // Contributors — list / search for the article editor picker
  app.get("/api/contributors", async (req, res) => {
    try {
      const search = (req.query.search as string)?.trim().toLowerCase() || "";
      const all = await storage.listContributors();
      const filtered = search
        ? all.filter((c) => c.name.toLowerCase().includes(search))
        : all;
      res.json({ contributors: filtered });
    } catch (error) {
      console.error("Error listing contributors:", error);
      res.status(500).json({ error: "Failed to list contributors" });
    }
  });

  app.post("/api/contributors", async (req, res) => {
    try {
      const { name, defaultRole } = req.body as { name?: string; defaultRole?: string };
      if (!name || typeof name !== "string" || name.trim().length === 0) {
        return res.status(400).json({ error: "name is required" });
      }
      const c = await storage.upsertContributorByName(name, defaultRole);
      res.json({ contributor: c });
    } catch (error) {
      console.error("Error creating contributor:", error);
      res.status(500).json({ error: "Failed to create contributor" });
    }
  });

  // Public contributor profile lookup
  app.get("/api/contributors/by-slug/:slug", async (req, res) => {
    try {
      const contributor = await storage.getContributorBySlug(req.params.slug);
      if (!contributor) return res.status(404).json({ error: "Contributor not found" });
      const articles = await storage.getArticlesByContributor(contributor.id);
      res.json({ contributor, articles });
    } catch (error) {
      console.error("Error fetching contributor:", error);
      res.status(500).json({ error: "Failed to fetch contributor" });
    }
  });

  app.get("/api/articles/:id/contributors", async (req, res) => {
    try {
      const credits = await storage.getArticleContributors(req.params.id);
      res.json({ credits });
    } catch (error) {
      console.error("Error fetching article contributors:", error);
      res.status(500).json({ error: "Failed to fetch contributors" });
    }
  });

  app.put("/api/articles/:id/contributors", async (req, res) => {
    try {
      const { credits } = req.body as {
        credits?: Array<{ contributorId: string; role: string; displayOrder?: number }>;
      };
      if (!Array.isArray(credits)) {
        return res.status(400).json({ error: "credits must be an array" });
      }
      // Filter to entries with both fields; tolerate clients sending blanks
      const cleaned = credits.filter(
        (c) => typeof c.contributorId === "string" && typeof c.role === "string" && c.role.length > 0,
      );
      await storage.setArticleContributors(req.params.id, cleaned);
      const updated = await storage.getArticleContributors(req.params.id);
      res.json({ credits: updated });
    } catch (error) {
      console.error("Error setting article contributors:", error);
      res.status(500).json({ error: "Failed to set contributors" });
    }
  });

  // Distinct photographer + illustrator values for autocomplete in the
  // article editor. Public read endpoint (admin gate only blocks mutations).
  app.get("/api/articles/credit-suggestions", async (_req, res) => {
    try {
      const photographers = await db.execute(sql`
        SELECT DISTINCT photographer FROM articles
         WHERE photographer IS NOT NULL AND length(photographer) > 0
         ORDER BY photographer
      `);
      const illustrators = await db.execute(sql`
        SELECT DISTINCT illustrator FROM articles
         WHERE illustrator IS NOT NULL AND length(illustrator) > 0
         ORDER BY illustrator
      `);
      res.json({
        photographers: photographers.rows.map((r: any) => r.photographer),
        illustrators: illustrators.rows.map((r: any) => r.illustrator),
      });
    } catch (error) {
      console.error("Error fetching credit suggestions:", error);
      res.status(500).json({ error: "Failed to fetch credit suggestions" });
    }
  });

  app.get("/api/articles/featured", async (req, res) => {
    try {
      const limit = Number(req.query.limit) || 4;
      const articles = await storage.getFeaturedArticles(limit);
      res.json({ articles });
    } catch (error) {
      console.error("Error fetching featured articles:", error);
      res.status(500).json({ error: "Failed to fetch featured articles" });
    }
  });

  // Curated splash intro slides (three articles, admin-picked)
  app.get("/api/splash-slides", async (_req, res) => {
    try {
      const slides = await storage.getSplashSlides();
      res.json({ slides });
    } catch (error) {
      console.error("Error fetching splash slides:", error);
      res.status(500).json({ error: "Failed to fetch splash slides" });
    }
  });

  app.put("/api/splash-slides", async (req, res) => {
    try {
      const { articleIds } = req.body as { articleIds?: unknown };
      if (!Array.isArray(articleIds)) {
        return res.status(400).json({ error: "articleIds must be an array" });
      }
      const cleaned = articleIds
        .slice(0, 3)
        .map((v) => (typeof v === "string" && v.length > 0 ? v : null));
      await storage.setSplashSlides(cleaned);
      const slides = await storage.getSplashSlides();
      res.json({ slides });
    } catch (error) {
      console.error("Error setting splash slides:", error);
      res.status(500).json({ error: "Failed to set splash slides" });
    }
  });

  app.get("/api/articles/trending", async (req, res) => {
    try {
      const limit = Number(req.query.limit) || 5;
      const articles = await storage.getTrendingArticles(limit);
      res.json({ articles });
    } catch (error) {
      console.error("Error fetching trending articles:", error);
      res.status(500).json({ error: "Failed to fetch trending articles" });
    }
  });

  app.get("/api/articles/:id", async (req, res) => {
    try {
      const article = await storage.getArticle(req.params.id);
      if (!article) {
        return res.status(404).json({ error: "Article not found" });
      }

      // Increment view count
      await storage.incrementArticleViews(req.params.id);

      res.json({ article });
    } catch (error) {
      console.error("Error fetching article:", error);
      res.status(500).json({ error: "Failed to fetch article" });
    }
  });

  app.get("/api/articles/by-slug/:slug", async (req, res) => {
    try {
      const article = await storage.getArticleBySlug(req.params.slug);
      if (!article) {
        return res.status(404).json({ error: "Article not found" });
      }

      // Increment view count
      await storage.incrementArticleViews(article.id);

      // Include non-author credits (photographer/illustrator/etc) so the
      // byline can render them without an extra round-trip.
      const credits = await storage.getArticleContributors(article.id);

      res.json({ article: { ...article, credits } });
    } catch (error) {
      console.error("Error fetching article by slug:", error);
      res.status(500).json({ error: "Failed to fetch article" });
    }
  });

  // Adjacent articles (prev/next) for the same content type
  app.get("/api/articles/by-slug/:slug/adjacent", async (req, res) => {
    try {
      const article = await storage.getArticleBySlug(req.params.slug);
      if (!article) return res.status(404).json({ error: "Article not found" });

      const contentType = (article as any).contentType || 'article';
      const publishedAt = (article as any).publishedAt || (article as any).createdAt;

      const [prevResult, nextResult] = await Promise.all([
        db.select({ id: articles.id, title: articles.title, slug: articles.slug })
          .from(articles)
          .where(and(
            ne(articles.id, article.id),
            eq(articles.contentType, contentType),
            eq(articles.status, 'published'),
            sql`${articles.publishedAt} <= ${publishedAt}`
          ))
          .orderBy(desc(articles.publishedAt))
          .limit(1),
        db.select({ id: articles.id, title: articles.title, slug: articles.slug })
          .from(articles)
          .where(and(
            ne(articles.id, article.id),
            eq(articles.contentType, contentType),
            eq(articles.status, 'published'),
            sql`${articles.publishedAt} >= ${publishedAt}`
          ))
          .orderBy(asc(articles.publishedAt))
          .limit(1),
      ]);

      res.json({ prev: prevResult[0] || null, next: nextResult[0] || null });
    } catch (error) {
      console.error("Error fetching adjacent articles:", error);
      res.status(500).json({ error: "Failed to fetch adjacent articles" });
    }
  });

  app.post("/api/articles", async (req, res) => {
    try {
      const validatedData = insertArticleSchema.parse(req.body);
      const { tags: tagIds, ...articleData } = req.body;

      const article = await storage.createArticle(validatedData, tagIds);
      res.json({ article });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid article data", details: error.errors });
      }
      console.error("Error creating article:", error);
      res.status(500).json({ error: "Failed to create article" });
    }
  });

  app.put("/api/articles/:id", async (req, res) => {
    try {
      const { tags: tagIds, ...articleData } = req.body;
      const validatedData = insertArticleSchema.partial().parse(articleData);

      const article = await storage.updateArticle(req.params.id, validatedData, tagIds);
      if (!article) {
        return res.status(404).json({ error: "Article not found" });
      }

      res.json({ article });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid article data", details: error.errors });
      }
      console.error("Error updating article:", error);
      res.status(500).json({ error: "Failed to update article" });
    }
  });

  app.patch("/api/articles/:id/featured", async (req, res) => {
    try {
      const { isFeatured, featuredOrder } = req.body;
      const article = await storage.updateArticle(req.params.id, { isFeatured, featuredOrder });
      if (!article) return res.status(404).json({ error: "Article not found" });
      res.json({ article });
    } catch (error) {
      console.error("Error updating featured status:", error);
      res.status(500).json({ error: "Failed to update featured status" });
    }
  });

  app.patch("/api/categories/:id/exclude-from-hero", async (req, res) => {
    try {
      const { excludeFromHero } = req.body;
      if (typeof excludeFromHero !== "boolean") {
        return res.status(400).json({ error: "excludeFromHero must be a boolean" });
      }
      const category = await storage.updateCategory(req.params.id, { excludeFromHero });
      if (!category) return res.status(404).json({ error: "Category not found" });
      res.json({ category });
    } catch (error) {
      console.error("Error updating category hero exclusion:", error);
      res.status(500).json({ error: "Failed to update category" });
    }
  });

  app.delete("/api/articles/:id", async (req, res) => {
    try {
      const success = await storage.deleteArticle(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Article not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting article:", error);
      res.status(500).json({ error: "Failed to delete article" });
    }
  });

  // Categories
  app.get("/api/categories", async (req, res) => {
    try {
      const categories = await storage.getAllCategories();
      // Attach per-category published-article counts so the subcategory
      // tabs on the public category page can hide thin categories.
      const counts = await db.execute(sql`
        SELECT category_id, count(*)::int AS n
          FROM articles
         WHERE status = 'published'
         GROUP BY category_id
      `);
      const countMap = new Map<string, number>();
      for (const row of counts.rows as Array<{ category_id: string; n: number }>) {
        countMap.set(row.category_id, row.n);
      }
      const enriched = categories.map((c) => ({
        ...c,
        articleCount: countMap.get(c.id) ?? 0,
      }));
      res.json({ categories: enriched });
    } catch (error) {
      console.error("Error fetching categories:", error);
      res.status(500).json({ error: "Failed to fetch categories" });
    }
  });

  app.get("/api/categories/by-slug/:slug", async (req, res) => {
    try {
      const category = await storage.getCategoryBySlug(req.params.slug);
      if (!category) {
        return res.status(404).json({ error: "Category not found" });
      }
      res.json({ category });
    } catch (error) {
      console.error("Error fetching category by slug:", error);
      res.status(500).json({ error: "Failed to fetch category" });
    }
  });

  app.get("/api/categories/:id", async (req, res) => {
    try {
      const category = await storage.getCategory(req.params.id);
      if (!category) {
        return res.status(404).json({ error: "Category not found" });
      }
      res.json({ category });
    } catch (error) {
      console.error("Error fetching category:", error);
      res.status(500).json({ error: "Failed to fetch category" });
    }
  });

  app.post("/api/categories", async (req, res) => {
    try {
      const validatedData = insertCategorySchema.parse(req.body);
      const category = await storage.createCategory(validatedData);
      res.json({ category });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid category data", details: error.errors });
      }
      console.error("Error creating category:", error);
      res.status(500).json({ error: "Failed to create category" });
    }
  });

  app.post("/api/categories/update-hierarchy", async (req, res) => {
    try {
      const { hierarchyData } = req.body;
      
      if (!hierarchyData || typeof hierarchyData !== 'string') {
        return res.status(400).json({ error: "Invalid hierarchy data" });
      }

      const lines = hierarchyData.split('\n').filter((line: string) => line.trim());
      const categoryStack: { slug: string; level: number }[] = [];
      let updated = 0;

      for (const line of lines) {
        const dashMatch = line.match(/^(—\s*)*/);
        const level = dashMatch ? dashMatch[0].split('—').length - 1 : 0;
        
        const slugMatch = line.match(/\t([a-z0-9-]+)\t/);
        if (!slugMatch) continue;
        
        const slug = slugMatch[1];
        
        // Pop categories from stack that are at same or deeper level
        while (categoryStack.length > 0 && categoryStack[categoryStack.length - 1].level >= level) {
          categoryStack.pop();
        }
        
        // Get parent from stack (if exists)
        const parentSlug = categoryStack.length > 0 ? categoryStack[categoryStack.length - 1].slug : null;
        
        // Update category parent
        const category = await storage.getCategoryBySlug(slug);
        if (category) {
          const parentCategory = parentSlug ? await storage.getCategoryBySlug(parentSlug) : null;
          await storage.updateCategoryParent(category.id, parentCategory?.id || null);
          updated++;
        }
        
        // Add current category to stack
        categoryStack.push({ slug, level });
      }

      res.json({ message: `Updated ${updated} category parent relationships`, updated });
    } catch (error) {
      console.error("Error updating category hierarchy:", error);
      res.status(500).json({ error: "Failed to update category hierarchy" });
    }
  });

  // Tags
  app.get("/api/tags", async (req, res) => {
    try {
      const tags = await storage.getAllTags();
      res.json({ tags });
    } catch (error) {
      console.error("Error fetching tags:", error);
      res.status(500).json({ error: "Failed to fetch tags" });
    }
  });

  app.post("/api/tags", async (req, res) => {
    try {
      const validatedData = insertTagSchema.parse(req.body);
      const tag = await storage.createTag(validatedData);
      res.json({ tag });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid tag data", details: error.errors });
      }
      console.error("Error creating tag:", error);
      res.status(500).json({ error: "Failed to create tag" });
    }
  });

  // Authors
  app.get("/api/authors", async (req, res) => {
    try {
      const authors = await storage.getAllAuthors();
      res.json({ authors });
    } catch (error) {
      console.error("Error fetching authors:", error);
      res.status(500).json({ error: "Failed to fetch authors" });
    }
  });

  // Public directory: authors with at least one published article, plus
  // article count and the categories they've written in (used to auto-derive
  // a "Writes about X" line on the public /authors page).
  app.get("/api/authors/directory", async (_req, res) => {
    try {
      const authors = await storage.getDirectoryAuthors();
      res.json({ authors });
    } catch (error) {
      console.error("Error fetching author directory:", error);
      res.status(500).json({ error: "Failed to fetch author directory" });
    }
  });

  // Lookup by slug — used by the public author page.
  app.get("/api/authors/by-slug/:slug", async (req, res) => {
    try {
      const author = await storage.getAuthorBySlug(req.params.slug);
      if (!author) return res.status(404).json({ error: "Author not found" });
      res.json({ author });
    } catch (error) {
      console.error("Error fetching author by slug:", error);
      res.status(500).json({ error: "Failed to fetch author" });
    }
  });

  app.post("/api/authors", async (req, res) => {
    try {
      const validatedData = insertAuthorSchema.parse(req.body);
      const author = await storage.createAuthor(validatedData);
      res.json({ author });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid author data", details: error.errors });
      }
      console.error("Error creating author:", error);
      res.status(500).json({ error: "Failed to create author" });
    }
  });

  app.put("/api/authors/:id", async (req, res) => {
    try {
      const validatedData = insertAuthorSchema.partial().parse(req.body);
      const author = await storage.updateAuthor(req.params.id, validatedData);
      if (!author) {
        return res.status(404).json({ error: "Author not found" });
      }
      res.json({ author });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid author data", details: error.errors });
      }
      console.error("Error updating author:", error);
      res.status(500).json({ error: "Failed to update author" });
    }
  });

  app.delete("/api/authors/:id", async (req, res) => {
    try {
      const success = await storage.deleteAuthor(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Author not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting author:", error);
      res.status(500).json({ error: "Failed to delete author" });
    }
  });

  // Media and Object Storage
  app.get("/objects/:objectPath(*)", async (req, res) => {
    const objectStorageService = new ObjectStorageService();
    try {
      const objectFile = await objectStorageService.getObjectEntityFile(req.path);
      objectStorageService.downloadObject(objectFile, res);
    } catch (error) {
      console.error("Error serving object:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.sendStatus(404);
      }
      return res.sendStatus(500);
    }
  });

  app.post("/api/objects/upload", async (req, res) => {
    try {
      const objectStorageService = new ObjectStorageService();
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      res.json({ uploadURL });
    } catch (error) {
      console.error("Error getting upload URL:", error);
      res.status(500).json({ error: "Failed to get upload URL" });
    }
  });

  app.post("/api/media", async (req, res) => {
    try {
      if (!req.body.objectPath) {
        return res.status(400).json({ error: "objectPath is required" });
      }

      const objectStorageService = new ObjectStorageService();
      const normalizedPath = objectStorageService.normalizeObjectEntityPath(req.body.objectPath);

      const validatedData = insertMediaSchema.parse({
        ...req.body,
        objectPath: normalizedPath,
      });

      const media = await storage.createMedia(validatedData);
      res.json({ media });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid media data", details: error.errors });
      }
      console.error("Error creating media record:", error);
      res.status(500).json({ error: "Failed to create media record" });
    }
  });

  app.get("/api/media", async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const search = req.query.search as string || '';
      
      const offset = (page - 1) * limit;
      
      const result = await storage.getAllMedia({
        search: search || undefined,
        limit,
        offset
      });
      
      res.json({ 
        media: result.media,
        total: result.total,
        page,
        totalPages: Math.ceil(result.total / limit)
      });
    } catch (error) {
      console.error("Error fetching media:", error);
      res.status(500).json({ error: "Failed to fetch media" });
    }
  });

  // Image upload with processing (generates responsive variants and WebP)
  app.post("/api/media/upload", upload.single('image'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No image file provided" });
      }

      // Validate image type
      if (!req.file.mimetype.startsWith('image/')) {
        return res.status(400).json({ error: "File must be an image" });
      }

      // Check if R2 is configured, otherwise fall back to GCS
      const useR2 = process.env.R2_BUCKET_NAME && 
                    process.env.R2_ACCESS_KEY_ID && 
                    process.env.R2_SECRET_ACCESS_KEY && 
                    process.env.R2_ACCOUNT_ID;

      let processed;
      
      if (useR2) {
        // Use R2 for new uploads
        const { processImageR2 } = await import('./imageProcessorR2');
        processed = await processImageR2(req.file.buffer, req.file.originalname);
      } else {
        // Fallback to GCS
        const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
        if (!bucketId) {
          return res.status(500).json({ error: "Object storage not configured" });
        }
        processed = await processImage(
          req.file.buffer,
          req.file.originalname,
          bucketId,
          objectStorageClient
        );
      }

      // Create media record with variants
      const mediaData = {
        filename: req.file.originalname,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: processed.metadata.size,
        width: processed.metadata.width,
        height: processed.metadata.height,
        objectPath: processed.variants.original,
        variants: processed.variants,
        alt: req.body.alt || '',
      };

      const media = await storage.createMedia(mediaData);
      
      // Return media with URLs (R2 URLs are already absolute)
      res.setHeader('Content-Type', 'application/json');
      res.json({
        media: {
          ...media,
          urls: useR2 ? {
            thumbnail: processed.variants.thumbnail,
            medium: processed.variants.medium,
            large: processed.variants.large,
            webp: processed.variants.webp,
            original: processed.variants.original,
          } : {
            thumbnail: getPublicUrl(process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID || '', processed.variants.thumbnail),
            medium: getPublicUrl(process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID || '', processed.variants.medium),
            large: getPublicUrl(process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID || '', processed.variants.large),
            webp: getPublicUrl(process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID || '', processed.variants.webp),
            original: getPublicUrl(process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID || '', processed.variants.original),
          }
        }
      });
    } catch (error) {
      console.error("Error uploading and processing image:", error);
      res.status(500).json({ error: "Failed to upload and process image" });
    }
  });

  // Index images from article URLs (for external R2/CDN images)
  app.post("/api/media/index-from-articles", async (req, res) => {
    try {
      // Fetch all articles regardless of status
      const statuses = ['published', 'draft', 'archived'];
      const allArticlesArrays = await Promise.all(
        statuses.map(status => 
          storage.getArticles({
            status,
            limit: 10000,
            offset: 0,
            orderBy: 'createdAt',
            orderDir: 'desc',
          })
        )
      );
      
      const allArticles = allArticlesArrays.flatMap(result => result.articles);

      const imageUrlPattern = /https:\/\/[^\s"'<>)]+\.(jpg|jpeg|png|gif|webp)/gi;
      const foundUrls = new Set<string>();

      for (const article of allArticles) {
        if (article.featuredImage) {
          foundUrls.add(article.featuredImage);
        }

        if (article.content) {
          const matches = Array.from(article.content.matchAll(imageUrlPattern));
          for (const match of matches) {
            foundUrls.add(match[0]);
          }
        }
      }

      const existingMedia = await storage.getAllMedia();
      const existingUrls = new Set(existingMedia.media.map(m => {
        // Check both objectPath and if it's a URL
        if (m.objectPath.startsWith('http')) {
          return m.objectPath;
        }
        return null;
      }).filter(Boolean));

      let indexed = 0;
      let skipped = 0;

      // Helper to get MIME type from URL extension
      const getMimeType = (url: string): string => {
        const ext = url.split('.').pop()?.toLowerCase();
        const mimeMap: Record<string, string> = {
          'jpg': 'image/jpeg',
          'jpeg': 'image/jpeg',
          'png': 'image/png',
          'gif': 'image/gif',
          'webp': 'image/webp',
        };
        return mimeMap[ext || ''] || 'image/jpeg';
      };

      for (const url of Array.from(foundUrls)) {
        if (existingUrls.has(url)) {
          skipped++;
          continue;
        }

        try {
          const filename = url.split('/').pop() || 'unknown.jpg';
          
          await storage.createMedia({
            filename,
            originalName: filename,
            mimeType: getMimeType(url),
            size: 0,
            width: null,
            height: null,
            objectPath: url,
            variants: null,
            alt: '',
          });
          
          indexed++;
        } catch (error) {
          console.error(`Error indexing URL ${url}:`, error);
        }
      }

      res.json({
        success: true,
        stats: {
          total: foundUrls.size,
          indexed,
          skipped,
          existing: existingUrls.size
        }
      });
    } catch (error) {
      console.error("Error indexing from articles:", error);
      res.status(500).json({ error: "Failed to index from articles" });
    }
  });

  // Media indexing - scan bucket and index unindexed images
  app.post("/api/media/index-bucket", async (req, res) => {
    try {
      const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
      if (!bucketId) {
        return res.status(500).json({ error: "Object storage not configured" });
      }

      const bucket = objectStorageClient.bucket(bucketId);
      const [files] = await bucket.getFiles({ prefix: 'public/images/' });
      
      const indexedCount = { total: 0, skipped: 0, indexed: 0, errors: 0 };
      const existingMedia = await storage.getAllMedia();
      const existingPaths = new Set(existingMedia.media.map(m => m.objectPath));

      for (const file of files) {
        indexedCount.total++;
        
        // Skip if already indexed
        if (existingPaths.has(file.name)) {
          indexedCount.skipped++;
          continue;
        }

        // Skip variant files (we only want to index originals)
        if (file.name.includes('-thumbnail.') || file.name.includes('-medium.') || file.name.includes('-large.')) {
          indexedCount.skipped++;
          continue;
        }

        try {
          const [metadata] = await file.getMetadata();
          const filename = file.name.split('/').pop() || file.name;
          
          // Create media record
          await storage.createMedia({
            filename,
            originalName: filename,
            mimeType: metadata.contentType || 'image/jpeg',
            size: parseInt(String(metadata.size || '0')),
            width: null,
            height: null,
            objectPath: file.name,
            variants: null,
            alt: '',
          });
          
          indexedCount.indexed++;
        } catch (error) {
          console.error(`Error indexing ${file.name}:`, error);
          indexedCount.errors++;
        }
      }

      res.json({ 
        success: true,
        stats: indexedCount
      });
    } catch (error) {
      console.error("Error indexing bucket:", error);
      res.status(500).json({ error: "Failed to index bucket" });
    }
  });

  // Storage analysis - get stats about storage usage
  app.get("/api/media/storage-analysis", async (req, res) => {
    try {
      // Get all indexed media from database
      const allMedia = await storage.getAllMedia();
      
      // Separate URL-based (external R2) from path-based (local GCS)
      const urlBasedMedia = allMedia.media.filter(m => m.objectPath?.startsWith('http'));
      const pathBasedMedia = allMedia.media.filter(m => m.objectPath && !m.objectPath.startsWith('http'));
      
      const analysis = {
        totalIndexed: allMedia.media.length,
        externalR2: urlBasedMedia.length,
        localGCS: pathBasedMedia.length,
        localGCSUnindexed: 0,
        byType: {
          original: { count: 0, size: 0 },
          thumbnail: { count: 0, size: 0 },
          medium: { count: 0, size: 0 },
          large: { count: 0, size: 0 },
        },
      };

      // Only scan GCS bucket if credentials are available
      const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
      if (bucketId) {
        try {
          const bucket = objectStorageClient.bucket(bucketId);
          const [files] = await bucket.getFiles({ prefix: 'public/images/' });
          
          const existingPaths = new Set(pathBasedMedia.map(m => m.objectPath));
          
          for (const file of files) {
            const [metadata] = await file.getMetadata();
            const size = parseInt(String(metadata.size || '0'));

            // Categorize by variant type
            if (file.name.includes('-thumbnail.')) {
              analysis.byType.thumbnail.count++;
              analysis.byType.thumbnail.size += size;
            } else if (file.name.includes('-medium.')) {
              analysis.byType.medium.count++;
              analysis.byType.medium.size += size;
            } else if (file.name.includes('-large.')) {
              analysis.byType.large.count++;
              analysis.byType.large.size += size;
            } else {
              analysis.byType.original.count++;
              analysis.byType.original.size += size;
              
              // Check if this original is unindexed
              if (!existingPaths.has(file.name)) {
                analysis.localGCSUnindexed++;
              }
            }
          }
        } catch (bucketError) {
          console.error("Error scanning GCS bucket:", bucketError);
          // Continue even if bucket scan fails - we still have database stats
        }
      }

      res.json({ analysis });
    } catch (error) {
      console.error("Error analyzing storage:", error);
      res.status(500).json({ error: "Failed to analyze storage" });
    }
  });

  // Delete specific variant types
  app.post("/api/media/cleanup-variants", async (req, res) => {
    try {
      const { variantType } = req.body; // 'thumbnail', 'medium', or 'large'
      
      if (!['thumbnail', 'medium', 'large'].includes(variantType)) {
        return res.status(400).json({ error: "Invalid variant type" });
      }

      const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
      if (!bucketId) {
        return res.status(500).json({ error: "Object storage not configured" });
      }

      const bucket = objectStorageClient.bucket(bucketId);
      const [files] = await bucket.getFiles({ prefix: 'public/images/' });
      
      const deletedFiles = [];
      const errors = [];

      for (const file of files) {
        if (file.name.includes(`-${variantType}.`)) {
          try {
            await file.delete();
            deletedFiles.push(file.name);
          } catch (error) {
            console.error(`Error deleting ${file.name}:`, error);
            errors.push(file.name);
          }
        }
      }

      res.json({ 
        success: true,
        deleted: deletedFiles.length,
        errors: errors.length,
        deletedFiles,
      });
    } catch (error) {
      console.error("Error cleaning up variants:", error);
      res.status(500).json({ error: "Failed to cleanup variants" });
    }
  });

  // WordPress Import
  app.post("/api/import/wordpress", upload.single('xmlFile'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No XML file provided" });
      }

      const xmlContent = req.file.buffer.toString('utf-8');
      const parser = new DOMParser();
      const doc = parser.parseFromString(xmlContent, 'text/xml');

      // Parse WordPress XML
      const items = doc.getElementsByTagName('item');
      const importResults = {
        articles: 0,
        categories: 0,
        tags: 0,
        authors: 0,
        errors: [] as string[],
      };

      // Parse category hierarchy from XML header first
      const wpCategoryElements = doc.getElementsByTagName('wp:category');
      const categoryMap = new Map<string, { name: string; slug: string; parent: string | null }>();
      
      for (let i = 0; i < wpCategoryElements.length; i++) {
        const catEl = wpCategoryElements[i];
        const slug = getTextContent(catEl, 'wp:category_nicename');
        const name = getTextContent(catEl, 'wp:cat_name');
        const parent = getTextContent(catEl, 'wp:category_parent') || null;
        
        if (slug && name) {
          categoryMap.set(slug, { name, slug, parent });
        }
      }

      // Create categories in hierarchical order (parents first, then children)
      const categoryCache = new Map<string, any>(); // slug -> created category
      
      // Helper function to create category with parent
      const createCategoryHierarchy = async (slug: string): Promise<any> => {
        if (categoryCache.has(slug)) {
          return categoryCache.get(slug);
        }
        
        const catData = categoryMap.get(slug);
        if (!catData) return null;
        
        // Check if category already exists in database
        let existingCat = await storage.getCategoryBySlug(slug);
        if (existingCat) {
          categoryCache.set(slug, existingCat);
          return existingCat;
        }
        
        // If has parent, create parent first
        let parentCat = null;
        if (catData.parent) {
          parentCat = await createCategoryHierarchy(catData.parent);
        }
        
        // Create this category
        const newCat = await storage.createCategory({
          name: catData.name,
          slug: catData.slug,
          parentId: parentCat?.id || undefined,
        });
        
        categoryCache.set(slug, newCat);
        importResults.categories++;
        return newCat;
      };
      
      // Create all categories from the map
      for (const slug of Array.from(categoryMap.keys())) {
        await createCategoryHierarchy(slug);
      }

      // Cache for WordPress authors to avoid duplicates
      const authorCache = new Map<string, any>();

      // Process each WordPress post
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        
        try {
          const title = getTextContent(item, 'title');
          const content = getTextContent(item, 'content:encoded');
          const excerpt = getTextContent(item, 'excerpt:encoded');
          let slug = getTextContent(item, 'wp:post_name');
          const status = getTextContent(item, 'wp:status');
          const postType = getTextContent(item, 'wp:post_type');
          const pubDate = getTextContent(item, 'pubDate');
          const wpPostId = getTextContent(item, 'wp:post_id');
          const wpLink = getTextContent(item, 'link');
          const wpAuthorName = getTextContent(item, 'dc:creator');
          
          // Extract WordPress post meta (custom fields)
          const postMeta: Record<string, string> = {};
          const postMetaElements = item.getElementsByTagName('wp:postmeta');
          for (let j = 0; j < postMetaElements.length; j++) {
            const metaEl = postMetaElements[j];
            const metaKey = getTextContent(metaEl, 'wp:meta_key');
            const metaValue = getTextContent(metaEl, 'wp:meta_value');
            if (metaKey && metaValue) {
              postMeta[metaKey] = metaValue;
            }
          }
          
          // Generate slug from title if wp:post_name is empty
          if (!slug || slug.trim() === '') {
            slug = (title || '')
              .toLowerCase()
              .replace(/[^\w\s-]/g, '') // Remove special chars
              .replace(/\s+/g, '-')      // Replace spaces with -
              .replace(/-+/g, '-')       // Replace multiple - with single -
              .trim()
              .replace(/^-+|-+$/g, '');  // Trim - from start/end
            
            // Fallback if slug is still empty
            if (!slug) {
              slug = `post-${Date.now()}`;
            }
          }

          // Only import posts (not pages or other post types)
          if (postType !== 'post') continue;

          // Parse WordPress categories from post
          const categoryElements = item.getElementsByTagName('category');
          let category = null;
          
          // Find the first category with domain="category" (actual post category, not tag)
          for (let j = 0; j < categoryElements.length; j++) {
            const catEl = categoryElements[j];
            const domain = catEl.getAttribute('domain');
            
            if (domain === 'category') {
              const categorySlug = catEl.getAttribute('nicename') || '';
              
              if (categorySlug) {
                // Use cached category (already created with hierarchy)
                category = categoryCache.get(categorySlug);
                if (!category) {
                  // Fallback: check database
                  category = await storage.getCategoryBySlug(categorySlug);
                }
                
                break; // Use first category found
              }
            }
          }
          
          // Fallback to Uncategorized if no category found
          if (!category) {
            if (categoryCache.has('uncategorized')) {
              category = categoryCache.get('uncategorized');
            } else {
              category = await storage.getCategoryBySlug('uncategorized');
              if (!category) {
                category = await storage.createCategory({
                  name: 'Uncategorized',
                  slug: 'uncategorized',
                  description: 'Posts without a category',
                });
                importResults.categories++;
                categoryCache.set('uncategorized', category);
              }
            }
          }

          // Check if slug already exists and make it unique
          let uniqueSlug = slug || `imported-post-${Date.now()}`;
          let slugExists = await storage.getArticleBySlug(uniqueSlug);
          let slugCounter = 2;
          
          while (slugExists) {
            uniqueSlug = `${slug}-${slugCounter}`;
            slugExists = await storage.getArticleBySlug(uniqueSlug);
            slugCounter++;
          }

          // Get or create author from WordPress dc:creator
          let author;
          const authorName = wpAuthorName || 'Imported Author';
          
          if (authorCache.has(authorName)) {
            author = authorCache.get(authorName);
          } else {
            // Generate email from author name
            const authorEmail = `${authorName.toLowerCase().replace(/\s+/g, '.')}@imported.local`;
            author = await storage.getAuthorByEmail(authorEmail);
            
            if (!author) {
              author = await storage.createAuthor({
                name: authorName,
                email: authorEmail,
                bio: '',
              });
              importResults.authors++;
            }
            
            authorCache.set(authorName, author);
          }

          // Extract WordPress tags
          const wpTagIds: string[] = [];
          for (let j = 0; j < categoryElements.length; j++) {
            const catEl = categoryElements[j];
            const domain = catEl.getAttribute('domain');
            
            if (domain === 'post_tag') {
              const tagName = catEl.textContent?.trim() || '';
              const tagSlug = catEl.getAttribute('nicename') || tagName.toLowerCase().replace(/\s+/g, '-');
              
              if (tagName) {
                let tag = await storage.getTagBySlug(tagSlug);
                
                if (!tag) {
                  tag = await storage.createTag({
                    name: tagName,
                    slug: tagSlug,
                  });
                  importResults.tags = (importResults.tags || 0) + 1;
                }
                
                wpTagIds.push(tag.id);
              }
            }
          }

          // Extract featured image - try excerpt first, then content
          let featuredImage = extractFeaturedImage(excerpt || '');
          if (!featuredImage && content) {
            featuredImage = extractFeaturedImage(content);
          }
          
          // Extract meta description - prioritize WordPress SEO meta, fallback to excerpt
          let metaDescription = 
            postMeta['_yoast_wpseo_metadesc'] || 
            postMeta['_aioseop_description'] || 
            postMeta['_genesis_description'] ||
            undefined;
          
          // Fallback to excerpt-based description if no meta found
          if (!metaDescription && excerpt) {
            metaDescription = excerpt.replace(/<[^>]*>/g, '').substring(0, 160);
          }

          const articleData = {
            title: title || 'Untitled',
            slug: uniqueSlug,
            excerpt: excerpt || '',
            content: content || '',
            featuredImage: featuredImage || undefined,
            metaDescription,
            status: status === 'publish' ? 'published' : 'draft',
            authorId: author.id,
            categoryId: category.id,
            publishedAt: pubDate ? new Date(pubDate) : new Date(),
            readTime: Math.max(1, Math.ceil((content?.length || 0) / 1000)),
            wpId: wpPostId ? parseInt(wpPostId) : undefined,
            wpData: {
              originalLink: wpLink,
              originalStatus: status,
              postType: postType,
              postMeta: Object.keys(postMeta).length > 0 ? postMeta : undefined,
            },
          };

          await storage.createArticle(articleData, wpTagIds);
          importResults.articles++;

        } catch (error) {
          console.error(`Error importing item ${i}:`, error);
          importResults.errors.push(`Item ${i}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      res.json({
        success: true,
        message: `Import completed`,
        results: importResults,
      });

    } catch (error) {
      console.error("Error importing WordPress content:", error);
      res.status(500).json({ error: "Failed to import WordPress content" });
    }
  });

  // ─── Data Export ──────────────────────────────────────────────────────────
  app.get("/api/admin/export", async (req, res) => {
    try {
      const allAuthors    = await db.select().from(authors);
      const allCategories = await db.select().from(categories);
      const allTags       = await db.select().from(tags);
      const allArticles   = await db.select().from(articles);
      const allArticleTags = await db.select().from(articleTags);

      const payload = { authors: allAuthors, categories: allCategories, tags: allTags, articles: allArticles, articleTags: allArticleTags };
      const json = JSON.stringify(payload);

      res.setHeader("Content-Type", "application/json");
      res.setHeader("Content-Disposition", `attachment; filename="gallery-export-${new Date().toISOString().slice(0,10)}.json"`);
      res.send(json);
    } catch (error) {
      console.error("Export error:", error);
      res.status(500).json({ error: "Export failed" });
    }
  });

  // ─── Data Import ──────────────────────────────────────────────────────────
  app.post("/api/admin/import", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: "No file uploaded" });

      const payload = JSON.parse(req.file.buffer.toString("utf-8"));
      const { authors: importAuthors = [], categories: importCategories = [], tags: importTags = [], articles: importArticles = [], articleTags: importArticleTags = [] } = payload;

      let stats = { authors: 0, categories: 0, tags: 0, articles: 0, articleTags: 0 };

      // Authors
      for (const row of importAuthors) {
        const { createdAt, ...rest } = row;
        await db.execute(
          sql`INSERT INTO authors (id, name, email, bio, avatar, created_at)
              VALUES (${rest.id}, ${rest.name}, ${rest.email}, ${rest.bio ?? null}, ${rest.avatar ?? null}, ${createdAt ?? new Date()})
              ON CONFLICT (id) DO NOTHING`
        );
        stats.authors++;
      }

      // Categories (two passes to handle parent references)
      for (const row of importCategories) {
        const { createdAt, ...rest } = row;
        await db.execute(
          sql`INSERT INTO categories (id, name, slug, description, color, parent_id, created_at)
              VALUES (${rest.id}, ${rest.name}, ${rest.slug}, ${rest.description ?? null}, ${rest.color ?? null}, NULL, ${createdAt ?? new Date()})
              ON CONFLICT (id) DO NOTHING`
        );
        stats.categories++;
      }
      // Second pass: set parent_id
      for (const row of importCategories) {
        if (row.parentId) {
          await db.execute(sql`UPDATE categories SET parent_id = ${row.parentId} WHERE id = ${row.id}`);
        }
      }

      // Tags
      for (const row of importTags) {
        const { createdAt, ...rest } = row;
        await db.execute(
          sql`INSERT INTO tags (id, name, slug, created_at)
              VALUES (${rest.id}, ${rest.name}, ${rest.slug}, ${createdAt ?? new Date()})
              ON CONFLICT (id) DO NOTHING`
        );
        stats.tags++;
      }

      // Articles
      for (const row of importArticles) {
        const { createdAt, updatedAt, ...rest } = row;
        await db.execute(
          sql`INSERT INTO articles (id, title, slug, excerpt, content, featured_image, status, views, read_time, author_id, category_id, published_at, created_at, updated_at, meta_title, meta_description, wp_id, wp_data, is_featured, featured_order)
              VALUES (${rest.id}, ${rest.title}, ${rest.slug}, ${rest.excerpt ?? null}, ${rest.content}, ${rest.featuredImage ?? null}, ${rest.status}, ${rest.views ?? 0}, ${rest.readTime ?? 5}, ${rest.authorId}, ${rest.categoryId}, ${rest.publishedAt ?? null}, ${createdAt ?? new Date()}, ${updatedAt ?? new Date()}, ${rest.metaTitle ?? null}, ${rest.metaDescription ?? null}, ${rest.wpId ?? null}, ${rest.wpData ? JSON.stringify(rest.wpData) : null}, ${rest.isFeatured ?? false}, ${rest.featuredOrder ?? 0})
              ON CONFLICT (id) DO NOTHING`
        );
        stats.articles++;
      }

      // Article tags
      for (const row of importArticleTags) {
        await db.execute(
          sql`INSERT INTO article_tags (id, article_id, tag_id)
              VALUES (${row.id}, ${row.articleId}, ${row.tagId})
              ON CONFLICT (id) DO NOTHING`
        );
        stats.articleTags++;
      }

      res.json({ success: true, stats });
    } catch (error) {
      console.error("Import error:", error);
      res.status(500).json({ error: "Import failed", detail: String(error) });
    }
  });

  // Statistics
  app.get("/api/stats", async (req, res) => {
    try {
      const stats = await storage.getStats();
      res.json({ stats });
    } catch (error) {
      console.error("Error fetching stats:", error);
      res.status(500).json({ error: "Failed to fetch statistics" });
    }
  });

  app.get("/api/analytics/page-views", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const categoryId = req.query.categoryId as string | undefined;
      const period = req.query.period as string | undefined; // '7d' | '30d' | '90d' | 'all'

      let dateFilter: Date | undefined;
      if (period && period !== 'all') {
        const days = parseInt(period);
        dateFilter = new Date();
        dateFilter.setDate(dateFilter.getDate() - days);
      }

      // Top articles by views
      const topArticlesResult = await db.execute(sql`
        SELECT
          a.id, a.title, a.slug, a.views, a.published_at,
          a.status,
          c.name  AS category_name,
          c.id    AS category_id,
          au.name AS author_name
        FROM articles a
        JOIN categories c  ON a.category_id = c.id
        JOIN authors   au ON a.author_id    = au.id
        WHERE a.views > 0
          ${categoryId ? sql`AND a.category_id = ${categoryId}` : sql``}
          ${dateFilter  ? sql`AND a.published_at >= ${dateFilter}` : sql``}
        ORDER BY a.views DESC
        LIMIT ${limit}
      `);

      // Views by category
      const byCategoryResult = await db.execute(sql`
        SELECT
          c.id, c.name,
          COUNT(a.id)::int    AS article_count,
          COALESCE(SUM(a.views), 0)::int AS total_views
        FROM categories c
        LEFT JOIN articles a ON a.category_id = c.id
          ${dateFilter ? sql`AND a.published_at >= ${dateFilter}` : sql``}
        GROUP BY c.id, c.name
        HAVING COALESCE(SUM(a.views), 0) > 0
        ORDER BY total_views DESC
      `);

      // Views by author
      const byAuthorResult = await db.execute(sql`
        SELECT
          au.id, au.name,
          COUNT(a.id)::int    AS article_count,
          COALESCE(SUM(a.views), 0)::int AS total_views
        FROM authors au
        LEFT JOIN articles a ON a.author_id = au.id
          ${dateFilter ? sql`AND a.published_at >= ${dateFilter}` : sql``}
        GROUP BY au.id, au.name
        HAVING COALESCE(SUM(a.views), 0) > 0
        ORDER BY total_views DESC
        LIMIT 20
      `);

      // Summary totals
      const totalsResult = await db.execute(sql`
        SELECT
          COUNT(*)::int                  AS article_count,
          COALESCE(SUM(views), 0)::int   AS total_views,
          COALESCE(AVG(views), 0)::float AS avg_views,
          COALESCE(MAX(views), 0)::int   AS max_views
        FROM articles
        WHERE views > 0
          ${dateFilter ? sql`AND published_at >= ${dateFilter}` : sql``}
      `);

      res.json({
        summary: totalsResult.rows[0],
        topArticles: topArticlesResult.rows,
        byCategory: byCategoryResult.rows,
        byAuthor: byAuthorResult.rows,
      });
    } catch (error) {
      console.error("Error fetching page views analytics:", error);
      res.status(500).json({ error: "Failed to fetch analytics" });
    }
  });

  // WordPress author update (preserves content and images)
  app.post("/api/admin/wordpress-update-authors", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const xmlContent = req.file.buffer.toString('utf-8');
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlContent, 'text/xml');
      
      const items = Array.from(xmlDoc.getElementsByTagName('item'));
      
      const updateResults = {
        totalPosts: items.length,
        authorsCreated: 0,
        articlesUpdated: 0,
        articlesNotFound: 0,
        errors: [] as string[],
      };

      // Cache for WordPress authors
      const authorCache = new Map<string, any>();

      for (let i = 0; i < items.length; i++) {
        try {
          const item = items[i];
          const postType = getTextContent(item, 'wp:post_type');
          const status = getTextContent(item, 'wp:status');
          
          // Only process published/draft posts
          if (postType !== 'post' || !['publish', 'draft'].includes(status)) {
            continue;
          }

          const wpPostId = getTextContent(item, 'wp:post_id');
          const wpAuthorName = getTextContent(item, 'dc:creator');

          if (!wpPostId) {
            continue;
          }

          // Get or create author
          let author;
          const authorName = wpAuthorName || 'Imported Author';
          
          if (authorCache.has(authorName)) {
            author = authorCache.get(authorName);
          } else {
            const authorEmail = `${authorName.toLowerCase().replace(/\s+/g, '.')}@imported.local`;
            
            let existingAuthor = await storage.getAuthorByEmail(authorEmail);
            if (!existingAuthor) {
              existingAuthor = await storage.createAuthor({
                name: authorName,
                email: authorEmail,
                bio: '',
              });
              updateResults.authorsCreated++;
            }
            
            author = existingAuthor;
            authorCache.set(authorName, author);
          }

          // Find existing article by wpId
          const existingArticle = await storage.getArticleByWpId(parseInt(wpPostId));
          
          if (existingArticle) {
            // Update only the author, preserve everything else
            await storage.updateArticle(existingArticle.id, {
              authorId: author.id,
            });
            updateResults.articlesUpdated++;
          } else {
            updateResults.articlesNotFound++;
          }

        } catch (error) {
          console.error(`Error updating item ${i}:`, error);
          updateResults.errors.push(`Item ${i}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      res.json({
        success: true,
        message: `Author update completed`,
        results: updateResults,
      });

    } catch (error) {
      console.error("Error updating WordPress authors:", error);
      res.status(500).json({ error: "Failed to update WordPress authors" });
    }
  });

  // Image usage analysis endpoint
  app.get("/api/admin/image-analysis", async (req, res) => {
    try {
      // Fetch all articles (no pagination, get all)
      const allArticles = await storage.getArticles({
        status: undefined, // Get all statuses
        limit: 100000, // Very high limit to get all
        offset: 0,
        orderBy: 'publishedAt',
        orderDir: 'desc',
      });

      // Extract all image URLs from article content
      const imageUrlPattern = getR2ImagePattern('gi');
      const usedImages = new Set<string>();

      for (const article of allArticles.articles) {
        // Check featured image
        if (article.featuredImage) {
          usedImages.add(article.featuredImage);
        }

        // Check content for images
        if (article.content) {
          const matches = article.content.matchAll(imageUrlPattern);
          for (const match of Array.from(matches)) {
            usedImages.add(match[0]);
          }
        }
      }

      // Extract just the path (storage key) from each URL
      const usedPaths = Array.from(usedImages).map(url => extractR2Key(url) || url);

      // Group by year and file
      const pathsByYear: Record<string, string[]> = {};
      for (const path of usedPaths) {
        const yearMatch = path.match(/^(\d{4})\//);
        const year = yearMatch ? yearMatch[1] : 'unknown';
        if (!pathsByYear[year]) {
          pathsByYear[year] = [];
        }
        pathsByYear[year].push(path);
      }

      res.json({
        totalArticles: allArticles.total,
        totalImagesUsed: usedImages.size,
        usedImageUrls: Array.from(usedImages).sort(),
        usedPaths: usedPaths.sort(),
        pathsByYear,
        summary: {
          totalImages: usedImages.size,
          byYear: Object.keys(pathsByYear).sort().reduce((acc, year) => {
            acc[year] = pathsByYear[year].length;
            return acc;
          }, {} as Record<string, number>)
        }
      });
    } catch (error) {
      console.error("Error analyzing image usage:", error);
      res.status(500).json({ error: "Failed to analyze image usage" });
    }
  });

  // R2 Image Rationalization - Analyze variants vs originals
  app.get("/api/admin/r2-usage-analysis", async (req, res) => {
    try {
      const allArticles = await storage.getArticles({
        status: undefined,
        limit: 100000,
        offset: 0,
        orderBy: 'publishedAt',
        orderDir: 'desc',
      });

      const r2Pattern = getR2UrlPattern('gi');
      const usedUrls = new Set<string>();

      for (const article of allArticles.articles) {
        if (article.featuredImage && isR2Url(article.featuredImage)) {
          usedUrls.add(article.featuredImage);
        }
        if (article.content) {
          const matches = article.content.matchAll(r2Pattern);
          for (const match of Array.from(matches)) {
            usedUrls.add(match[0]);
          }
        }
      }

      const categorized = {
        originals: [] as string[],
        thumbnails: [] as string[],
        medium: [] as string[],
        large: [] as string[],
        pdfs: [] as string[],
        other: [] as string[]
      };

      for (const url of Array.from(usedUrls)) {
        if (url.endsWith('.pdf')) {
          categorized.pdfs.push(url);
        } else if (url.includes('-thumbnail.')) {
          categorized.thumbnails.push(url);
        } else if (url.includes('-medium.')) {
          categorized.medium.push(url);
        } else if (url.includes('-large.')) {
          categorized.large.push(url);
        } else if (url.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
          categorized.originals.push(url);
        } else {
          categorized.other.push(url);
        }
      }

      res.json({
        totalArticles: allArticles.total,
        totalUrls: usedUrls.size,
        categorized,
        summary: {
          originals: categorized.originals.length,
          variants: categorized.thumbnails.length + categorized.medium.length + categorized.large.length,
          thumbnails: categorized.thumbnails.length,
          medium: categorized.medium.length,
          large: categorized.large.length,
          pdfs: categorized.pdfs.length,
          other: categorized.other.length
        }
      });
    } catch (error) {
      console.error("Error analyzing R2 usage:", error);
      res.status(500).json({ error: "Failed to analyze R2 usage" });
    }
  });

  // Helper function to check if R2 file exists
  async function checkR2FileExists(url: string): Promise<boolean> {
    if (!r2Client) return false;
    
    try {
      const urlObj = new URL(url);
      const key = urlObj.pathname.substring(1); // Remove leading slash
      
      await r2Client.send(new HeadObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: key
      }));
      return true;
    } catch (error) {
      return false;
    }
  }

  // Standardize image URLs - replace variants with best available version
  app.post("/api/admin/standardize-image-urls", async (req, res) => {
    try {
      const allArticles = await storage.getArticles({
        status: undefined,
        limit: 100000,
        offset: 0,
        orderBy: 'publishedAt',
        orderDir: 'desc',
      });

      let articlesUpdated = 0;
      let urlsReplaced = 0;
      let usedOriginal = 0;
      let usedLarge = 0;
      let usedMedium = 0;
      let keptVariant = 0;

      // Cache for file existence checks to avoid redundant API calls
      const existsCache = new Map<string, boolean>();

      const getBestAvailableUrl = async (baseUrl: string, currentVariant: string, ext: string): Promise<string> => {
        const original = `${baseUrl}.${ext}`;
        const large = `${baseUrl}-large.${ext}`;
        const medium = `${baseUrl}-medium.${ext}`;
        const thumbnail = `${baseUrl}-thumbnail.${ext}`;
        const current = `${baseUrl}-${currentVariant}.${ext}`;

        // Check in order: original → large → medium → thumbnail → keep current
        const candidates = [
          { url: original, type: 'original' },
          { url: large, type: 'large' },
          { url: medium, type: 'medium' },
          { url: thumbnail, type: 'thumbnail' }
        ];

        for (const candidate of candidates) {
          // Skip if it's the same as current
          if (candidate.url === current) continue;

          // Check cache first
          if (!existsCache.has(candidate.url)) {
            existsCache.set(candidate.url, await checkR2FileExists(candidate.url));
          }

          if (existsCache.get(candidate.url)) {
            // Track which type we used
            if (candidate.type === 'original') usedOriginal++;
            else if (candidate.type === 'large') usedLarge++;
            else if (candidate.type === 'medium') usedMedium++;
            
            return candidate.url;
          }
        }

        // No better option found, keep current variant
        keptVariant++;
        return current;
      };

      for (const article of allArticles.articles) {
        let contentUpdated = false;
        let newContent = article.content || '';
        let newFeaturedImage = article.featuredImage;

        const _r2Escaped = R2_PUBLIC_URL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const variantPattern = new RegExp(`(${_r2Escaped}/[^"'\\s<>)]+)-(thumbnail|medium|large)\\.(jpg|jpeg|png|gif|webp)`, 'gi');
        
        // Collect all matches first to process them with async calls
        const matches: Array<{ match: string, baseUrl: string, variant: string, ext: string }> = [];
        let match;
        
        // Reset regex
        variantPattern.lastIndex = 0;
        while ((match = variantPattern.exec(newContent)) !== null) {
          matches.push({
            match: match[0],
            baseUrl: match[1],
            variant: match[2],
            ext: match[3]
          });
        }

        // Process replacements
        for (const m of matches) {
          const bestUrl = await getBestAvailableUrl(m.baseUrl, m.variant, m.ext);
          if (bestUrl !== m.match) {
            newContent = newContent.replace(m.match, bestUrl);
            contentUpdated = true;
            urlsReplaced++;
          }
        }

        // Process featured image
        if (newFeaturedImage) {
          variantPattern.lastIndex = 0;
          const featuredMatch = variantPattern.exec(newFeaturedImage);
          if (featuredMatch) {
            const bestUrl = await getBestAvailableUrl(
              featuredMatch[1], 
              featuredMatch[2], 
              featuredMatch[3]
            );
            if (bestUrl !== featuredMatch[0]) {
              newFeaturedImage = bestUrl;
              contentUpdated = true;
              urlsReplaced++;
            }
          }
        }

        // Update article if changed
        if (contentUpdated) {
          await storage.updateArticle(article.id, {
            content: newContent,
            featuredImage: newFeaturedImage
          });
          articlesUpdated++;
        }
      }

      res.json({
        success: true,
        articlesUpdated,
        urlsReplaced,
        breakdown: {
          usedOriginal,
          usedLarge,
          usedMedium,
          keptVariant
        }
      });
    } catch (error) {
      console.error("Error standardizing URLs:", error);
      res.status(500).json({ error: "Failed to standardize URLs" });
    }
  });

  // Index images from posts + largest variants
  app.post("/api/admin/index-r2-images", async (req, res) => {
    try {
      if (!r2Client) {
        return res.status(500).json({ error: "R2 client not configured" });
      }

      // Step 1: Get all R2 objects and build variant map
      const listCommand = new ListObjectsV2Command({
        Bucket: process.env.R2_BUCKET_NAME,
      });
      const r2Response = await r2Client.send(listCommand);
      const r2Objects = r2Response.Contents || [];
      const imageExtensions = /\.(jpg|jpeg|png|gif|webp)$/i;

      // Build map of all R2 images
      const r2ImageMap = new Map<string, { size: number; key: string; url: string }>();
      const variantGroups = new Map<string, Array<{ key: string; url: string; dimensions: number }>>();

      for (const obj of r2Objects) {
        if (!obj.Key || !imageExtensions.test(obj.Key)) continue;
        
        const url = getR2PublicUrl(obj.Key!);
        r2ImageMap.set(url, { size: obj.Size || 0, key: obj.Key, url });

        // Group by base name for finding largest variants
        const dimensionMatch = obj.Key.match(/^(.+?)-(\d{3,4})x(\d{3,4})\.(jpg|jpeg|png|gif|webp)$/i);
        if (dimensionMatch) {
          const baseName = `${dimensionMatch[1]}.${dimensionMatch[4]}`;
          const width = parseInt(dimensionMatch[2]);
          const height = parseInt(dimensionMatch[3]);
          const dimensions = width * height;
          
          if (!variantGroups.has(baseName)) {
            variantGroups.set(baseName, []);
          }
          variantGroups.get(baseName)!.push({ key: obj.Key, url, dimensions });
        }
      }

      // Step 2: Find all images used in posts
      const allArticles = await storage.getArticles({
        status: undefined,
        limit: 100000,
        offset: 0,
        orderBy: 'publishedAt',
        orderDir: 'desc',
      });

      const usedImageUrls = new Set<string>();
      const r2Pattern = /https:\/\/pub-[a-f0-9]+\.r2\.dev\/[^\s"'<>]+\.(jpg|jpeg|png|gif|webp)/gi;

      for (const article of allArticles.articles) {
        // Extract from content
        const contentMatches = article.content?.match(r2Pattern) || [];
        contentMatches.forEach(url => usedImageUrls.add(url));

        // Add featured image
        if (article.featuredImage && isR2Url(article.featuredImage)) {
          usedImageUrls.add(article.featuredImage);
        }
      }

      // Step 3: Get already indexed media
      const allMedia = await storage.getAllMedia();
      const indexedUrls = new Set(allMedia.media.map(m => m.objectPath));

      // Step 4: Index used images + their largest variants (even if referenced image is missing)
      let indexedFromPosts = 0;
      let indexedLargestVariants = 0;
      let foundMissingImageVariants = 0;
      const toIndex = new Set<string>();

      // Add all used images that exist
      for (const url of Array.from(usedImageUrls)) {
        if (!indexedUrls.has(url) && r2ImageMap.has(url)) {
          toIndex.add(url);
        }
      }

      // For each referenced URL (even if missing), look for variants
      for (const url of Array.from(usedImageUrls)) {
        // Extract R2 key from URL (path after the domain)
        const urlMatch = url.match(/https:\/\/pub-[a-f0-9]+\.r2\.dev\/(.+)$/i);
        if (!urlMatch) continue;
        
        const key = urlMatch[1]; // e.g., "2024/05/photo-1500x1000.jpg"
        const dimensionMatch = key.match(/^(.+?)-(\d{3,4})x(\d{3,4})\.(jpg|jpeg|png|gif|webp)$/i);
        
        if (dimensionMatch) {
          const baseName = `${dimensionMatch[1]}.${dimensionMatch[4]}`; // e.g., "2024/05/photo.jpg"
          const variants = variantGroups.get(baseName) || [];
          
          if (variants.length > 0) {
            // Find largest by dimensions
            const largest = variants.reduce((max, v) => v.dimensions > max.dimensions ? v : max);
            if (!indexedUrls.has(largest.url)) {
              toIndex.add(largest.url);
              
              // Track if we found a variant for a missing image
              if (!r2ImageMap.has(url)) {
                foundMissingImageVariants++;
              }
            }
          }
        }
      }

      // Create media records
      for (const url of Array.from(toIndex)) {
        const imageData = r2ImageMap.get(url);
        if (!imageData) continue;

        const filename = imageData.key.split('/').pop() || imageData.key;
        const ext = imageData.key.split('.').pop()?.toLowerCase();
        const mimeType = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' :
                        ext === 'png' ? 'image/png' :
                        ext === 'gif' ? 'image/gif' :
                        ext === 'webp' ? 'image/webp' : 'image/jpeg';

        await storage.createMedia({
          filename,
          originalName: filename,
          mimeType,
          size: imageData.size,
          objectPath: url,
          variants: { original: url }
        });

        if (usedImageUrls.has(url)) {
          indexedFromPosts++;
        } else {
          indexedLargestVariants++;
        }
      }

      res.json({
        success: true,
        imagesInPosts: usedImageUrls.size,
        indexedFromPosts,
        indexedLargestVariants,
        foundMissingImageVariants,
        totalIndexed: toIndex.size,
        alreadyIndexed: indexedUrls.size,
      });
    } catch (error) {
      console.error("Error indexing R2 images:", error);
      res.status(500).json({ error: "Failed to index R2 images" });
    }
  });

  // Clean up unused R2 variants
  app.post("/api/admin/cleanup-r2-variants", async (req, res) => {
    try {
      if (!r2Client) {
        return res.status(500).json({ error: "R2 client not configured" });
      }

      const { variantTypes } = req.body; // ['thumbnail', 'medium', 'large']
      
      if (!Array.isArray(variantTypes) || variantTypes.length === 0) {
        return res.status(400).json({ error: "Please specify variant types to delete" });
      }

      // List all R2 objects
      const listCommand = new ListObjectsV2Command({
        Bucket: process.env.R2_BUCKET_NAME,
      });

      const response = await r2Client.send(listCommand);
      const objects = response.Contents || [];

      const toDelete: string[] = [];

      for (const obj of objects) {
        if (!obj.Key) continue;

        // Skip PDFs
        if (obj.Key.endsWith('.pdf')) continue;

        // Check if it's a variant to delete
        for (const variant of variantTypes) {
          if (obj.Key.includes(`-${variant}.`)) {
            toDelete.push(obj.Key);
            break;
          }
        }
      }

      // Delete in batches
      let deleted = 0;
      const batchSize = 1000; // R2 allows up to 1000 deletes per request

      for (let i = 0; i < toDelete.length; i += batchSize) {
        const batch = toDelete.slice(i, i + batchSize);
        
        const deleteCommand = new DeleteObjectsCommand({
          Bucket: process.env.R2_BUCKET_NAME,
          Delete: {
            Objects: batch.map(key => ({ Key: key })),
            Quiet: false
          }
        });

        await r2Client.send(deleteCommand);
        deleted += batch.length;
      }

      res.json({
        success: true,
        variantTypesDeleted: variantTypes,
        filesDeleted: deleted,
        totalScanned: objects.length
      });
    } catch (error) {
      console.error("Error cleaning up R2 variants:", error);
      res.status(500).json({ error: "Failed to cleanup R2 variants" });
    }
  });

  // Debug: Check R2 storage for specific folder
  app.get("/api/debug/r2-check", async (req, res) => {
    try {
      const prefix = req.query.prefix as string || '2011/';
      const command = new ListObjectsV2Command({
        Bucket: process.env.R2_BUCKET_NAME,
        Prefix: prefix,
        MaxKeys: 10
      });
      const data = await r2Client.send(command);
      res.json({
        prefix,
        count: data.Contents?.length || 0,
        files: data.Contents?.map(f => f.Key) || []
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Find largest variant of an image in R2
  async function findLargestVariantInR2(imagePath: string): Promise<string | null> {
    try {
      // Extract base name by removing size suffix patterns like -150x150, -300x426, etc.
      const baseName = imagePath.replace(/-\d+x\d+(\.(jpg|jpeg|png|gif|webp))?$/i, '$1');
      
      // Extract directory and filename
      const lastSlash = baseName.lastIndexOf('/');
      const dir = lastSlash > 0 ? baseName.substring(0, lastSlash + 1) : '';
      const filename = lastSlash > 0 ? baseName.substring(lastSlash + 1) : baseName;
      
      // Remove extension to get base filename
      const filenameParts = filename.split('.');
      const ext = filenameParts.length > 1 ? '.' + filenameParts.pop() : '';
      const baseFilename = filenameParts.join('.');
      
      // List all variants in the directory
      const listCommand = new ListObjectsV2Command({
        Bucket: process.env.R2_BUCKET_NAME,
        Prefix: dir,
        MaxKeys: 1000
      });
      
      const data = await r2Client.send(listCommand);
      const variants = data.Contents?.filter(obj => {
        const key = obj.Key || '';
        const keyFilename = key.substring(key.lastIndexOf('/') + 1);
        return keyFilename.startsWith(baseFilename) && keyFilename.endsWith(ext);
      }) || [];
      
      if (variants.length === 0) return null;
      
      // Find the largest variant by size (original has no dimensions in name)
      let largest = variants[0];
      for (const variant of variants) {
        const key = variant.Key || '';
        // Prefer files without dimension suffix (original)
        if (!key.match(/-\d+x\d+\.(jpg|jpeg|png|gif|webp)$/i)) {
          largest = variant;
          break;
        }
        // Otherwise compare sizes
        if ((variant.Size || 0) > (largest.Size || 0)) {
          largest = variant;
        }
      }
      
      return largest.Key || null;
    } catch (error) {
      console.error('Error finding variant:', error);
      return null;
    }
  }

  // Normalize image URL/path to R2 object key
  function normalizeToR2Key(urlOrPath: string): string | null {
    try {
      // Handle old WordPress domain URLs (gallerymagazine.co.uk/v3/wp-content/YEAR/...)
      // Extract everything from the year onwards
      const wpDomainMatch = urlOrPath.match(/(?:gallerymagazine\.co\.uk|v3)\/wp-content\/(\d{4}\/.+)/i);
      if (wpDomainMatch) {
        return wpDomainMatch[1]; // Return YEAR/month/file.jpg
      }
      
      // Handle /objects/../wp-content/ paths
      if (urlOrPath.startsWith('/objects/../')) {
        const path = urlOrPath.replace('/objects/../', '');
        return path.replace(/^wp-content\//, '');
      }
      
      // Handle /objects/ paths
      if (urlOrPath.startsWith('/objects/')) {
        const path = urlOrPath.replace('/objects/', '');
        return path.replace(/^wp-content\//, '');
      }
      
      // Handle full GCS URLs
      if (urlOrPath.includes('storage.googleapis.com')) {
        const url = new URL(urlOrPath);
        const pathParts = url.pathname.split('/').filter(p => p);
        // Skip bucket name (first part) and remove wp-content prefix
        const path = pathParts.slice(1).join('/');
        return path.replace(/^wp-content\//, '');
      }
      
      // Handle R2 URLs (already correct, extract key)
      if (isR2Url(urlOrPath)) {
        return extractR2Key(urlOrPath) || new URL(urlOrPath).pathname.substring(1);
      }
      
      // Handle wp-content/ URLs with year pattern
      const wpContentMatch = urlOrPath.match(/wp-content\/(\d{4}\/.+)/i);
      if (wpContentMatch) {
        return wpContentMatch[1]; // Return YEAR/month/file.jpg
      }
      
      // Handle relative paths
      if (urlOrPath.startsWith('/')) {
        return urlOrPath.substring(1).replace(/^wp-content\//, '');
      }
      
      // Direct path
      return urlOrPath.replace(/^wp-content\//, '');
    } catch (error) {
      console.error('Error normalizing path:', urlOrPath, error);
      return null;
    }
  }

  // Connect articles to R2 storage with variant fallback
  // WordPress formatting cleanup
  app.post("/api/articles/cleanup-wordpress", async (req, res) => {
    try {
      const options = req.body;
      
      const allArticles = await storage.getArticles({ 
        status: 'all', 
        limit: 10000,
        offset: 0 
      });
      
      const results = {
        articlesProcessed: 0,
        articlesUpdated: 0,
        classesRemoved: 0,
        stylesRemoved: 0,
        shortcodesRemoved: 0,
        emptyTagsRemoved: 0,
      };
      
      for (const article of allArticles.articles) {
        let content = article.content;
        const originalContent = content;
        let stats = {
          classes: 0,
          styles: 0,
          shortcodes: 0,
          emptyTags: 0,
        };
        
        results.articlesProcessed++;
        
        // Remove WordPress CSS classes
        if (options.removeWpClasses) {
          const classPatterns = [
            /\s*class="[^"]*\b(wp-[^\s"]+)[^"]*"/gi,
            /\s*class="[^"]*\b(align(?:left|right|center|none))[^"]*"/gi,
            /\s*class="[^"]*\b(size-(?:full|large|medium|thumbnail))[^"]*"/gi,
            /\s*class="[^"]*\b(has-[^\s"]+)[^"]*"/gi,
            /\s*class="[^"]*\b(attachment-[^\s"]+)[^"]*"/gi,
          ];
          
          for (const pattern of classPatterns) {
            const matches = content.match(pattern);
            if (matches) {
              stats.classes += matches.length;
              content = content.replace(pattern, (match) => {
                // Extract and rebuild class attribute without WP classes
                const classMatch = match.match(/class="([^"]*)"/);
                if (!classMatch) return match;
                
                const classes = classMatch[1].split(/\s+/).filter(cls => {
                  return !cls.match(/^(wp-|align(?:left|right|center|none)|size-|has-|attachment-)/);
                });
                
                return classes.length > 0 ? ` class="${classes.join(' ')}"` : '';
              });
            }
          }
          
          // Remove empty class attributes
          content = content.replace(/\s*class=""\s*/g, ' ');
        }
        
        // Remove inline styles (except text-align)
        if (options.removeInlineStyles) {
          const stylePattern = /\s*style="([^"]*)"/gi;
          const matches = content.match(stylePattern);
          if (matches) {
            content = content.replace(stylePattern, (match, styles) => {
              // Keep only text-align
              const textAlign = styles.match(/text-align:\s*[^;]+/);
              if (textAlign) {
                return ` style="${textAlign[0]}"`;
              }
              stats.styles++;
              return '';
            });
          }
        }
        
        // Remove WordPress shortcodes
        if (options.removeShortcodes) {
          // First, handle paired shortcodes (keep content for caption)
          const pairedShortcodes = [
            { pattern: /\[caption[^\]]*\]([\s\S]*?)\[\/caption\]/gi, keepContent: true },
            { pattern: /\[embed[^\]]*\]([\s\S]*?)\[\/embed\]/gi, keepContent: false },
            // Generic paired shortcode pattern
            { pattern: /\[([a-zA-Z_][a-zA-Z0-9_-]*)[^\]]*\]([\s\S]*?)\[\/\1\]/gi, keepContent: false },
          ];
          
          for (const { pattern, keepContent } of pairedShortcodes) {
            const matches = content.match(pattern);
            if (matches) {
              stats.shortcodes += matches.length;
              if (keepContent) {
                content = content.replace(pattern, '$1');
              } else {
                content = content.replace(pattern, '');
              }
            }
          }
          
          // Then handle self-closing and unpaired shortcodes
          const singleShortcodes = [
            /\[gallery[^\]]*\]/gi,
            /\[[a-zA-Z_][a-zA-Z0-9_-]*[^\]]*\]/g,  // Opening tags
            /\[\/[a-zA-Z_][a-zA-Z0-9_-]*\]/g,      // Closing tags (cleanup orphans)
          ];
          
          for (const pattern of singleShortcodes) {
            const matches = content.match(pattern);
            if (matches) {
              stats.shortcodes += matches.length;
              content = content.replace(pattern, '');
            }
          }
        }
        
        // Remove empty HTML tags
        if (options.removeEmptyTags) {
          const emptyTagPatterns = [
            /<p[^>]*>\s*<\/p>/gi,
            /<span[^>]*>\s*<\/span>/gi,
            /<div[^>]*>\s*<\/div>/gi,
            /<strong[^>]*>\s*<\/strong>/gi,
            /<em[^>]*>\s*<\/em>/gi,
          ];
          
          for (const pattern of emptyTagPatterns) {
            const matches = content.match(pattern);
            if (matches) {
              stats.emptyTags += matches.length;
              content = content.replace(pattern, '');
            }
          }
        }
        
        // Normalize whitespace
        if (options.normalizeWhitespace) {
          // Remove excessive line breaks (more than 2)
          content = content.replace(/(\r?\n){3,}/g, '\n\n');
          // Remove trailing whitespace
          content = content.replace(/[ \t]+$/gm, '');
          // Remove excessive spaces
          content = content.replace(/[ ]{2,}/g, ' ');
        }
        
        // Update article if content changed
        if (content !== originalContent) {
          await storage.updateArticle(article.id, { content });
          results.articlesUpdated++;
          results.classesRemoved += stats.classes;
          results.stylesRemoved += stats.styles;
          results.shortcodesRemoved += stats.shortcodes;
          results.emptyTagsRemoved += stats.emptyTags;
        }
      }
      
      res.json(results);
    } catch (error: any) {
      console.error("Error cleaning WordPress formatting:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/media/connect-to-r2", async (req, res) => {
    try {
      const allArticles = await storage.getArticles({ 
        status: 'all', 
        limit: 10000,
        offset: 0 
      });
      
      const results = {
        articlesScanned: allArticles.articles.length,
        imagesFound: 0,
        imagesReplaced: 0,
        variantsUsed: 0,
        skipped: 0,
        updates: [] as any[]
      };
      
      // Helper: resolve a single URL to R2, returns r2Url string or null
      const resolveToR2 = async (originalUrl: string): Promise<string | null> => {
        const r2Key = normalizeToR2Key(originalUrl);
        if (!r2Key) return null;
        let finalKey = r2Key;
        try {
          const headCommand = new HeadObjectCommand({
            Bucket: process.env.R2_BUCKET_NAME,
            Key: r2Key
          });
          await r2Client.send(headCommand);
        } catch {
          const variantKey = await findLargestVariantInR2(r2Key);
          if (variantKey) {
            finalKey = variantKey;
            results.variantsUsed++;
          } else {
            results.skipped++;
            return null;
          }
        }
        return `${R2_PUBLIC_URL}/${finalKey}`;
      }

      for (const article of allArticles.articles) {
        let content = article.content;
        let featuredImage = article.featuredImage || '';
        let updated = false;

        // --- Fix featured image ---
        const isNonR2Featured = featuredImage &&
          !isR2Url(featuredImage) &&
          (featuredImage.includes('gallerymagazine.co.uk') ||
           featuredImage.includes('gallery.je') ||
           featuredImage.includes('storage.googleapis.com') ||
           featuredImage.startsWith('/objects/'));

        if (isNonR2Featured) {
          results.imagesFound++;
          const r2Url = await resolveToR2(featuredImage);
          if (r2Url) {
            featuredImage = r2Url;
            updated = true;
            results.imagesReplaced++;
          }
        }

        // --- Fix content images ---
        const patterns = [
          /https?:\/\/(?:www\.)?gallerymagazine\.co\.uk\/[^"'\s]+\.(jpg|jpeg|png|gif|webp)/gi,
          /https?:\/\/(?:www\.)?gallery\.je\/[^"'\s]+\.(jpg|jpeg|png|gif|webp)/gi,
          /https?:\/\/storage\.googleapis\.com\/[^"'\s]+\.(jpg|jpeg|png|gif|webp)/gi,
          /\/objects\/\.\.\/[^"'\s]+\.(jpg|jpeg|png|gif|webp)/gi,
          /\/objects\/[^"'\s]+\.(jpg|jpeg|png|gif|webp)/gi,
        ];
        
        const imageMatches: string[] = [];
        for (const pattern of patterns) {
          const matches = Array.from(content.matchAll(pattern));
          imageMatches.push(...matches.map(m => m[0]));
        }
        
        const uniqueImages = Array.from(new Set(imageMatches));
        
        for (const originalMatch of uniqueImages) {
          results.imagesFound++;
          const r2Url = await resolveToR2(originalMatch);
          if (!r2Url) continue;
          const escapedMatch = originalMatch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          content = content.replace(new RegExp(escapedMatch, 'g'), r2Url);
          updated = true;
          results.imagesReplaced++;
        }
        
        // Update article if anything changed
        if (updated) {
          await storage.updateArticle(article.id, { content, featuredImage });
          results.updates.push({
            articleId: article.id,
            title: article.title
          });
        }
      }
      
      res.json(results);
    } catch (error: any) {
      console.error("Error connecting to R2:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // WordPress REST API Live Sync (SSE streaming)
  app.get("/api/wp-sync/stream", async (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');

    const send = (data: object) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    const WP_API = 'https://www.gallery.je/wp-json/wp/v2';
    const afterDate = (req.query.after as string) || '2025-10-08T00:00:00';

    try {
      send({ type: 'progress', message: 'Fetching WordPress categories...' });
      const wpCatsRes = await fetch(`${WP_API}/categories?per_page=100`);
      const wpCats: any[] = await wpCatsRes.json();
      const wpCatMap = new Map<number, { name: string; slug: string }>();
      for (const cat of wpCats) wpCatMap.set(cat.id, { name: cat.name, slug: cat.slug });

      send({ type: 'progress', message: 'Fetching WordPress tags...' });
      const wpTagsRes = await fetch(`${WP_API}/tags?per_page=100`);
      const wpTags: any[] = await wpTagsRes.json();
      const wpTagMap = new Map<number, { name: string; slug: string }>();
      for (const tag of wpTags) wpTagMap.set(tag.id, { name: tag.name, slug: tag.slug });

      send({ type: 'progress', message: 'Fetching WordPress authors...' });
      const wpUsersRes = await fetch(`${WP_API}/users?per_page=100`);
      const wpUserMap = new Map<number, string>();
      if (wpUsersRes.ok) {
        const wpUsers: any[] = await wpUsersRes.json();
        for (const u of wpUsers) wpUserMap.set(u.id, u.name);
      }

      send({ type: 'progress', message: 'Fetching new posts from gallery.je...' });
      let page = 1;
      const allPosts: any[] = [];
      while (true) {
        const postsRes = await fetch(
          `${WP_API}/posts?per_page=100&after=${afterDate}&page=${page}&orderby=date&order=asc&_embed=wp:featuredmedia`
        );
        if (!postsRes.ok) break;
        const posts: any[] = await postsRes.json();
        if (!posts.length) break;
        allPosts.push(...posts);
        const total = parseInt(postsRes.headers.get('x-wp-total') || '0');
        if (allPosts.length >= total) break;
        page++;
      }

      send({ type: 'total', total: allPosts.length, message: `Found ${allPosts.length} new posts` });

      const results = { imported: 0, skipped: 0, imagesUploaded: 0, errors: [] as string[] };
      const categoryCache = new Map<string, string>();
      const tagCache = new Map<string, string>();
      const authorCache = new Map<string, string>();

      const downloadAndUploadToR2 = async (imageUrl: string): Promise<string | null> => {
        try {
          const urlObj = new URL(imageUrl);
          const match = urlObj.pathname.match(/\/wp-content\/uploads\/(\d{4}\/\d{2}\/.+)/);
          const key = match ? `wp-content/${match[1]}` : `wp-content/synced${urlObj.pathname}`;

          try {
            await r2Client.send(new HeadObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: key }));
            return `${R2_PUBLIC_URL}/${key}`;
          } catch { /* not in R2 yet */ }

          const imgRes = await fetch(imageUrl, {
            signal: AbortSignal.timeout(30000),
            headers: {
              'User-Agent': 'Mozilla/5.0 (compatible; GalleryCMS/1.0)',
              'Accept': 'image/webp,image/jpeg,image/png,image/*',
            },
          } as any);
          if (!imgRes.ok) return null;
          const buffer = Buffer.from(await imgRes.arrayBuffer());
          const contentType = imgRes.headers.get('content-type') || 'image/jpeg';
          await uploadToR2(buffer, key, contentType);
          results.imagesUploaded++;
          return `${R2_PUBLIC_URL}/${key}`;
        } catch (e) {
          return null;
        }
      }

      for (let i = 0; i < allPosts.length; i++) {
        const post = allPosts[i];
        try {
          const existing = await storage.getArticleByWpId(post.id);
          if (existing) {
            results.skipped++;
            send({ type: 'post', index: i + 1, total: allPosts.length, title: post.title?.rendered, status: 'skipped' });
            continue;
          }

          send({ type: 'post', index: i + 1, total: allPosts.length, title: post.title?.rendered, status: 'processing' });

          // Resolve author
          const authorName = wpUserMap.get(post.author) || 'Gallery Team';
          let authorDbId = authorCache.get(authorName);
          if (!authorDbId) {
            const authorEmail = `${authorName.toLowerCase().replace(/[^a-z0-9]/g, '.')}@imported.local`;
            let author = await storage.getAuthorByEmail(authorEmail);
            if (!author) author = await storage.createAuthor({ name: authorName, email: authorEmail, bio: '' });
            authorDbId = author.id;
            authorCache.set(authorName, authorDbId);
          }

          // Resolve category
          const wpCat = post.categories?.[0] ? wpCatMap.get(post.categories[0]) : null;
          const catSlug = wpCat?.slug || 'uncategorised';
          const catName = wpCat?.name || 'Uncategorised';
          let categoryDbId = categoryCache.get(catSlug);
          if (!categoryDbId) {
            let cat = await storage.getCategoryBySlug(catSlug);
            if (!cat) cat = await storage.createCategory({ name: catName, slug: catSlug, color: '#3B82F6' });
            categoryDbId = cat.id;
            categoryCache.set(catSlug, categoryDbId);
          }

          // Resolve tags
          const tagDbIds: string[] = [];
          for (const wpTagId of (post.tags || [])) {
            const wpTag = wpTagMap.get(wpTagId);
            if (!wpTag) continue;
            let tagDbId = tagCache.get(wpTag.slug);
            if (!tagDbId) {
              let tag = await storage.getTagBySlug(wpTag.slug);
              if (!tag) tag = await storage.createTag({ name: wpTag.name, slug: wpTag.slug });
              tagDbId = tag.id;
              tagCache.set(wpTag.slug, tagDbId);
            }
            tagDbIds.push(tagDbId);
          }

          // Fetch & upload featured image (use _embed data to avoid separate /media/{id} call which 404s)
          let featuredImageUrl = '';
          const embeddedMedia = post._embedded?.['wp:featuredmedia']?.[0];
          const featuredSourceUrl = embeddedMedia?.source_url || embeddedMedia?.guid?.rendered;
          if (featuredSourceUrl) {
            const r2Url = await downloadAndUploadToR2(featuredSourceUrl);
            if (r2Url) featuredImageUrl = r2Url;
          }

          // Process content: download & replace image URLs
          let content = post.content?.rendered || '';
          const imgPattern = /https?:\/\/(?:www\.)?gallery\.je\/wp-content\/uploads\/[^"'\s<>]+\.(?:jpg|jpeg|png|gif|webp)/gi;
          const imgUrls = Array.from(new Set(content.match(imgPattern) || [])) as string[];
          for (const imgUrl of imgUrls) {
            const r2Url = await downloadAndUploadToR2(imgUrl);
            if (r2Url) content = content.split(imgUrl).join(r2Url);
          }

          // Clean up title HTML entities
          const title = (post.title?.rendered || 'Untitled')
            .replace(/&amp;/g, '&').replace(/&#8211;/g, '–')
            .replace(/&#8217;/g, "'").replace(/&#8220;/g, '"').replace(/&#8221;/g, '"');

          const excerpt = (post.excerpt?.rendered || '').replace(/<[^>]*>/g, '').substring(0, 500);

          // Ensure unique slug
          let slug = post.slug;
          const slugExists = await storage.getArticleBySlug(slug);
          if (slugExists) slug = `${slug}-${post.id}`;

          await storage.createArticle({
            title,
            slug,
            excerpt,
            content,
            featuredImage: featuredImageUrl || undefined,
            status: 'published',
            authorId: authorDbId!,
            categoryId: categoryDbId!,
            publishedAt: new Date(post.date),
            readTime: Math.max(1, Math.ceil(content.length / 1000)),
            wpId: post.id,
            wpData: { originalLink: post.link, originalStatus: post.status },
          }, tagDbIds);

          results.imported++;
          send({ type: 'post', index: i + 1, total: allPosts.length, title, status: 'done' });
        } catch (err: any) {
          const errMsg = err instanceof Error ? err.message : 'Unknown error';
          results.errors.push(`Post ${post.id}: ${errMsg}`);
          send({ type: 'post', index: i + 1, total: allPosts.length, title: post.title?.rendered, status: 'error', error: errMsg });
        }
      }

      send({ type: 'complete', results });
      res.end();
    } catch (err: any) {
      send({ type: 'error', message: err.message });
      res.end();
    }
  });

  // ── Issues / Archive ─────────────────────────────────────────────────────────

  // GET all issues
  app.get("/api/issues", async (_req, res) => {
    try {
      const rows = await db.select().from(issues).orderBy(issues.number);
      res.json({ issues: rows });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET single issue
  app.get("/api/issues/:number", async (req, res) => {
    try {
      const num = parseInt(req.params.number, 10);
      const [row] = await db.select().from(issues).where(sql`${issues.number} = ${num}`);
      if (!row) return res.status(404).json({ error: "Issue not found" });
      res.json({ issue: row });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST cover image for an issue (upload to R2)
  app.post("/api/issues/:number/cover", upload.single("cover"), async (req, res) => {
    try {
      const num = parseInt(req.params.number, 10);
      if (!req.file) return res.status(400).json({ error: "No file provided" });
      if (!req.file.mimetype.startsWith("image/")) {
        return res.status(400).json({ error: "File must be an image" });
      }

      const ext = req.file.mimetype === "image/png" ? "png" : "jpg";
      const key = `covers/gallery-${num}.${ext}`;
      await uploadToR2(req.file.buffer, key, req.file.mimetype);
      const coverImage = getR2PublicUrl(key);

      await db.execute(sql`
        INSERT INTO issues (number, title, cover_image)
        VALUES (${num}, ${'Gallery #' + num}, ${coverImage})
        ON CONFLICT (number) DO UPDATE SET cover_image = ${coverImage}
      `);

      res.json({ coverImage });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST sync cover images from R2 covers/ folder
  app.post("/api/issues/sync-covers", async (_req, res) => {
    try {
      const { ListObjectsV2Command: ListCmd } = await import("@aws-sdk/client-s3");
      const listResp = await r2Client.send(new ListCmd({
        Bucket: process.env.R2_BUCKET_NAME,
        Prefix: "covers/",
      }));
      const objects = listResp.Contents || [];
      let synced = 0;
      const patterns = [
        /gallery[-_\s]?(\d{2,3})/i,
        /issue[-_\s]?(\d{2,3})/i,
        /^g?(\d{2,3})\.(jpg|jpeg|png|webp)$/i,
        /[-_\s](\d{2,3})\.(jpg|jpeg|png|webp)$/i,
        /(\d{2,3})/,
      ];
      for (const obj of objects) {
        if (!obj.Key) continue;
        const filename = obj.Key.split("/").pop() || "";
        if (!/\.(jpg|jpeg|png|webp)$/i.test(filename)) continue;
        let issueNum: number | null = null;
        for (const re of patterns) {
          const m = filename.match(re);
          if (m) { issueNum = parseInt(m[1], 10); break; }
        }
        if (!issueNum || issueNum < 1 || issueNum > 999) continue;
        const coverImage = getR2PublicUrl(obj.Key);
        await db.execute(sql`
          INSERT INTO issues (number, title, cover_image)
          VALUES (${issueNum}, ${'Gallery #' + issueNum}, ${coverImage})
          ON CONFLICT (number) DO UPDATE SET cover_image = ${coverImage}
        `);
        synced++;
      }
      res.json({ synced });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST PDF for an issue (upload to R2)
  app.post("/api/issues/:number/pdf", upload.single("pdf"), async (req, res) => {
    try {
      const num = parseInt(req.params.number, 10);
      if (!req.file) return res.status(400).json({ error: "No file provided" });
      if (req.file.mimetype !== "application/pdf") {
        return res.status(400).json({ error: "File must be a PDF" });
      }

      const key = `pdfs/gallery-${num}.pdf`;
      await uploadToR2(req.file.buffer, key, "application/pdf");
      const pdfUrl = getR2PublicUrl(key);

      await db.update(issues)
        .set({ pdfUrl })
        .where(sql`${issues.number} = ${num}`);

      // Upsert if issue row doesn't exist yet
      await db.execute(sql`
        INSERT INTO issues (number, title, pdf_url)
        VALUES (${num}, ${'Gallery #' + num}, ${pdfUrl})
        ON CONFLICT (number) DO UPDATE SET pdf_url = ${pdfUrl}
      `);

      res.json({ pdfUrl });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST sync PDFs from R2 (scans pdfs/ and gallery_pdf_archive/ prefixes)
  app.post("/api/issues/sync-r2", async (_req, res) => {
    try {
      const { ListObjectsV2Command: ListCmd } = await import("@aws-sdk/client-s3");
      const prefixes = ["pdfs/", "gallery_pdf_archive/"];
      const patterns = [
        /^gj_?(\d{1,3})[_\s]/i,          // gj8_... gj100_...
        /gallery[-_\s]?(\d{1,3})/i,
        /issue[-_\s]?(\d{1,3})/i,
        /^g?j?(\d{1,3})\.pdf$/i,
        /[-_\s](\d{1,3})\.pdf$/i,
        /(\d{1,3})/,
      ];
      let synced = 0;
      for (const prefix of prefixes) {
        let token: string | undefined;
        do {
          const listResp = await r2Client.send(new ListCmd({
            Bucket: process.env.R2_BUCKET_NAME,
            Prefix: prefix,
            ContinuationToken: token,
          }));
          for (const obj of listResp.Contents || []) {
            if (!obj.Key) continue;
            const filename = obj.Key.split("/").pop() || "";
            if (!filename.toLowerCase().endsWith(".pdf")) continue;
            let issueNum: number | null = null;
            for (const re of patterns) {
              const m = filename.match(re);
              if (m) {
                const n = parseInt(m[1], 10);
                if (n >= 1 && n <= 999) { issueNum = n; break; }
              }
            }
            if (!issueNum) continue;
            const pdfUrl = getR2PublicUrl(obj.Key);
            await db.execute(sql`
              INSERT INTO issues (number, title, pdf_url)
              VALUES (${issueNum}, ${'Gallery #' + issueNum}, ${pdfUrl})
              ON CONFLICT (number) DO UPDATE SET pdf_url = ${pdfUrl}
            `);
            synced++;
          }
          token = listResp.NextContinuationToken;
        } while (token);
      }
      res.json({ synced });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // DELETE PDF for an issue
  app.delete("/api/issues/:number/pdf", async (req, res) => {
    try {
      const num = parseInt(req.params.number, 10);
      await db.update(issues)
        .set({ pdfUrl: null })
        .where(sql`${issues.number} = ${num}`);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- Contributors ---

  app.get("/api/contributors", async (req, res) => {
    try {
      const { issueNumber, search } = req.query;
      // Join authors so the canonical profile (bio, photo, default_role)
      // wins over the row's legacy columns.
      const conditions: any[] = [];
      if (issueNumber) conditions.push(eq(issueContributors.issueNumber, Number(issueNumber)));
      if (search) conditions.push(sql`${issueContributors.name} ilike ${'%' + search + '%'}`);
      const rows = await db
        .select({
          id: issueContributors.id,
          issueNumber: issueContributors.issueNumber,
          authorId: issueContributors.authorId,
          name: sql<string>`coalesce(${authors.name}, ${issueContributors.name})`,
          bio: sql<string | null>`coalesce(${authors.bio}, ${issueContributors.bio})`,
          photoUrl: sql<string | null>`coalesce(${authors.photoUrl}, ${authors.avatar}, ${issueContributors.photoUrl})`,
          pageRef: issueContributors.pageRef,
          role: issueContributors.role,
        })
        .from(issueContributors)
        .leftJoin(authors, eq(authors.id, issueContributors.authorId))
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(asc(issueContributors.issueNumber), asc(issueContributors.name));
      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/contributors/issues", async (_req, res) => {
    try {
      const rows = await db
        .selectDistinct({ issueNumber: issueContributors.issueNumber })
        .from(issueContributors)
        .orderBy(desc(issueContributors.issueNumber));
      res.json(rows.map(r => r.issueNumber));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/contributors", async (req, res) => {
    try {
      const { issueNumber, authorId: authorIdInput, name, bio, pageRef, role, photoUrl } = req.body;
      if (!issueNumber || !name) return res.status(400).json({ error: "issueNumber and name required" });

      // Resolve author: explicit authorId wins; else find existing author by
      // case-insensitive name; else create a new author row.
      let authorId: string | null = authorIdInput || null;
      if (!authorId) {
        const trimmed = String(name).trim();
        const found = await db
          .select({ id: authors.id })
          .from(authors)
          .where(sql`lower(trim(${authors.name})) = lower(trim(${trimmed}))`)
          .limit(1);
        if (found.length > 0) {
          authorId = found[0].id;
        } else {
          const [created] = await db
            .insert(authors)
            .values({ name: trimmed, bio: bio || null, photoUrl: photoUrl || null, defaultRole: role || null })
            .returning({ id: authors.id });
          authorId = created.id;
        }
      }

      const [row] = await db
        .insert(issueContributors)
        .values({ issueNumber: Number(issueNumber), authorId, name, bio, pageRef, role, photoUrl })
        .returning();
      res.json(row);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put("/api/contributors/:id", async (req, res) => {
    try {
      const { name, bio, pageRef, role, photoUrl, authorId } = req.body;
      const [row] = await db.update(issueContributors)
        .set({ name, bio, pageRef, role, photoUrl, ...(authorId !== undefined && { authorId }) })
        .where(eq(issueContributors.id, req.params.id))
        .returning();
      // Mirror profile-level changes (bio / photo) to the linked author row
      if (row?.authorId && (bio !== undefined || photoUrl !== undefined || name !== undefined)) {
        await db
          .update(authors)
          .set({
            ...(name !== undefined && { name }),
            ...(bio !== undefined && { bio }),
            ...(photoUrl !== undefined && { photoUrl }),
          })
          .where(eq(authors.id, row.authorId));
      }
      res.json(row);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/contributors/:id", async (req, res) => {
    try {
      await db.delete(issueContributors).where(eq(issueContributors.id, req.params.id));
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/contributors/issue/:number", async (req, res) => {
    try {
      const num = parseInt(req.params.number, 10);
      await db.delete(issueContributors).where(eq(issueContributors.issueNumber, num));
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Trigger PDF extraction for one or all issues (runs Python script)
  app.post("/api/contributors/extract", async (req, res) => {
    try {
      const { issueNumber } = req.body;
      const { spawn } = await import('child_process');
      const args = ['scripts/extract_contributors.py'];
      if (issueNumber) args.push(String(issueNumber));
      const proc = spawn('python3', args, { cwd: process.cwd() });
      let out = '', err = '';
      proc.stdout.on('data', d => { out += d; });
      proc.stderr.on('data', d => { err += d; });
      proc.on('close', code => {
        if (code === 0) {
          try { res.json(JSON.parse(out)); }
          catch { res.json({ ok: true, output: out }); }
        } else {
          res.status(500).json({ error: err || 'Script failed', output: out });
        }
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ===========================================================================
  // Subscribers (newsletter)
  // ===========================================================================

  // Public signup — used by Footer/Sidebar forms
  app.post("/api/subscribers", async (req, res) => {
    try {
      const data = insertSubscriberSchema.parse({
        email: req.body.email,
        name: req.body.name,
        source: req.body.source || "web",
      });
      const sub = await storage.createSubscriber(data);
      res.json({ ok: true, subscriber: { id: sub.id, email: sub.email } });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid email", details: err.errors });
      }
      console.error("Subscribe failed:", err);
      res.status(500).json({ error: "Subscribe failed" });
    }
  });

  // Admin list
  app.get("/api/admin/subscribers", async (req, res) => {
    try {
      const activeOnly = req.query.activeOnly === "true";
      const limit = req.query.limit ? Number(req.query.limit) : 500;
      const offset = req.query.offset ? Number(req.query.offset) : 0;
      const result = await storage.listSubscribers({ activeOnly, limit, offset });
      res.json(result);
    } catch (err) {
      console.error("List subscribers failed:", err);
      res.status(500).json({ error: "Failed to list subscribers" });
    }
  });

  // Public unsubscribe via token (GET so links in emails work without JS)
  app.get("/unsubscribe/:token", async (req, res) => {
    try {
      const ok = await storage.unsubscribeByToken(req.params.token);
      const message = ok
        ? "You've been unsubscribed. Sorry to see you go."
        : "Already unsubscribed (or invalid link).";
      res
        .status(200)
        .set("Content-Type", "text/html; charset=utf-8")
        .send(
          `<!doctype html><html><head><title>Unsubscribed</title>
          <style>body{font-family:Georgia,serif;max-width:520px;margin:80px auto;padding:0 24px;color:#222}h1{font-size:28px}p{font-size:16px;line-height:1.6}</style>
          </head><body><h1>${ok ? "Unsubscribed" : "Already unsubscribed"}</h1><p>${message}</p><p><a href="/">← Back to gallery.je</a></p></body></html>`,
        );
    } catch (err) {
      console.error("Unsubscribe failed:", err);
      res.status(500).send("Unsubscribe failed");
    }
  });

  // ===========================================================================
  // Feature image import (Phase B) — admin tool for backfilling missing
  // article images from packaged InDesign folders on Google Drive.
  // Local-dev only: requires the archive folder to be mounted at
  // GALLERY_ARCHIVE_ROOT (defaults to the standard Drive path).
  // ===========================================================================

  // What issues do we have packages for, and how many of their articles still
  // need images?
  app.get("/api/admin/feature-import/issues", async (_req, res) => {
    try {
      if (!archiveAvailable()) {
        return res.json({ archiveAvailable: false, issues: [] });
      }
      const packaged = await listPackagedIssues();
      const counts = packaged.length === 0
        ? []
        : await db
            .select({
              issueNumber: articles.issueNumber,
              total: sql<number>`count(*)::int`,
              missing: sql<number>`sum(case when ${articles.featuredImage} is null then 1 else 0 end)::int`,
            })
            .from(articles)
            .where(inArray(articles.issueNumber, packaged))
            .groupBy(articles.issueNumber);
      const counter = new Map(counts.map((c) => [c.issueNumber, c]));
      const result = packaged.map((n) => ({
        issue: n,
        total: counter.get(n)?.total ?? 0,
        missing: counter.get(n)?.missing ?? 0,
      }));
      res.json({ archiveAvailable: true, issues: result });
    } catch (err: any) {
      console.error("feature-import/issues failed:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Articles in a specific issue that still need an image, plus the bucket of
  // images available from the packaged folder.
  app.get("/api/admin/feature-import/issues/:n", async (req, res) => {
    try {
      const num = parseInt(req.params.n, 10);
      if (isNaN(num)) return res.status(400).json({ error: "invalid issue" });
      const articlesMissing = await db
        .select({
          id: articles.id,
          title: articles.title,
          slug: articles.slug,
          excerpt: articles.excerpt,
          featuredImage: articles.featuredImage,
        })
        .from(articles)
        .where(and(eq(articles.issueNumber, num), sql`${articles.featuredImage} is null`))
        .orderBy(asc(articles.title));
      const images = await listIssueImages(num);
      res.json({ issue: num, articles: articlesMissing, images });
    } catch (err: any) {
      console.error("feature-import/issues/:n failed:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Layout-grouped image discovery: returns each .idml/.indd's image set.
  app.get("/api/admin/feature-import/issues/:n/layouts", async (req, res) => {
    try {
      const num = parseInt(req.params.n, 10);
      if (isNaN(num)) return res.status(400).json({ error: "invalid issue" });
      const result = await listLayoutsForIssue(num);
      // Decorate with R2 URLs so the client doesn't have to compute them
      const decorate = (filenames: string[]) =>
        filenames.map((filename) => ({
          filename,
          thumbUrl: `${process.env.R2_PUBLIC_URL || "https://pub-3b96f5fc8ba0456f9ffd861fc06e5e97.r2.dev"}/features/gj${num}/${filename.replace(/\.[^.]+$/, "").replace(/\s+/g, "-").replace(/[^a-zA-Z0-9._-]/g, "")}.thumb.webp`,
          displayUrl: `${process.env.R2_PUBLIC_URL || "https://pub-3b96f5fc8ba0456f9ffd861fc06e5e97.r2.dev"}/features/gj${num}/${filename.replace(/\.[^.]+$/, "").replace(/\s+/g, "-").replace(/[^a-zA-Z0-9._-]/g, "")}.webp`,
        }));
      res.json({
        issue: num,
        groups: result.groups.map((g) => ({ ...g, images: decorate(g.images) })),
        unmatched: decorate(result.unmatched),
      });
    } catch (err: any) {
      console.error("feature-import/issues/:n/layouts failed:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Upload all of an issue's images from the local Drive folder to R2.
  // Idempotent — skips images already on R2.
  app.post("/api/admin/feature-import/issues/:n/sync", async (req, res) => {
    try {
      const num = parseInt(req.params.n, 10);
      if (isNaN(num)) return res.status(400).json({ error: "invalid issue" });
      const result = await syncIssueImagesToR2(num);
      res.json({ issue: num, ...result });
    } catch (err: any) {
      console.error("feature-import sync failed:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Attach hero + gallery to an article. Body:
  //   { articleId, issue, hero: filename, gallery: [filename…] }
  app.post("/api/admin/feature-import/attach", async (req, res) => {
    try {
      const { articleId, issue, hero, gallery = [] } = req.body || {};
      if (!articleId || !issue || !hero) {
        return res.status(400).json({ error: "articleId, issue, hero required" });
      }
      const heroUrl = publicUrlForIssueImage(issue, hero);
      const galleryUrls = (gallery as string[]).map((f) => publicUrlForIssueImage(issue, f));

      // Append gallery HTML — idempotent on the same prefix.
      const existing = await db
        .select({ content: articles.content })
        .from(articles)
        .where(eq(articles.id, articleId))
        .limit(1);
      if (existing.length === 0) return res.status(404).json({ error: "article not found" });

      const prefix = `features/gj${issue}/`;
      const baseContent = existing[0].content || "";
      const galleryBlock =
        galleryUrls.length > 0 && !baseContent.includes(prefix)
          ? buildGalleryHtml(galleryUrls)
          : "";

      const [updated] = await db
        .update(articles)
        .set({
          featuredImage: heroUrl,
          content: baseContent + galleryBlock,
          updatedAt: new Date(),
        })
        .where(eq(articles.id, articleId))
        .returning({ id: articles.id, title: articles.title, featuredImage: articles.featuredImage });

      res.json({ ok: true, article: updated, heroUrl, galleryCount: galleryUrls.length });
    } catch (err: any) {
      console.error("feature-import attach failed:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // ===========================================================================
  // Sitemap + robots — SEO endpoints, no auth, browser-and-crawler friendly.
  // ===========================================================================

  app.get("/sitemap.xml", async (req, res) => {
    try {
      const origin = `${req.protocol}://${req.get("host")}`;
      const data = await getSitemapData(origin);
      const xml = renderSitemapXml(data);
      res
        .status(200)
        .set("Content-Type", "application/xml; charset=utf-8")
        .set("Cache-Control", "public, max-age=3600")
        .send(xml);
    } catch (err: any) {
      console.error("sitemap.xml failed:", err);
      res.status(500).send("sitemap generation failed");
    }
  });

  app.get("/robots.txt", (req, res) => {
    const origin = `${req.protocol}://${req.get("host")}`;
    res
      .status(200)
      .set("Content-Type", "text/plain; charset=utf-8")
      .set("Cache-Control", "public, max-age=86400")
      .send(renderRobotsTxt(origin));
  });

  // JSON endpoint for the human-facing /sitemap page (client-rendered).
  app.get("/api/sitemap", async (req, res) => {
    try {
      const origin = `${req.protocol}://${req.get("host")}`;
      const data = await getSitemapData(origin);
      res.json(data);
    } catch (err: any) {
      console.error("/api/sitemap failed:", err);
      res.status(500).json({ error: err.message });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

// Helper function to get text content from XML nodes
function getTextContent(parent: Element, tagName: string): string {
  const elements = parent.getElementsByTagName(tagName);
  return elements.length > 0 ? elements[0].textContent || '' : '';
}

// Helper function to extract featured image URL from HTML content
function extractFeaturedImage(html: string): string | null {
  if (!html) return null;
  
  // Match first <img> tag and extract src attribute (handles both single and double quotes)
  const imgMatch = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (imgMatch && imgMatch[1]) {
    return imgMatch[1];
  }
  
  // Fallback: try data-src for lazy-loaded images
  const dataSrcMatch = html.match(/<img[^>]+data-src=["']([^"']+)["']/i);
  if (dataSrcMatch && dataSrcMatch[1]) {
    return dataSrcMatch[1];
  }
  
  return null;
}
