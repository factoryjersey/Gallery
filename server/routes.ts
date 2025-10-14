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
      for (const slug of categoryMap.keys()) {
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
          for (const match of matches) {
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
