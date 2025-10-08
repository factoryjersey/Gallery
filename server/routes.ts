import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { ObjectStorageService, ObjectNotFoundError, objectStorageClient } from "./objectStorage";
import { insertArticleSchema, insertCategorySchema, insertTagSchema, insertAuthorSchema, insertMediaSchema } from "@shared/schema";
import { z } from "zod";
import multer from "multer";
import { DOMParser } from "@xmldom/xmldom";
import { processImage, getPublicUrl } from "./imageProcessor";

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

      const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
      if (!bucketId) {
        return res.status(500).json({ error: "Object storage not configured" });
      }

      // Process image and generate variants
      const processed = await processImage(
        req.file.buffer,
        req.file.originalname,
        bucketId,
        objectStorageClient
      );

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
      
      // Return media with public URLs
      res.json({
        media: {
          ...media,
          urls: {
            thumbnail: getPublicUrl(bucketId, processed.variants.thumbnail),
            medium: getPublicUrl(bucketId, processed.variants.medium),
            large: getPublicUrl(bucketId, processed.variants.large),
            webp: getPublicUrl(bucketId, processed.variants.webp),
            original: getPublicUrl(bucketId, processed.variants.original),
          }
        }
      });
    } catch (error) {
      console.error("Error uploading and processing image:", error);
      res.status(500).json({ error: "Failed to upload and process image" });
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

      // Create default author if none exists
      let defaultAuthor = await storage.getAuthorByEmail('admin@example.com');
      if (!defaultAuthor) {
        defaultAuthor = await storage.createAuthor({
          name: 'Imported Author',
          email: 'admin@example.com',
          bio: 'Content imported from WordPress',
        });
        importResults.authors++;
      }

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

          // Parse WordPress categories
          const categoryElements = item.getElementsByTagName('category');
          let category = null;
          
          // Find the first category with domain="category" (actual post category, not tag)
          for (let j = 0; j < categoryElements.length; j++) {
            const catEl = categoryElements[j];
            const domain = catEl.getAttribute('domain');
            
            if (domain === 'category') {
              const categoryName = catEl.textContent?.trim() || '';
              const categorySlug = catEl.getAttribute('nicename') || categoryName.toLowerCase().replace(/\s+/g, '-');
              
              if (categoryName) {
                // Check if category exists
                category = await storage.getCategoryBySlug(categorySlug);
                
                if (!category) {
                  // Create new category from WordPress
                  category = await storage.createCategory({
                    name: categoryName,
                    slug: categorySlug,
                    description: `Imported from WordPress`,
                  });
                  importResults.categories++;
                }
                
                break; // Use first category found
              }
            }
          }
          
          // Fallback to Uncategorized if no category found
          if (!category) {
            category = await storage.getCategoryBySlug('uncategorized');
            if (!category) {
              category = await storage.createCategory({
                name: 'Uncategorized',
                slug: 'uncategorized',
                description: 'Posts without a category',
              });
              importResults.categories++;
            }
          }

          const articleData = {
            title: title || 'Untitled',
            slug: slug || `imported-post-${Date.now()}`,
            excerpt: excerpt || '',
            content: content || '',
            status: status === 'publish' ? 'published' : 'draft',
            authorId: defaultAuthor.id,
            categoryId: category.id,
            publishedAt: pubDate ? new Date(pubDate) : new Date(),
            readTime: Math.max(1, Math.ceil((content?.length || 0) / 1000)),
          };

          await storage.createArticle(articleData);
          importResults.articles++;

        } catch (error) {
          console.error(`Error importing item ${i}:`, error);
          importResults.errors.push(`Item ${i}: ${error.message}`);
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

  const httpServer = createServer(app);
  return httpServer;
}

// Helper function to get text content from XML nodes
function getTextContent(parent: Element, tagName: string): string {
  const elements = parent.getElementsByTagName(tagName);
  return elements.length > 0 ? elements[0].textContent || '' : '';
}
