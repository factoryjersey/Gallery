import {
  Article, InsertArticle, ArticleWithDetails,
  Author, InsertAuthor,
  Category, InsertCategory,
  Tag, InsertTag,
  Media, InsertMedia,
  User, InsertUser,
  Subscriber, InsertSubscriber,
  articles, authors, categories, tags, articleTags, media, users, subscribers, splashSlides,
  contributors, articleContributors
} from "@shared/schema";
import type { Contributor, InsertContributor } from "@shared/schema";
import { db } from "./db";
import { eq, desc, asc, like, ilike, and, or, inArray, count, sql, isNotNull, ne } from "drizzle-orm";
import { slugify as slugifyAuthor } from "@shared/slug";

function decodeHtml(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'");
}

function normaliseCategory<T extends { name: string; description?: string | null }>(cat: T): T {
  const desc = cat.description;
  const isPlaceholder = desc && desc.toLowerCase().trim() === 'imported from wordpress';
  return {
    ...cat,
    name: decodeHtml(cat.name),
    description: isPlaceholder ? null : desc,
  };
}

const WP_PLACEHOLDER_BIOS = [
  'content author imported from wordpress',
  'content imported from wordpress',
];

function normaliseAuthor<T extends { bio: string | null }>(author: T): T {
  if (author.bio && WP_PLACEHOLDER_BIOS.includes(author.bio.toLowerCase())) {
    return { ...author, bio: '' };
  }
  return author;
}

export interface IStorage {
  // User methods (legacy)
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Author methods
  getAuthor(id: string): Promise<Author | undefined>;
  getAuthorBySlug(slug: string): Promise<Author | undefined>;
  getAuthorByEmail(email: string): Promise<Author | undefined>;
  createAuthor(author: InsertAuthor): Promise<Author>;
  updateAuthor(id: string, author: Partial<InsertAuthor>): Promise<Author | undefined>;
  deleteAuthor(id: string): Promise<boolean>;
  getAllAuthors(): Promise<Author[]>;
  // Directory view: authors with at least one published article, including
  // article counts and the names of categories they've written in (used to
  // auto-generate a "Writes about X, Y" summary on the directory).
  getDirectoryAuthors(): Promise<Array<Author & { articleCount: number; categoryNames: string[] }>>;

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
    issueNumber?: number;
  }): Promise<{ articles: ArticleWithDetails[]; total: number }>;
  getFeaturedArticles(limit?: number): Promise<ArticleWithDetails[]>;
  getTrendingArticles(limit?: number): Promise<ArticleWithDetails[]>;
  incrementArticleViews(id: string): Promise<void>;

  // Splash intro slides (three positions, each backed by an article)
  getSplashSlides(): Promise<(ArticleWithDetails & { position: number })[]>;
  setSplashSlides(articleIds: (string | null)[]): Promise<void>;

  // Contributors (photographers, illustrators, etc — non-author credits)
  listContributors(): Promise<Contributor[]>;
  getContributorBySlug(slug: string): Promise<Contributor | undefined>;
  upsertContributorByName(name: string, defaultRole?: string): Promise<Contributor>;
  updateContributor(id: string, patch: Partial<InsertContributor>): Promise<Contributor | undefined>;
  getArticleContributors(articleId: string): Promise<Array<Contributor & { role: string; displayOrder: number }>>;
  setArticleContributors(
    articleId: string,
    credits: Array<{ contributorId: string; role: string; displayOrder?: number }>,
  ): Promise<void>;

  // Subscribers
  createSubscriber(input: InsertSubscriber): Promise<Subscriber>;
  listSubscribers(options?: { activeOnly?: boolean; limit?: number; offset?: number }): Promise<{ subscribers: Subscriber[]; total: number }>;
  unsubscribeByToken(token: string): Promise<boolean>;

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
    return author ? normaliseAuthor(author) : undefined;
  }

  async getAuthorByEmail(email: string): Promise<Author | undefined> {
    const [author] = await db.select().from(authors).where(eq(authors.email, email));
    return author || undefined;
  }

  async getAuthorBySlug(slug: string): Promise<Author | undefined> {
    const [author] = await db.select().from(authors).where(eq(authors.slug, slug));
    return author ? normaliseAuthor(author) : undefined;
  }

  async getDirectoryAuthors(): Promise<Array<Author & {
    articleCount: number;
    categoryNames: string[];
    recentArticle: { title: string; slug: string } | null;
  }>> {
    // Authors who have at least one published, non-cartoon article. The
    // subselect picks the author's most recent published article — shown on
    // the directory card as an example of their work.
    const recentArticleSql = sql<{ title: string; slug: string } | null>`(
      SELECT json_build_object('title', a.title, 'slug', a.slug)
      FROM ${articles} a
      WHERE a.author_id = ${authors.id}
        AND a.status = 'published'
        AND a.content_type <> 'cartoon'
      ORDER BY a.published_at DESC NULLS LAST, a.created_at DESC
      LIMIT 1
    )`;

    const rows = await db
      .select({
        author: authors,
        articleCount: sql<number>`count(distinct ${articles.id})::int`,
        categoryNames: sql<string[]>`array_agg(distinct ${categories.name})`,
        recentArticle: recentArticleSql,
      })
      .from(authors)
      .innerJoin(articles, eq(articles.authorId, authors.id))
      .leftJoin(categories, eq(categories.id, articles.categoryId))
      .where(and(
        eq(articles.status, "published"),
        ne(articles.contentType, "cartoon"),
      ))
      .groupBy(authors.id)
      .orderBy(asc(authors.name));

    return rows.map((r) => ({
      ...normaliseAuthor(r.author),
      articleCount: r.articleCount,
      categoryNames: (r.categoryNames || []).filter(Boolean),
      recentArticle: r.recentArticle,
    }));
  }

  async createAuthor(author: InsertAuthor): Promise<Author> {
    // Auto-generate a unique slug if one wasn't supplied — appends a
    // numeric suffix if the base slug is already taken.
    let values: InsertAuthor = author;
    if (!author.slug && author.name) {
      const base = slugifyAuthor(author.name) || "contributor";
      let candidate = base;
      let n = 2;
      // eslint-disable-next-line no-await-in-loop
      while (await this.getAuthorBySlug(candidate)) {
        candidate = `${base}-${n++}`;
      }
      values = { ...author, slug: candidate };
    }
    const [newAuthor] = await db.insert(authors).values(values).returning();
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
    return category ? normaliseCategory(category) : undefined;
  }

  async getCategoryBySlug(slug: string): Promise<Category | undefined> {
    const [category] = await db.select().from(categories).where(eq(categories.slug, slug));
    return category ? normaliseCategory(category) : undefined;
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
    const rows = await db.select().from(categories).orderBy(asc(categories.parentId), asc(categories.name));
    return rows.map(normaliseCategory);
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
      author: normaliseAuthor(result[0].author),
      category: normaliseCategory(result[0].category),
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
      author: normaliseAuthor(result[0].author),
      category: normaliseCategory(result[0].category),
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
      author: normaliseAuthor(result[0].author),
      category: normaliseCategory(result[0].category),
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
    categoryIds?: string[];
    authorId?: string;
    search?: string;
    year?: string;
    withImage?: boolean;
    limit?: number;
    offset?: number;
    orderBy?: 'publishedAt' | 'createdAt' | 'views' | 'title';
    orderDir?: 'asc' | 'desc';
    contentType?: string;
    issueNumber?: number;
  } = {}): Promise<{ articles: ArticleWithDetails[]; total: number }> {
    const {
      status = 'published',
      categoryId,
      categoryIds,
      authorId,
      search,
      year,
      withImage,
      limit = 10,
      offset = 0,
      orderBy = 'publishedAt',
      orderDir = 'desc',
      contentType = 'article',
      issueNumber,
    } = options;

    let whereCondition: any = status === 'all' ? undefined : eq(articles.status, status);

    // Filter by content type — default shows articles + galleries, excludes cartoons
    if (contentType === 'all') {
      // no filter
    } else if (contentType === 'article') {
      // Default: show articles and galleries, exclude cartoons
      whereCondition = and(whereCondition, ne(articles.contentType, 'cartoon'));
    } else {
      whereCondition = and(whereCondition, eq(articles.contentType, contentType));
    }

    if (categoryIds && categoryIds.length > 0) {
      whereCondition = and(whereCondition, inArray(articles.categoryId, categoryIds));
    } else if (categoryId) {
      whereCondition = and(whereCondition, eq(articles.categoryId, categoryId));
    }

    if (authorId) {
      whereCondition = and(whereCondition, eq(articles.authorId, authorId));
    }

    if (search) {
      whereCondition = and(
        whereCondition,
        or(
          ilike(articles.title, `%${search}%`),
          ilike(articles.excerpt, `%${search}%`),
          ilike(articles.content, `%${search}%`)
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

    if (issueNumber !== undefined) {
      whereCondition = and(whereCondition, eq(articles.issueNumber, issueNumber));
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
        author: normaliseAuthor(row.author),
        category: normaliseCategory(row.category),
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
      .where(and(eq(articles.isFeatured, true), eq(articles.status, 'published'), ne(articles.contentType, 'gallery')))
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

    // Fallback: fill remaining slots from latest published articles with images,
    // excluding any category marked excludeFromHero
    const needed = limit - pinnedWithTags.length;
    const pinnedIds = pinnedWithTags.map(a => a.id);

    const excludedCats = await db
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.excludeFromHero, true));
    const excludedCatIds = new Set(excludedCats.map(c => c.id));

    const pool = (await this.getArticles({ status: 'published', contentType: 'article', limit: needed * 10, orderBy: 'publishedAt', orderDir: 'desc' })).articles;
    const filler = pool
      .filter(a => a.featuredImage && !pinnedIds.includes(a.id) && !excludedCatIds.has(a.categoryId) && a.contentType !== 'gallery')
      .slice(0, needed);

    return [...pinnedWithTags, ...filler];
  }

  async getTrendingArticles(limit = 5): Promise<ArticleWithDetails[]> {
    // Gallery publishes monthly, so a 7-day window almost always returned
    // nothing. Take top-viewed from the last 90 days, then top up with
    // all-time top-viewed if the recent window doesn't have enough.
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const baseSelect = db
      .select({
        article: articles,
        author: authors,
        category: categories,
      })
      .from(articles)
      .leftJoin(authors, eq(articles.authorId, authors.id))
      .leftJoin(categories, eq(articles.categoryId, categories.id));

    const recent = await baseSelect
      .where(
        and(
          eq(articles.status, 'published'),
          eq(articles.contentType, 'article'),
          sql`${articles.publishedAt} >= ${ninetyDaysAgo}`
        )
      )
      .orderBy(desc(articles.views))
      .limit(limit);

    const result = [...recent];

    if (result.length < limit) {
      const have = new Set(result.map(r => r.article.id));
      const fallback = await baseSelect
        .where(
          and(
            eq(articles.status, 'published'),
            eq(articles.contentType, 'article'),
            sql`${articles.views} > 0`
          )
        )
        .orderBy(desc(articles.views))
        .limit(limit * 2);
      for (const row of fallback) {
        if (result.length >= limit) break;
        if (!have.has(row.article.id)) {
          result.push(row);
          have.add(row.article.id);
        }
      }
    }

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
        author: normaliseAuthor(row.author),
        category: normaliseCategory(row.category),
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

  // ---------- Contributors ----------

  async listContributors(): Promise<Contributor[]> {
    const rows = await db.select().from(contributors).orderBy(asc(contributors.name));
    return rows;
  }

  async getContributorBySlug(slug: string): Promise<Contributor | undefined> {
    const [row] = await db.select().from(contributors).where(eq(contributors.slug, slug));
    return row;
  }

  /** Find an existing contributor by name (case-insensitive) or create a new one. */
  async upsertContributorByName(name: string, defaultRole?: string): Promise<Contributor> {
    const trimmed = name.trim();
    const existing = await db
      .select()
      .from(contributors)
      .where(sql`lower(${contributors.name}) = lower(${trimmed})`)
      .limit(1);
    if (existing[0]) return existing[0];
    // Generate a unique slug
    let base = slugifyAuthor(trimmed) || "contributor";
    let slug = base;
    let suffix = 2;
    while ((await db.select({ id: contributors.id }).from(contributors).where(eq(contributors.slug, slug))).length) {
      slug = `${base}-${suffix++}`;
    }
    const [created] = await db
      .insert(contributors)
      .values({ name: trimmed, slug, defaultRole: defaultRole || null })
      .returning();
    return created;
  }

  async updateContributor(id: string, patch: Partial<InsertContributor>): Promise<Contributor | undefined> {
    const [row] = await db
      .update(contributors)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(contributors.id, id))
      .returning();
    return row;
  }

  async getArticleContributors(articleId: string): Promise<Array<Contributor & { role: string; displayOrder: number }>> {
    const rows = await db
      .select({
        c: contributors,
        role: articleContributors.role,
        displayOrder: articleContributors.displayOrder,
      })
      .from(articleContributors)
      .innerJoin(contributors, eq(articleContributors.contributorId, contributors.id))
      .where(eq(articleContributors.articleId, articleId))
      .orderBy(asc(articleContributors.role), asc(articleContributors.displayOrder));
    return rows.map((r) => ({ ...r.c, role: r.role, displayOrder: r.displayOrder ?? 0 }));
  }

  /** Replace the entire set of contributors on an article. */
  async setArticleContributors(
    articleId: string,
    credits: Array<{ contributorId: string; role: string; displayOrder?: number }>,
  ): Promise<void> {
    await db.transaction(async (tx) => {
      await tx.delete(articleContributors).where(eq(articleContributors.articleId, articleId));
      if (credits.length > 0) {
        await tx.insert(articleContributors).values(
          credits.map((c, i) => ({
            articleId,
            contributorId: c.contributorId,
            role: c.role,
            displayOrder: c.displayOrder ?? i,
          })),
        );
      }
    });
  }

  async getSplashSlides(): Promise<(ArticleWithDetails & { position: number })[]> {
    // Join splashSlides → articles/authors/categories so callers get everything
    // they need in one round-trip. Empty positions (articleId NULL) are skipped.
    const rows = await db
      .select({
        position: splashSlides.position,
        article: articles,
        author: authors,
        category: categories,
      })
      .from(splashSlides)
      .leftJoin(articles, eq(splashSlides.articleId, articles.id))
      .leftJoin(authors, eq(articles.authorId, authors.id))
      .leftJoin(categories, eq(articles.categoryId, categories.id))
      .orderBy(asc(splashSlides.position));

    const out: (ArticleWithDetails & { position: number })[] = [];
    for (const r of rows) {
      if (!r.article || !r.author || !r.category) continue;
      out.push({
        ...r.article,
        author: r.author,
        category: r.category,
        tags: [],
        position: r.position,
      });
    }
    return out;
  }

  async setSplashSlides(articleIds: (string | null)[]): Promise<void> {
    // Replace all three positions in one transaction so the splash never sees
    // a half-updated state.
    await db.transaction(async (tx) => {
      await tx.delete(splashSlides);
      const values = articleIds.slice(0, 3).map((articleId, position) => ({
        position,
        articleId: articleId || null,
        updatedAt: new Date(),
      }));
      if (values.length > 0) {
        await tx.insert(splashSlides).values(values);
      }
    });
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

  // Subscribers
  async createSubscriber(input: InsertSubscriber): Promise<Subscriber> {
    const email = input.email.trim().toLowerCase();
    // Re-subscribe if a previously-unsubscribed row exists
    const existing = await db.select().from(subscribers).where(eq(subscribers.email, email)).limit(1);
    if (existing[0]) {
      if (existing[0].unsubscribedAt) {
        const [reactivated] = await db
          .update(subscribers)
          .set({ unsubscribedAt: null, subscribedAt: new Date(), source: input.source ?? existing[0].source })
          .where(eq(subscribers.id, existing[0].id))
          .returning();
        return reactivated;
      }
      return existing[0];
    }
    const [created] = await db
      .insert(subscribers)
      .values({ email, name: input.name ?? null, source: input.source ?? 'web' })
      .returning();
    return created;
  }

  async listSubscribers(options: { activeOnly?: boolean; limit?: number; offset?: number } = {}): Promise<{ subscribers: Subscriber[]; total: number }> {
    const { activeOnly = false, limit = 200, offset = 0 } = options;
    const where = activeOnly ? sql`unsubscribed_at is null` : undefined;
    const rows = await db
      .select()
      .from(subscribers)
      .where(where)
      .orderBy(desc(subscribers.subscribedAt))
      .limit(limit)
      .offset(offset);
    const [{ count: total }] = await db
      .select({ count: count() })
      .from(subscribers)
      .where(where);
    return { subscribers: rows, total };
  }

  async unsubscribeByToken(token: string): Promise<boolean> {
    const [row] = await db
      .update(subscribers)
      .set({ unsubscribedAt: new Date() })
      .where(and(eq(subscribers.unsubscribeToken, token), sql`unsubscribed_at is null`))
      .returning();
    return Boolean(row);
  }
}

export const storage = new DatabaseStorage();
