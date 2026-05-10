// Sitemap generation. Builds XML for search engines (/sitemap.xml) and
// the data shape for the human-readable /sitemap page on the client.

import { db } from "./db";
import { sql } from "drizzle-orm";
import { articles, categories, issues } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";

export type SitemapData = {
  base: string;
  staticPages: { path: string; label: string }[];
  categories: { slug: string; name: string }[];
  articles: { slug: string; title: string; updatedAt: string }[];
  issues: { number: number; displayLabel: string | null; publishedAt: string | null }[];
};

const STATIC_PAGES = [
  { path: "/", label: "Home" },
  { path: "/current-issue", label: "Current Issue" },
  { path: "/archive", label: "Back Issues" },
  { path: "/about", label: "About" },
  { path: "/media-pack", label: "Advertise" },
  { path: "/privacy", label: "Privacy Policy" },
  { path: "/terms", label: "Terms of Service" },
  { path: "/cookies", label: "Cookie Policy" },
  { path: "/sitemap", label: "Sitemap" },
];

export async function getSitemapData(origin: string): Promise<SitemapData> {
  const [articleRows, categoryRows, issueRows] = await Promise.all([
    db
      .select({
        slug: articles.slug,
        title: articles.title,
        updatedAt: articles.updatedAt,
      })
      .from(articles)
      .where(and(eq(articles.status, "published"), eq(articles.contentType, "article")))
      .orderBy(desc(articles.updatedAt)),
    db
      .select({ slug: categories.slug, name: categories.name })
      .from(categories)
      .orderBy(categories.name),
    db
      .select({
        number: issues.number,
        displayLabel: issues.displayLabel,
        publishedAt: issues.publishedAt,
      })
      .from(issues)
      .where(sql`${issues.publishedAt} <= now()`)
      .orderBy(desc(issues.number)),
  ]);

  return {
    base: origin.replace(/\/$/, ""),
    staticPages: STATIC_PAGES,
    categories: categoryRows,
    articles: articleRows.map((a) => ({
      slug: a.slug,
      title: a.title,
      updatedAt: (a.updatedAt as Date).toISOString(),
    })),
    issues: issueRows.map((i) => ({
      number: i.number,
      displayLabel: i.displayLabel,
      publishedAt: i.publishedAt ? (i.publishedAt as Date).toISOString() : null,
    })),
  };
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function renderSitemapXml(data: SitemapData): string {
  const now = new Date().toISOString();
  const url = (loc: string, lastmod?: string, changefreq?: string, priority?: string) => {
    const parts = [`<loc>${escapeXml(data.base + loc)}</loc>`];
    if (lastmod) parts.push(`<lastmod>${lastmod.slice(0, 10)}</lastmod>`);
    if (changefreq) parts.push(`<changefreq>${changefreq}</changefreq>`);
    if (priority) parts.push(`<priority>${priority}</priority>`);
    return `  <url>${parts.join("")}</url>`;
  };

  const lines: string[] = [];
  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');

  // Statics
  for (const p of data.staticPages) {
    const priority = p.path === "/" ? "1.0" : "0.6";
    lines.push(url(p.path, now, "weekly", priority));
  }
  // Categories
  for (const c of data.categories) {
    lines.push(url(`/category/${c.slug}`, now, "weekly", "0.7"));
  }
  // Articles
  for (const a of data.articles) {
    lines.push(url(`/article/${a.slug}`, a.updatedAt, "monthly", "0.8"));
  }
  // Issue archive entries — current-issue with deep link
  for (const i of data.issues) {
    lines.push(
      url(
        `/current-issue?issue=${i.number}`,
        i.publishedAt ?? undefined,
        "monthly",
        "0.5",
      ),
    );
  }

  lines.push("</urlset>");
  return lines.join("\n");
}

export function renderRobotsTxt(origin: string): string {
  return [
    "User-agent: *",
    "Allow: /",
    "Disallow: /admin",
    "Disallow: /api/",
    "",
    `Sitemap: ${origin.replace(/\/$/, "")}/sitemap.xml`,
    "",
  ].join("\n");
}
