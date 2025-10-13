# Design Guidelines: Modern Magazine CMS

## Design Approach: Reference-Based (Editorial Media)

**Primary Inspiration:** Medium's reading experience + Kinfolk's minimalist aesthetic + Vogue's sophisticated layouts

**Core Principles:**
- Typography-first hierarchy with generous whitespace
- Image-forward storytelling with cinematic aspect ratios
- Sophisticated color restraint favoring neutrals
- Elegant transitions and micro-interactions

## Color Palette

**Dark Mode (Primary):**
- Background: 0 0% 7% (deep charcoal)
- Surface: 0 0% 12% (elevated charcoal)
- Text Primary: 0 0% 95%
- Text Secondary: 0 0% 65%
- Accent: 25 90% 55% (warm terracotta for featured elements)
- Border: 0 0% 20%

**Light Mode:**
- Background: 0 0% 98% (off-white)
- Surface: 0 0% 100%
- Text Primary: 0 0% 10%
- Text Secondary: 0 0% 40%
- Accent: 25 75% 45%
- Border: 0 0% 88%

## Typography

**Font Families:**
- Display/Headings: Playfair Display (serif, elegant)
- Body/UI: Inter (clean, readable)

**Scale:**
- Hero Headlines: text-6xl to text-7xl, font-light, tracking-tight
- Article Titles: text-4xl to text-5xl, font-normal
- Section Headers: text-2xl to text-3xl, font-medium
- Body: text-lg, leading-relaxed (optimal reading)
- Captions: text-sm, text-secondary, italic

## Layout System

**Spacing Primitives:** Consistent use of 4, 6, 8, 12, 16, 24, 32 units

**Grid Structure:**
- Container: max-w-7xl for full layouts
- Reading width: max-w-3xl for article content
- Gallery grids: 2-column mobile, 3-4 column desktop with gap-6 to gap-8

**Vertical Rhythm:**
- Section padding: py-16 mobile, py-24 to py-32 desktop
- Component spacing: space-y-12 to space-y-16

## Component Library

### Navigation
- Sticky header with blur backdrop (backdrop-blur-xl)
- Minimal logo + category pills + search icon
- Mobile: hamburger with full-screen overlay menu
- Height: h-16 to h-20 with border-b

### Hero Section (Image-Forward)
- Full-width cinematic image (16:9 or 21:9 aspect)
- Gradient overlay for text legibility
- Featured article with: category tag, headline (text-6xl), author byline, read time
- CTA: Subtle outline button with blur background (bg-white/10 backdrop-blur-md)
- Height: 70vh to 85vh

### Article Grid/Masonry
- Mixed layouts: Featured (large card spanning 2 columns) + Standard cards
- Card anatomy: Image (3:2 aspect), category badge, title, excerpt (2 lines), author avatar + name, date
- Hover: Subtle scale (scale-105) and shadow elevation
- Grid: grid-cols-1 md:grid-cols-2 lg:grid-cols-3

### Image Gallery Component
- Justified grid layout with varying heights
- Lazy loading with skeleton placeholders
- Click triggers lightbox with fade-in (300ms ease)
- Gallery navigation: arrow keys + swipe gestures

### Lightbox
- Full-screen dark backdrop (bg-black/95)
- Centered image with max-height constraint
- Controls: Close (X top-right), Prev/Next arrows, thumbnail strip at bottom
- Image counter: "3 / 12" overlay
- Smooth crossfade between images (200ms)

### Article Reader
- Centered column (max-w-3xl)
- Drop cap for opening paragraph
- Pull quotes: Larger serif font, border-l-4, italic
- Image breaks: Full-bleed or contained with captions
- Related articles footer

### Category Pages
- Header: Category name + description + cover image
- Filter pills: All, Latest, Popular, Most Read
- Infinite scroll with "Load More" trigger

### Footer
- Multi-column: Newsletter signup | Quick links | Categories | Social
- Newsletter: Email input with inline submit button
- Legal links and copyright in smaller text

## Images Strategy

**Hero Section:** 
Large, high-impact editorial photography - landscape orientation, professional journalism style, strong visual narrative

**Article Cards:**
3:2 aspect ratio thumbnails - should represent article content, high quality

**Gallery Images:**
Mixed aspect ratios (portrait, landscape, square) - fine art photography, photo essays, professional editorial work

**Author Avatars:**
Circular, small (h-10 w-10) - professional headshots

**Category Headers:**
Wide banner images (21:9) - thematic, atmospheric photography

## Interaction Design

**Animations (Minimal):**
- Page transitions: Fade content (200ms)
- Card hovers: Scale + shadow (150ms ease-out)
- Lightbox: Backdrop fade + image scale (300ms)
- Scroll reveals: Fade up on featured content only

**Micro-interactions:**
- Button states: Native browser defaults
- Input focus: Ring with accent color
- Image loading: Blur-up progressive enhancement

## Accessibility
- Focus indicators: 2px accent ring with offset
- Skip to content link
- Alt text for all images
- Lightbox: Keyboard navigation (ESC, arrows)
- ARIA labels for icon buttons

**Key Differentiators:**
Typography hierarchy creates elegant reading flow, generous whitespace prevents visual clutter, cinematic image ratios create editorial sophistication, restrained accent color maintains professional tone.