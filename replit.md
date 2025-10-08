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

**Object Storage System:**
- **Provider:** Google Cloud Storage
- **Authentication:** External account credentials via Replit sidecar
- **Upload Strategy:** Client-side direct uploads using Uppy dashboard
- **ACL System:** Custom access control with group-based permissions (defined but not fully implemented)

**Design Decisions:**
- Uppy chosen for robust, customizable file upload experience with progress tracking
- Direct-to-GCS uploads reduce server load and improve performance
- ACL policy framework prepared for fine-grained access control
- Multer middleware for server-side file handling when needed

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