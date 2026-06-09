import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, boolean, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// "authors" is now the unified people table — used for article bylines
// AND for issue contributors. The legacy "authors_email_unique" constraint
// is replaced with a partial unique index in the DB (only enforced when
// email is non-null), since contributors don't always have an email.
export const authors = pgTable("authors", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  slug: text("slug").unique(),          // URL slug for /author/:slug — backfilled from name
  email: text("email"), // nullable — contributors usually don't have one
  bio: text("bio"),
  avatar: text("avatar"),
  photoUrl: text("photo_url"),         // alternate photo (e.g. contributor portrait)
  defaultRole: text("default_role"),    // optional, e.g. "Photographer", "Editorial"
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const categories = pgTable("categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  color: text("color").default("#3B82F6"),
  parentId: varchar("parent_id").references((): any => categories.id),
  excludeFromHero: boolean("exclude_from_hero").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const tags = pgTable("tags", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  slug: text("slug").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const articles = pgTable("articles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  slug: text("slug").notNull().unique(),
  excerpt: text("excerpt"),
  content: text("content").notNull(),
  featuredImage: text("featured_image"),
  // Higher-resolution image used in the splash intro slideshow. Optional;
  // falls back to featuredImage when null.
  splashImage: text("splash_image"),
  // Optional ordered image gallery for the article page. JSON-encoded array
  // of { url: string, caption?: string }; rendered as a slider above the
  // body when present.
  galleryImages: json("gallery_images").$type<{ url: string; caption?: string }[]>(),
  status: text("status").notNull().default("draft"), // draft, published, archived
  views: integer("views").default(0).notNull(),
  readTime: integer("read_time").default(5).notNull(), // in minutes
  authorId: varchar("author_id").references(() => authors.id).notNull(),
  // Optional credit fields. The "Words: …" byline normally matches the
  // article's set author; these capture the OTHER credits that often
  // appeared as a leading "Photography: X, Illustration: Y" sentence in
  // imported WordPress content.
  photographer: text("photographer"),
  illustrator: text("illustrator"),
  categoryId: varchar("category_id").references(() => categories.id).notNull(),
  publishedAt: timestamp("published_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  // SEO fields
  metaTitle: text("meta_title"),
  metaDescription: text("meta_description"),
  // WordPress import data
  wpId: integer("wp_id"), // original WordPress post ID
  wpData: json("wp_data"), // store original WordPress data for reference
  // Hero rotation
  isFeatured: boolean("is_featured").default(false).notNull(),
  featuredOrder: integer("featured_order").default(0).notNull(),
  // Content type: 'article' | 'cartoon'
  contentType: text("content_type").notNull().default("article"),
  // Issue number (bimonthly edition)
  issueNumber: integer("issue_number"),
});

export const issues = pgTable("issues", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  number: integer("number").notNull().unique(),
  title: text("title"),
  pdfUrl: text("pdf_url"),
  coverImage: text("cover_image"),
  coverImageAlt: text("cover_image_alt"),
  publishedAt: timestamp("published_at"),
  displayLabel: text("display_label"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Issue = typeof issues.$inferSelect;
export type InsertIssue = typeof issues.$inferInsert;

export const articleTags = pgTable("article_tags", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  articleId: varchar("article_id").references(() => articles.id, { onDelete: "cascade" }).notNull(),
  tagId: varchar("tag_id").references(() => tags.id, { onDelete: "cascade" }).notNull(),
});

export const media = pgTable("media", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  filename: text("filename").notNull(),
  originalName: text("original_name").notNull(),
  mimeType: text("mime_type").notNull(),
  size: integer("size").notNull(), // in bytes
  width: integer("width"),
  height: integer("height"),
  objectPath: text("object_path").notNull(), // path in object storage
  alt: text("alt"),
  // Responsive image variants (JSON format: { thumbnail: string, medium: string, large: string, webp: string })
  variants: json("variants"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Contributors — non-author credits attached to articles (photographer,
// illustrator, stylist, etc). Distinct from `authors` (which powers the
// "By X" byline). Joined to articles via article_contributors so an
// article can have multiple of each role.
export const contributors = pgTable("contributors", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  bio: text("bio"),
  photoUrl: text("photo_url"),
  email: text("email"),
  defaultRole: text("default_role"),  // 'photographer' | 'illustrator' | 'stylist' | …
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const articleContributors = pgTable("article_contributors", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  articleId: varchar("article_id").references(() => articles.id, { onDelete: "cascade" }).notNull(),
  contributorId: varchar("contributor_id").references(() => contributors.id, { onDelete: "cascade" }).notNull(),
  role: text("role").notNull(),       // 'photographer' | 'illustrator' | 'stylist' | …
  displayOrder: integer("display_order").default(0),
});

export const insertContributorSchema = createInsertSchema(contributors).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type Contributor = typeof contributors.$inferSelect;
export type InsertContributor = z.infer<typeof insertContributorSchema>;
export type ArticleContributor = typeof articleContributors.$inferSelect;

// Curated images for the homepage splash intro. Position is the slide index
// (0, 1, 2). Three rows total; managed via /admin → Splash Intro.
export const splashSlides = pgTable("splash_slides", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  position: integer("position").notNull().unique(),
  articleId: varchar("article_id").references(() => articles.id, { onDelete: "set null" }),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Relations
export const authorsRelations = relations(authors, ({ many }) => ({
  articles: many(articles),
}));

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  articles: many(articles),
  parent: one(categories, {
    fields: [categories.parentId],
    references: [categories.id],
    relationName: "categoryHierarchy",
  }),
  children: many(categories, {
    relationName: "categoryHierarchy",
  }),
}));

export const tagsRelations = relations(tags, ({ many }) => ({
  articleTags: many(articleTags),
}));

export const articlesRelations = relations(articles, ({ one, many }) => ({
  author: one(authors, {
    fields: [articles.authorId],
    references: [authors.id],
  }),
  category: one(categories, {
    fields: [articles.categoryId],
    references: [categories.id],
  }),
  articleTags: many(articleTags),
}));

export const articleTagsRelations = relations(articleTags, ({ one }) => ({
  article: one(articles, {
    fields: [articleTags.articleId],
    references: [articles.id],
  }),
  tag: one(tags, {
    fields: [articleTags.tagId],
    references: [tags.id],
  }),
}));

// Insert schemas
export const insertAuthorSchema = createInsertSchema(authors).omit({
  id: true,
  createdAt: true,
});

export const insertCategorySchema = createInsertSchema(categories).omit({
  id: true,
  createdAt: true,
});

export const insertTagSchema = createInsertSchema(tags).omit({
  id: true,
  createdAt: true,
});

export const insertArticleSchema = createInsertSchema(articles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  views: true,
});

export const insertMediaSchema = createInsertSchema(media).omit({
  id: true,
  createdAt: true,
});

// Types
export type Author = typeof authors.$inferSelect;
export type InsertAuthor = z.infer<typeof insertAuthorSchema>;

export type Category = typeof categories.$inferSelect;
export type InsertCategory = z.infer<typeof insertCategorySchema>;

export type Tag = typeof tags.$inferSelect;
export type InsertTag = z.infer<typeof insertTagSchema>;

export type Article = typeof articles.$inferSelect;
export type InsertArticle = z.infer<typeof insertArticleSchema>;

export type ArticleTag = typeof articleTags.$inferSelect;

export type Media = typeof media.$inferSelect;
export type InsertMedia = z.infer<typeof insertMediaSchema>;

// Extended types for API responses
export type ArticleWithDetails = Article & {
  author: Author;
  category: Category;
  tags: Tag[];
};

// Issue contributors — now an associative table linking authors to issues.
// The legacy name/bio/photoUrl columns remain as a backstop for rows that
// pre-date the merge; new rows should write only authorId + role + pageRef.
export const issueContributors = pgTable("issue_contributors", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  issueNumber: integer("issue_number").notNull(),
  authorId: varchar("author_id").references(() => authors.id, { onDelete: "set null" }),
  name: text("name").notNull(),  // kept for fallback; canonical source is authors.name
  bio: text("bio"),
  pageRef: text("page_ref"),
  role: text("role"),
  photoUrl: text("photo_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertIssueContributorSchema = createInsertSchema(issueContributors).omit({
  id: true,
  createdAt: true,
});

export type IssueContributor = typeof issueContributors.$inferSelect;
export type InsertIssueContributor = z.infer<typeof insertIssueContributorSchema>;

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

// Newsletter subscribers
export const subscribers = pgTable("subscribers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  name: text("name"),
  source: text("source").default("web"), // "footer" | "sidebar" | "admin" | …
  unsubscribeToken: varchar("unsubscribe_token")
    .notNull()
    .default(sql`gen_random_uuid()`),
  subscribedAt: timestamp("subscribed_at").defaultNow().notNull(),
  unsubscribedAt: timestamp("unsubscribed_at"),
});

export const insertSubscriberSchema = createInsertSchema(subscribers, {
  email: (schema) => schema.email("Please enter a valid email"),
}).pick({
  email: true,
  name: true,
  source: true,
});

export type Subscriber = typeof subscribers.$inferSelect;
export type InsertSubscriber = z.infer<typeof insertSubscriberSchema>;

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
