# Modern Magazine CMS

## Overview

Modern Magazine is a full-stack content management system (CMS) built for publishing and managing editorial content. The application provides a modern magazine-style frontend for readers and a comprehensive admin dashboard for content creators. It supports rich article management, categorization, tagging, WordPress content migration, and file uploads to cloud storage.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Technology Stack:**
- **Framework:** React with TypeScript
- **Routing:** Wouter (lightweight React router)
- **State Management:** TanStack Query (React Query) for server state
- **UI Components:** Radix UI primitives with shadcn/ui design system
- **Styling:** Tailwind CSS with CSS variables for theming
- **Forms:** React Hook Form with Zod validation

**Design Decisions:**
- Component-based architecture with clear separation between pages, UI components, and business logic components
- Shadcn/ui chosen for consistent, accessible component library with customization flexibility
- TanStack Query handles all server state, caching, and data synchronization
- Custom theming system using CSS variables for easy brand customization
- Responsive design prioritizing mobile-first approach

**Image Gallery & Lightbox (NEW - October 2025):**
- **Library:** yet-another-react-lightbox for full-screen image viewing
- **Auto-Detection:** ArticleGallery component automatically detects consecutive `wp-block-image` elements
- **Gallery Grouping:** 3+ consecutive images are wrapped in a grid layout (`gallery-grid`)
- **Click Behavior:** All article images are clickable and open in lightbox
- **Navigation:** Keyboard (arrows, ESC) and click navigation through all images
- **WordPress Support:** Handles both Gutenberg block images and classic WordPress galleries

**Year Filter (NEW - October 2025):**
- **Frontend:** Year dropdown filter on homepage alongside category filters
- **Range:** Dynamically shows years 2008-2025 (newest first)
- **Default:** "All Years" shows all articles
- **Backend:** SQL EXTRACT function filters by `published_at` year
- **Combined Filtering:** Works seamlessly with category and search filters
- **Admin Dashboard:** Also available in admin article list for content review

**Typography & Content Cleanup (October 2025):**
- **Inline Style Removal:** Cleaned 2,447 articles (86% of total) to remove inline font formatting
- **Removed Styles:** font-family, font-size, color, font-weight, font-style
- **Preserved Styles:** text-align for intentional alignment
- **Result:** Consistent typography across all body copy using global CSS styles

**Author Management (NEW - October 2025):**
- **WordPress Import:** Automatically extracts and creates individual authors from `dc:creator` XML tags
- **Admin Dashboard:** Full CRUD operations (Create, Read, Update, Delete) for managing authors
- **Author Caching:** Import process caches authors to avoid duplicates during batch imports
- **Article Editor:** Author dropdown selection integrated into article creation/editing workflow
- **Email Generation:** Auto-generates unique emails for imported WordPress authors (@imported.local domain)

### Backend Architecture

**Technology Stack:**
- **Runtime:** Node.js with TypeScript
- **Framework:** Express.js for RESTful API
- **Database ORM:** Drizzle ORM with PostgreSQL dialect
- **Database Provider:** Neon serverless PostgreSQL
- **Build Tool:** Vite for frontend, esbuild for backend bundling
- **Development:** tsx for TypeScript execution

**Design Decisions:**
- RESTful API architecture with clear endpoint structure (`/api/*`)
- Separation of concerns: routes, storage layer, and database access are isolated
- Storage abstraction layer (`IStorage` interface) allows for future database switching
- Drizzle ORM chosen for type-safe database queries with minimal overhead
- Middleware for request logging and JSON parsing with raw body access for webhooks

### Data Architecture

**Database Schema:**
- **Authors:** User profiles for content creators (name, email, bio, avatar)
- **Categories:** Hierarchical content organization with slugs and colors
- **Tags:** Flexible content labeling system
- **Articles:** Core content with rich metadata (title, slug, content, SEO fields, WordPress import tracking)
- **Article Tags:** Many-to-many relationship between articles and tags
- **Media:** File metadata tracking for uploaded assets
- **Users:** Legacy user authentication system (may be deprecated)

**Key Design Patterns:**
- Slug-based URL routing for SEO-friendly URLs
- Status-based content workflow (draft, published, archived)
- View counting and read time estimation for engagement metrics
- WordPress import compatibility with `wpId` tracking
- Comprehensive SEO metadata fields (meta title, meta description, canonical URLs)

### File Upload & Storage

**Dual Storage System:**
- **Primary (R2):** Cloudflare R2 for new uploads - S3-compatible object storage
- **Secondary (GCS):** Google Cloud Storage - legacy/fallback system for Replit-hosted uploads
- **Authentication:** 
  - R2: API credentials (access key, secret key, account ID)
  - GCS: External account credentials via Replit sidecar
- **Upload Strategy:** Server-side processing with Multer for file handling

**R2 Integration (NEW - October 2025):**
- **Provider:** Cloudflare R2 (S3-compatible)
- **SDK:** AWS SDK for JavaScript v3 (@aws-sdk/client-s3, @aws-sdk/lib-storage)
- **Upload Flow:** 
  1. Multer receives file upload
  2. Sharp processes and generates variants
  3. R2 client uploads all variants to Cloudflare bucket
  4. Returns full R2 public URLs (stored as absolute URLs in database)
- **URL Structure:** `https://pub-{account-id}.r2.dev/{key-path}`
- **Fallback:** If R2 credentials missing, falls back to GCS with `/objects/` prefix

**Image Optimization (October 2025):**
- **Processing:** Sharp library for server-side image processing
- **Responsive Variants:** Automatic generation of thumbnail (300px), medium (800px), and large (1200px) sizes
- **WebP Conversion:** All images converted to WebP format for better compression
- **Storage:** 
  - R2 uploads: All variants stored with full public URLs in media.variants JSON field
  - GCS uploads: Paths stored with /objects/ prefix for local serving
- **Lazy Loading:** IntersectionObserver-based lazy loading with progressive blur-to-sharp transitions
- **Performance:** Images load only when near viewport with 50px rootMargin for preloading

**Media Indexing & Cleanup (October 2025):**
- **URL-Based Indexing:** Scans all articles (published, draft, archived) to extract and index external R2 image URLs
- **Bucket Indexing:** Scans Replit GCS bucket to index unindexed local images into media library
- **Storage Analysis:** Breakdown of storage usage by variant type (original, thumbnail, medium, large)
- **Indexing Stats:** Tracks indexed vs unindexed original images (variants excluded from count)
- **Variant Cleanup:** Selective deletion of specific variant types (thumbnail/medium/large) with confirmation dialogs
- **Admin Interface:** Dedicated "Storage & Indexing" tab in admin dashboard for all storage management tasks
- **Use Cases:** Indexing WordPress-imported R2 images, cleaning up unnecessary variant sizes, storage optimization

**Design Decisions:**
- R2 chosen as primary storage for cost-effectiveness and performance (Cloudflare CDN)
- Dual storage approach supports both legacy GCS content and new R2 uploads
- MediaManager detects URL vs path-based images and handles display accordingly
- Multer middleware for server-side file handling and Sharp for processing
- Storage analysis only counts original images (not variants) for indexed/unindexed metrics to avoid inflated counts
- URL-based indexing solves WordPress migration issue where images are in external R2 bucket

### Content Import

**WordPress Migration:**
- XML-based WordPress export parser
- Imports posts, categories, tags, authors, and media references
- Custom field mapping and error tracking
- Batch import with progress reporting

**Design Decisions:**
- DOM parser for XML processing to handle WordPress export format
- Maintains WordPress post IDs for reference and deduplication
- Graceful error handling with detailed error reporting
- Preserves content relationships (categories, tags, authors)

## External Dependencies

### Third-Party Services

**Google Cloud Storage:**
- Purpose: Object storage for uploaded media files
- Integration: Via `@google-cloud/storage` SDK
- Authentication: Replit sidecar endpoint providing credentials
- Used for: Featured images, article media, author avatars

**Neon Database:**
- Purpose: Serverless PostgreSQL database
- Integration: Via `@neondatabase/serverless` with WebSocket support
- Configuration: Connection pooling with Drizzle ORM
- Environment: Requires `DATABASE_URL` environment variable

### Key NPM Packages

**UI & Frontend:**
- `@radix-ui/*` - Accessible UI primitives for all interactive components
- `@tanstack/react-query` - Server state management and caching
- `react-hook-form` - Form handling with validation
- `zod` - Schema validation for forms and API data
- `date-fns` - Date formatting and manipulation
- `wouter` - Lightweight routing

**File Upload:**
- `@uppy/core` - Core upload functionality
- `@uppy/dashboard` - Upload UI component
- `@uppy/aws-s3` - S3-compatible upload (used with GCS)
- `@uppy/react` - React integration

**Backend & Database:**
- `drizzle-orm` - Type-safe ORM
- `drizzle-kit` - Database migration toolkit
- `express` - Web framework
- `@xmldom/xmldom` - XML parsing for WordPress imports
- `ws` - WebSocket support for Neon database

**Development:**
- `vite` - Build tool and dev server
- `tsx` - TypeScript execution
- `esbuild` - Production bundling
- `tailwindcss` - Utility-first CSS framework