import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { ObjectStorageService, ObjectNotFoundError, objectStorageClient } from "./objectStorage";
import { insertArticleSchema, insertCategorySchema, insertTagSchema, insertAuthorSchema, insertMediaSchema } from "@shared/schema";
import { z } from "zod";
import multer from "multer";
import { DOMParser } from "@xmldom/xmldom";
import { processImage, getPublicUrl } from "./imageProcessor";
import { r2Client } from "./r2Client";
import { ListObjectsV2Command, DeleteObjectsCommand, HeadObjectCommand } from "@aws-sdk/client-s3";

const upload = multer({ storage: multer.memoryStorage() });

export async function registerRoutes(app: Express): Promise<Server> {
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
        orderDir = 'desc'
      } = req.query;

      const offset = (Number(page) - 1) * Number(limit);

      const result = await storage.getArticles({
        status: status as string,
        categoryId: categoryId as string,
        authorId: authorId as string,
        search: search as string,
        year: year as string,
        limit: Number(limit),
        offset,
        orderBy: orderBy as 'publishedAt' | 'createdAt' | 'views' | 'title',
        orderDir: orderDir as 'asc' | 'desc',
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

      res.json({ article });
    } catch (error) {
      console.error("Error fetching article by slug:", error);
      res.status(500).json({ error: "Failed to fetch article" });
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
      res.json({ categories });
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
      const media = await storage.getAllMedia();
      res.json({ media });
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
      const existingUrls = new Set(existingMedia.map(m => {
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
      const existingPaths = new Set(existingMedia.map(m => m.objectPath));

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
      const urlBasedMedia = allMedia.filter(m => m.objectPath?.startsWith('http'));
      const pathBasedMedia = allMedia.filter(m => m.objectPath && !m.objectPath.startsWith('http'));
      
      const analysis = {
        totalIndexed: allMedia.length,
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
          description: `Imported from WordPress`,
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
                bio: `Content author imported from WordPress`,
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
      const imageUrlPattern = /https:\/\/pub-3b96f5fc8ba0456f9ffd861fc06e5e97\.r2\.dev\/[^\s"'<>)]+\.(jpg|jpeg|png|gif|webp)/gi;
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

      // Extract just the path (everything after .r2.dev/)
      const usedPaths = Array.from(usedImages).map(url => {
        const match = url.match(/https:\/\/pub-3b96f5fc8ba0456f9ffd861fc06e5e97\.r2\.dev\/(.+)/);
        return match ? match[1] : url;
      });

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

      const r2Pattern = /https:\/\/pub-3b96f5fc8ba0456f9ffd861fc06e5e97\.r2\.dev\/[^\s"'<>)]+/gi;
      const usedUrls = new Set<string>();

      for (const article of allArticles.articles) {
        if (article.featuredImage && article.featuredImage.includes('r2.dev')) {
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

        const variantPattern = /(https:\/\/pub-3b96f5fc8ba0456f9ffd861fc06e5e97\.r2\.dev\/[^"'\s<>)]+)-(thumbnail|medium|large)\.(jpg|jpeg|png|gif|webp)/gi;
        
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

  // Smart dimension resolver - find largest version of each image and update articles
  app.post("/api/admin/resolve-to-largest-dimensions", async (req, res) => {
    try {
      if (!r2Client) {
        return res.status(500).json({ error: "R2 client not configured" });
      }

      // Step 1: Get all R2 objects
      const listCommand = new ListObjectsV2Command({
        Bucket: process.env.R2_BUCKET_NAME,
      });
      const r2Response = await r2Client.send(listCommand);
      const r2Objects = r2Response.Contents || [];

      // Step 2: Build map of base images to all their dimension variants
      const imageVariants = new Map<string, Array<{ key: string; width: number; height: number; url: string }>>();

      for (const obj of r2Objects) {
        if (!obj.Key) continue;
        
        // Skip non-image files
        if (!obj.Key.match(/\.(jpg|jpeg|png|gif|webp)$/i)) continue;

        // Extract base name and dimensions
        const dimensionMatch = obj.Key.match(/^(.+?)-(\d{3,4})x(\d{3,4})\.(jpg|jpeg|png|gif|webp)$/i);
        const standardMatch = obj.Key.match(/^(.+?)-(thumbnail|medium|large)\.(webp)$/i);
        
        let baseName: string;
        let width = 0;
        let height = 0;

        if (dimensionMatch) {
          // WordPress dimension suffix like "image-1500x1000.jpg"
          baseName = `${dimensionMatch[1]}.${dimensionMatch[4]}`;
          width = parseInt(dimensionMatch[2]);
          height = parseInt(dimensionMatch[3]);
        } else if (standardMatch) {
          // Standard variant like "image-large.webp"
          baseName = `${standardMatch[1]}.${standardMatch[3]}`;
          width = standardMatch[2] === 'thumbnail' ? 300 : standardMatch[2] === 'medium' ? 800 : 1200;
        } else {
          // Original file like "image.jpg"
          baseName = obj.Key;
          // Assume original is large if no dimensions
          width = 2000;
          height = 2000;
        }

        if (!imageVariants.has(baseName)) {
          imageVariants.set(baseName, []);
        }

        const url = `https://pub-${process.env.R2_ACCOUNT_ID}.r2.dev/${obj.Key}`;
        imageVariants.get(baseName)!.push({ key: obj.Key, width, height, url });
      }

      // Step 3: For each base image, find the largest variant
      const largestVersions = new Map<string, string>();
      
      for (const [baseName, variants] of Array.from(imageVariants.entries())) {
        // Sort by total pixels (width * height) descending
        const sorted = variants.sort((a: { width: number; height: number }, b: { width: number; height: number }) => 
          (b.width * b.height) - (a.width * a.height)
        );
        const largest = sorted[0];
        largestVersions.set(baseName, largest.url);
      }

      // Step 4: Scan articles and build URL mapping
      const allArticles = await storage.getArticles({
        status: undefined,
        limit: 100000,
        offset: 0,
        orderBy: 'publishedAt',
        orderDir: 'desc',
      });

      // Build map of any image URL variant to its largest version
      const urlReplacements = new Map<string, string>();
      
      for (const [baseName, largestUrl] of Array.from(largestVersions.entries())) {
        const variants = imageVariants.get(baseName) || [];
        for (const variant of variants) {
          if (variant.url !== largestUrl) {
            urlReplacements.set(variant.url, largestUrl);
          }
        }
      }

      // Step 5: Update articles
      let articlesUpdated = 0;
      let urlsReplaced = 0;
      const indexedImages = new Set<string>();

      for (const article of allArticles.articles) {
        let contentUpdated = false;
        let newContent = article.content || '';
        let newFeaturedImage = article.featuredImage;

        // Replace all variant URLs with largest versions in content
        for (const [oldUrl, newUrl] of Array.from(urlReplacements.entries())) {
          if (newContent.includes(oldUrl)) {
            newContent = newContent.replace(new RegExp(oldUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), newUrl);
            contentUpdated = true;
            urlsReplaced++;
            indexedImages.add(newUrl);
          }
        }

        // Replace featured image
        if (newFeaturedImage && urlReplacements.has(newFeaturedImage)) {
          newFeaturedImage = urlReplacements.get(newFeaturedImage)!;
          contentUpdated = true;
          urlsReplaced++;
          indexedImages.add(newFeaturedImage);
        } else if (newFeaturedImage && newFeaturedImage.includes('r2.dev')) {
          indexedImages.add(newFeaturedImage);
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

      // Step 6: Index the largest versions in media library
      let newlyIndexed = 0;
      for (const imageUrl of Array.from(indexedImages)) {
        // Check if already indexed
        const allMedia = await storage.getMedia({ limit: 100000 });
        const existing = allMedia.media.find((m: any) => m.objectPath === imageUrl);
        
        if (!existing) {
          const urlObj = new URL(imageUrl);
          const filename = urlObj.pathname.split('/').pop() || 'unknown';
          
          await storage.createMedia({
            filename,
            originalName: filename,
            mimeType: 'image/jpeg',
            size: 0,
            objectPath: imageUrl,
            variants: { original: imageUrl }
          });
          newlyIndexed++;
        }
      }

      res.json({
        success: true,
        articlesUpdated,
        urlsReplaced,
        imagesIndexed: newlyIndexed,
        totalVariants: imageVariants.size,
        largestVersionsFound: largestVersions.size
      });
    } catch (error) {
      console.error("Error resolving to largest dimensions:", error);
      res.status(500).json({ error: "Failed to resolve dimensions" });
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
