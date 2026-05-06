# Gallery Magazine CMS

Gallery is a full-stack CMS for gallery.je, a Jersey lifestyle magazine, providing content creation, media management, and WordPress migration capabilities.

## Run & Operate

*   **Run Dev Server:** `npm run dev`
*   **Build Frontend:** `npm run build:client`
*   **Build Backend:** `npm run build:server`
*   **Typecheck:** `npm run typecheck`
*   **Generate Drizzle Kit Migrations:** `drizzle-kit generate:pg`
*   **Push DB Schema:** `drizzle-kit push:pg`

**Required Environment Variables:**
`DATABASE_URL`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_ACCOUNT_ID`

## Stack

*   **Frontend:** React, TypeScript, Wouter, TanStack Query, Radix UI, shadcn/ui, Tailwind CSS
*   **Backend:** Node.js, TypeScript, Express.js
*   **Database:** PostgreSQL (Neon) via Drizzle ORM
*   **Validation:** Zod
*   **Build Tool:** Vite (frontend), esbuild (backend)
*   **Runtime:** Node.js (with `tsx` for dev)

## Where things live

*   `/client`: Frontend source code
*   `/server`: Backend source code
*   `/db`: Database schema (`schema.ts`), migrations
*   `/public`: Static assets
*   `/admin`: Admin dashboard specific components and pages
*   `client/src/index.css`: Frontend CSS tokens and global styles
*   `server/src/routes`: API endpoint definitions
*   `server/src/storage`: Media storage abstraction
*   `server/src/wordpress`: WordPress import logic

## Architecture decisions

*   **Monocle-inspired Design System:** Enforced via CSS variables and shadcn/ui overrides for a distinct editorial aesthetic (square buttons, specific fonts, limited color palette).
*   **Dual Object Storage:** Cloudflare R2 for new uploads (primary) and Google Cloud Storage (GCS) for legacy/fallback.
*   **Server-Side Image Processing:** Sharp.js generates responsive WebP variants directly on upload for performance.
*   **R2 URL Standardization & Rationalization:** System to analyze, normalize, and clean up R2 image URLs across articles, ensuring optimal variants and removing unused files.
*   **Type-Safe ORM:** Drizzle ORM selected for end-to-end type safety from database to API to frontend.

## Product

*   **Content Management:** Create, edit, publish, draft, and archive articles, categories, and authors.
*   **Media Library:** Upload, manage, and optimize images with automatic responsive variant generation and WebP conversion.
*   **WordPress Migration:** Import articles, authors, categories, and media from WordPress XML exports, including content cleanup.
*   **Frontend Display:** Public-facing magazine site with editorial design, category/year filtering, image galleries with lightbox, and SEO-friendly URLs.
*   **Admin Dashboard:** Comprehensive interface for content, media, author, and system management tasks.
*   **Contributors:** `issue_contributors` DB table populated by `scripts/extract_contributors.py` (PyMuPDF). Admin UI at Contributors sidebar item — extract all/one issue, browse by issue, edit/delete records. API: `GET /api/contributors`, `GET /api/contributors/issues`, `POST /api/contributors/extract`.

## User preferences

Preferred communication style: Simple, everyday language.

## Gotchas

*   **R2 Configuration:** Ensure all R2 environment variables (`R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_ACCOUNT_ID`) are correctly set; missing credentials will cause image uploads to fall back to GCS or fail.
*   **WordPress Cleanup:** Always review the configurable options in the Admin Dashboard > Media > WordPress Cleanup tab before running, as it performs destructive operations on article HTML.
*   **Image Rationalization:** Running the "Image Rationalization" tool in the admin panel will permanently delete unused image variants from R2. Back up data if unsure.

## Pointers

*   **Shadcn/ui Docs:** `https://ui.shadcn.com/docs`
*   **Drizzle ORM Docs:** `https://orm.drizzle.team/docs/overview`
*   **Tailwind CSS Docs:** `https://tailwindcss.com/docs`
*   **Cloudflare R2 Docs:** `https://developers.cloudflare.com/r2/`
*   **TanStack Query Docs:** `https://tanstack.com/query/latest/docs/react/overview`