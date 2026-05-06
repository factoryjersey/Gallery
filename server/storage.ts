import { 
  Article, InsertArticle, ArticleWithDetails,
  Author, InsertAuthor,
  Category, InsertCategory,
  Tag, InsertTag,
  Media, InsertMedia,
  User, InsertUser,
  articles, authors, categories, tags, articleTags, media, users
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, asc, like, ilike, and, or, inArray, count, sql, isNotNull, ne } from "drizzle-orm";

export interface IStorage {
  // User methods (legacy)
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Author methods
  getAuthor(id: string): Promise<Author | undefined>;
  getAuthorByEmail(email: string): Promise<Author | undefined>;
  createAuthor(author: InsertAuthor): Promise<Author>;
  updateAuthor(id: string, author: Partial<InsertAuthor>): Promise<Author | undefined>;
  deleteAuthor(id: string): Promise<boolean>;
  getAllAuthors(): Promise<Author[]>;

  // Category methods
  getCategory(id: string): Promise<Category | undefined>;
  getCategoryBySlug(slug: string): Promise<Category | undefined>;
  createCategory(category: InsertCategory): Promise<Category>;
  updateCategory(id: string, category: Partial<InsertCategory>): Promise<Category | undefined>;
  updateCategoryParent(id: string, parentId: string | null): Promise<void>;
  getAllCategories(): Promise<Category[]>;

  // Tag methods
  getTag(id: string): Promise<Tag | undefined>;
  getTagBySlug(slug: string): Promise<Tag | undefined>;
  createTag(tag: InsertTag): Promise<Tag>;
  updateTag(id: string, tag: Partial<InsertTag>): Promise<Tag | undefined>;
  getAllTags(): Promise<Tag[]>;

  // Article methods
  getArticle(id: string): Promise<ArticleWithDetails | undefined>;
  getArticleBySlug(slug: string): Promise<ArticleWithDetails | undefined>;
  getArticleByWpId(wpId: number): Promise<ArticleWithDetails | undefined>;
  createArticle(article: InsertArticle, tagIds?: string[]): Promise<Article>;
  updateArticle(id: string, article: Partial<InsertArticle>, tagIds?: string[]): Promise<Article | undefined>;
  deleteArticle(id: string): Promise<boolean>;
  getArticles(options?: {
    status?: string;
    categoryId?: string;
    authorId?: string;
    search?: string;
    year?: string;
    withImage?: boolean;
    limit?: number;
    offset?: number;
    orderBy?: 'publishedAt' | 'createdAt' | 'views' | 'title';
    orderDir?: 'asc' | 'desc';
  }): Promise<{ articles: ArticleWithDetails[]; total: number }>;
  getFeaturedArticles(limit?: number): Promise<ArticleWithDetails[]>;
  getTrendingArticles(limit?: number): Promise<ArticleWithDetails[]>;
  incrementArticleViews(id: string): Promise<void>;

  // Media methods
  createMedia(mediaData: InsertMedia): Promise<Media>;
  getMedia(id: string): Promise<Media | undefined>;
  getAllMedia(options?: {
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ media: Media[]; total: number }>;
  deleteMedia(id: string): Promise<boolean>;

  // Statistics
  getStats(): Promise<{
    totalArticles: number;
    publishedArticles: number;
    draftArticles: number;
    totalViews: number;
  }>;
}

export class DatabaseStorage implements IStorage {
  // User methods
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  // Author methods
  async getAuthor(id: string): Promise<Author | undefined> {
    const [author] = await db.select().from(authors).where(eq(authors.id, id));
    return author || undefined;
  }

  async getAuthorByEmail(email: string): Promise<Author | undefined> {
    const [author] = await db.select().from(authors).where(eq(authors.email, email));
    return author || undefined;
  }

  async createAuthor(author: InsertAuthor): Promise<Author> {
    const [newAuthor] = await db.insert(authors).values(author).returning();
    return newAuthor;
  }

  async updateAuthor(id: string, author: Partial<InsertAuthor>): Promise<Author | undefined> {
    const [updated] = await db.update(authors).set(author).where(eq(authors.id, id)).returning();
    return updated || undefined;
  }

  async deleteAuthor(id: string): Promise<boolean> {
    const result = await db.delete(authors).where(eq(authors.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  async getAllAuthors(): Promise<Author[]> {
    return await db.select().from(authors).orderBy(asc(authors.name));
  }

  // Category methods
  async getCategory(id: string): Promise<Category | undefined> {
    const [category] = await db.select().from(categories).where(eq(categories.id, id));
    return category || undefined;
  }

  async getCategoryBySlug(slug: string): Promise<Category | undefined> {
    const [category] = await db.select().from(categories).where(eq(categories.slug, slug));
    return category || undefined;
  }

  async createCategory(category: InsertCategory): Promise<Category> {
    const [newCategory] = await db.insert(categories).values(category).returning();
    return newCategory;
  }

  async updateCategory(id: string, category: Partial<InsertCategory>): Promise<Category | undefined> {
    const [updated] = await db.update(categories).set(category).where(eq(categories.id, id)).returning();
    return updated || undefined;
  }

  async updateCategoryParent(id: string, parentId: string | null): Promise<void> {
    await db.update(categories).set({ parentId }).where(eq(categories.id, id));
  }

  async getAllCategories(): Promise<Category[]> {
    // Order by parentId first (nulls first for top-level), then by name
    return await db.select().from(categories).orderBy(asc(categories.parentId), asc(categories.name));
  }

  // Tag methods
  async getTag(id: string): Promise<Tag | undefined> {
    const [tag] = await db.select().from(tags).where(eq(tags.id, id));
    return tag || undefined;
  }

  async getTagBySlug(slug: string): Promise<Tag | undefined> {
    const [tag] = await db.select().from(tags).where(eq(tags.slug, slug));
    return tag || undefined;
  }

  async createTag(tag: InsertTag): Promise<Tag> {
    const [newTag] = await db.insert(tags).values(tag).returning();
    return newTag;
  }

  async updateTag(id: string, tag: Partial<InsertTag>): Promise<Tag | undefined> {
    const [updated] = await db.update(tags).set(tag).where(eq(tags.id, id)).returning();
    return updated || undefined;
  }

  async getAllTags(): Promise<Tag[]> {
    return await db.select().from(tags).orderBy(asc(tags.name));
  }

  // Article methods
  async getArticle(id: string): Promise<ArticleWithDetails | undefined> {
    const result = await db
      .select({
        article: articles,
        author: authors,
        category: categories,
      })
      .from(articles)
      .leftJoin(authors, eq(articles.authorId, authors.id))
      .leftJoin(categories, eq(articles.categoryId, categories.id))
      .where(eq(articles.id, id))
      .limit(1);

    if (!result.length || !result[0].author || !result[0].category) return undefined;

    const tagResults = await db
      .select({ tag: tags })
      .from(articleTags)
      .leftJoin(tags, eq(articleTags.tagId, tags.id))
      .where(eq(articleTags.articleId, id));

    return {
      ...result[0].article,
      author: result[0].author,
      category: result[0].category,
      tags: tagResults.map(at => at.tag).filter(Boolean) as Tag[],
    };
  }

  async getArticleBySlug(slug: string): Promise<ArticleWithDetails | undefined> {
    const result = await db
      .select({
        article: articles,
        author: authors,
        category: categories,
      })
      .from(articles)
      .leftJoin(authors, eq(articles.authorId, authors.id))
      .leftJoin(categories, eq(articles.categoryId, categories.id))
      .where(eq(articles.slug, slug))
      .limit(1);

    if (!result.length || !result[0].author || !result[0].category) return undefined;

    const tagResults = await db
      .select({ tag: tags })
      .from(articleTags)
      .leftJoin(tags, eq(articleTags.tagId, tags.id))
      .where(eq(articleTags.articleId, result[0].article.id));

    return {
      ...result[0].article,
      author: result[0].author,
      category: result[0].category,
      tags: tagResults.map(at => at.tag).filter(Boolean) as Tag[],
    };
  }

  async getArticleByWpId(wpId: number): Promise<ArticleWithDetails | undefined> {
    const result = await db
      .select({
        article: articles,
        author: authors,
        category: categories,
      })
      .from(articles)
      .leftJoin(authors, eq(articles.authorId, authors.id))
      .leftJoin(categories, eq(articles.categoryId, categories.id))
      .where(eq(articles.wpId, wpId))
      .limit(1);

    if (!result.length || !result[0].author || !result[0].category) return undefined;

    const tagResults = await db
      .select({ tag: tags })
      .from(articleTags)
      .leftJoin(tags, eq(articleTags.tagId, tags.id))
      .where(eq(articleTags.articleId, result[0].article.id));

    return {
      ...result[0].article,
      author: result[0].author,
      category: result[0].category,
      tags: tagResults.map(at => at.tag).filter(Boolean) as Tag[],
    };
  }

  async createArticle(article: InsertArticle, tagIds?: string[]): Promise<Article> {
    const [newArticle] = await db.insert(articles).values({
      ...article,
      updatedAt: new Date(),
    }).returning();

    if (tagIds && tagIds.length > 0) {
      const tagMappings = tagIds.map(tagId => ({
        articleId: newArticle.id,
        tagId,
      }));
      await db.insert(articleTags).values(tagMappings);
    }

    return newArticle;
  }

  async updateArticle(id: string, article: Partial<InsertArticle>, tagIds?: string[]): Promise<Article | undefined> {
    const [updated] = await db.update(articles).set({
      ...article,
      updatedAt: new Date(),
    }).where(eq(articles.id, id)).returning();

    if (!updated) return undefined;

    if (tagIds !== undefined) {
      // Remove existing tag mappings
      await db.delete(articleTags).where(eq(articleTags.articleId, id));

      // Add new tag mappings
      if (tagIds.length > 0) {
        const tagMappings = tagIds.map(tagId => ({
          articleId: id,
          tagId,
        }));
        await db.insert(articleTags).values(tagMappings);
      }
    }

    return updated;
  }

  async deleteArticle(id: string): Promise<boolean> {
    const result = await db.delete(articles).where(eq(articles.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  async getArticles(options: {
    status?: string;
    categoryId?: string;
    authorId?: string;
    search?: string;
    year?: string;
    withImage?: boolean;
    limit?: number;
    offset?: number;
    orderBy?: 'publishedAt' | 'createdAt' | 'views' | 'title';
    orderDir?: 'asc' | 'desc';
  } = {}): Promise<{ articles: ArticleWithDetails[]; total: number }> {
    const {
      status = 'published',
      categoryId,
      authorId,
      search,
      year,
      withImage,
      limit = 10,
      offset = 0,
      orderBy = 'publishedAt',
      orderDir = 'desc',
    } = options;

    let whereCondition: any = status === 'all' ? undefined : eq(articles.status, status);

    if (categoryId) {
      whereCondition = and(whereCondition, eq(articles.categoryId, categoryId));
    }

    if (authorId) {
      whereCondition = and(whereCondition, eq(articles.authorId, authorId));
    }

    if (search) {
      whereCondition = and(
        whereCondition,
        or(
          like(articles.title, `%${search}%`),
          like(articles.excerpt, `%${search}%`),
          like(articles.content, `%${search}%`)
        )
      );
    }

    if (year) {
      whereCondition = and(
        whereCondition,
        sql`EXTRACT(YEAR FROM ${articles.publishedAt}) = ${year}`
      );
    }

    if (withImage) {
      whereCondition = and(
        whereCondition,
        isNotNull(articles.featuredImage),
        ne(articles.featuredImage, '')
      );
    }

    const orderColumn = articles[orderBy];
    const orderFunc = orderDir === 'asc' ? asc : desc;

    const result = await db
      .select({
        article: articles,
        author: authors,
        category: categories,
      })
      .from(articles)
      .leftJoin(authors, eq(articles.authorId, authors.id))
      .leftJoin(categories, eq(articles.categoryId, categories.id))
      .where(whereCondition)
      .orderBy(orderFunc(orderColumn))
      .limit(limit)
      .offset(offset);

    const [{ count: total }] = await db
      .select({ count: count() })
      .from(articles)
      .where(whereCondition);

    const articlesWithTags: ArticleWithDetails[] = [];

    for (const row of result) {
      if (!row.author || !row.category) continue;

      const tagResults = await db
        .select({ tag: tags })
        .from(articleTags)
        .leftJoin(tags, eq(articleTags.tagId, tags.id))
        .where(eq(articleTags.articleId, row.article.id));

      articlesWithTags.push({
        ...row.article,
        author: row.author,
        category: row.category,
        tags: tagResults.map(at => at.tag).filter(Boolean) as Tag[],
      });
    }

    return { articles: articlesWithTags, total };
  }

  async getFeaturedArticles(limit = 8): Promise<ArticleWithDetails[]> {
    // First: try explicitly pinned articles (isFeatured=true), ordered by featuredOrder
    const pinned = await db
      .select({ article: articles, author: authors, category: categories })
      .from(articles)
      .leftJoin(authors, eq(articles.authorId, authors.id))
      .leftJoin(categories, eq(articles.categoryId, categories.id))
      .where(and(eq(articles.isFeatured, true), eq(articles.status, 'published')))
      .orderBy(asc(articles.featuredOrder), desc(articles.publishedAt))
      .limit(limit);

    const pinnedWithTags: ArticleWithDetails[] = [];
    for (const row of pinned) {
      if (!row.author || !row.category) continue;
      const tagResults = await db.select({ tag: tags }).from(articleTags)
        .leftJoin(tags, eq(articleTags.tagId, tags.id))
        .where(eq(articleTags.articleId, row.article.id));
      pinnedWithTags.push({ ...row.article, author: row.author, category: row.category, tags: tagResults.map(at => at.tag).filter(Boolean) as Tag[] });
    }

    if (pinnedWithTags.length >= limit) return pinnedWithTags.slice(0, limit);

    // Fallback: fill remaining slots from latest published articles with images
    const needed = limit - pinnedWithTags.length;
    const pinnedIds = pinnedWithTags.map(a => a.id);
    const pool = (await this.getArticles({ status: 'published', limit: needed * 6, orderBy: 'publishedAt', orderDir: 'desc' })).articles;
    const filler = pool.filter(a => a.featuredImage && !pinnedIds.includes(a.id)).slice(0, needed);

    return [...pinnedWithTags, ...filler];
  }

  async getTrendingArticles(limit = 5): Promise<ArticleWithDetails[]> {
    // Get articles from the last 7 days with high view counts
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const result = await db
      .select({
        article: articles,
        author: authors,
        category: categories,
      })
      .from(articles)
      .leftJoin(authors, eq(articles.authorId, authors.id))
      .leftJoin(categories, eq(articles.categoryId, categories.id))
      .where(
        and(
          eq(articles.status, 'published'),
          sql`${articles.publishedAt} >= ${sevenDaysAgo}`
        )
      )
      .orderBy(desc(articles.views))
      .limit(limit);

    const articlesWithTags: ArticleWithDetails[] = [];

    for (const row of result) {
      if (!row.author || !row.category) continue;

      const tagResults = await db
        .select({ tag: tags })
        .from(articleTags)
        .leftJoin(tags, eq(articleTags.tagId, tags.id))
        .where(eq(articleTags.articleId, row.article.id));

      articlesWithTags.push({
        ...row.article,
        author: row.author,
        category: row.category,
        tags: tagResults.map(at => at.tag).filter(Boolean) as Tag[],
      });
    }

    return articlesWithTags;
  }

  async incrementArticleViews(id: string): Promise<void> {
    await db
      .update(articles)
      .set({ 
        views: sql`${articles.views} + 1`
      })
      .where(eq(articles.id, id));
  }

  // Media methods
  async createMedia(mediaData: InsertMedia): Promise<Media> {
    const [newMedia] = await db.insert(media).values(mediaData).returning();
    return newMedia;
  }

  async getMedia(id: string): Promise<Media | undefined> {
    const [mediaItem] = await db.select().from(media).where(eq(media.id, id));
    return mediaItem || undefined;
  }

  async getAllMedia(options?: {
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ media: Media[]; total: number }> {
    const { search, limit = 20, offset = 0 } = options || {};
    
    // Build query conditions
    const conditions = [];
    
    if (search) {
      conditions.push(
        or(
          ilike(media.filename, `%${search}%`),
          ilike(media.originalName, `%${search}%`)
        )
      );
    }
    
    // Get total count
    const [totalResult] = await db
      .select({ count: count() })
      .from(media)
      .where(conditions.length > 0 ? and(...conditions) : undefined);
    
    // Get paginated results
    const results = await db
      .select()
      .from(media)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(media.createdAt))
      .limit(limit)
      .offset(offset);
    
    return {
      media: results,
      total: totalResult.count
    };
  }

  async deleteMedia(id: string): Promise<boolean> {
    const result = await db.delete(media).where(eq(media.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // Statistics
  async getStats(): Promise<{
    totalArticles: number;
    publishedArticles: number;
    draftArticles: number;
    totalViews: number;
  }> {
    const [totalArticlesResult] = await db
      .select({ count: count() })
      .from(articles);

    const [publishedResult] = await db
      .select({ count: count() })
      .from(articles)
      .where(eq(articles.status, 'published'));

    const [draftResult] = await db
      .select({ count: count() })
      .from(articles)
      .where(eq(articles.status, 'draft'));

    const viewsResult = await db
      .select({ total: sql<number>`sum(${articles.views})` })
      .from(articles);

    return {
      totalArticles: totalArticlesResult.count,
      publishedArticles: publishedResult.count,
      draftArticles: draftResult.count,
      totalViews: viewsResult[0]?.total || 0,
    };
  }
}

export const storage = new DatabaseStorage();
