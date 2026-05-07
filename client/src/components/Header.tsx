import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Menu, X, UserCircle, ChevronDown, BookOpen } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";

const PRIMARY_SLUGS = ["people", "fashion", "appetite-1", "culture", "travel-1", "interiors", "business", "events"];

interface HeaderProps {
  onSearch?: (search: string, category?: string, year?: string) => void;
}

// Fetches 3 recent articles with images for a given category — used by hover dropdowns
function useCategoryPreview(categoryId: string | null, enabled: boolean) {
  return useQuery<{ articles: any[] }>({
    queryKey: [`/api/articles?categoryId=${categoryId}&withImage=true&limit=3`],
    enabled: enabled && !!categoryId,
    staleTime: 5 * 60 * 1000,
  });
}

// Mini article card shown inside dropdown
function PreviewCard({ article }: { article: any }) {
  return (
    <Link href={`/article/${article.slug}`}>
      <div className="flex gap-3 group cursor-pointer py-2 hover:opacity-80 transition-opacity">
        {article.featuredImage && (
          <div className="shrink-0 w-16 h-12 overflow-hidden bg-[hsl(0,0%,92%)]">
            <img src={article.featuredImage} alt={article.title}
              className="w-full h-full object-cover" loading="lazy" />
          </div>
        )}
        <div className="min-w-0">
          <p className="line-clamp-2 text-foreground group-hover:text-secondary transition-colors"
            style={{ fontFamily: "Georgia, serif", fontSize: 13, lineHeight: 1.4 }}>
            {article.title}
          </p>
          <p className="mt-0.5" style={{ fontFamily: "Arial, sans-serif", fontSize: 11, color: "hsl(0 0% 55%)" }}>
            {format(new Date(article.publishedAt || article.createdAt), "d MMM yyyy")}
          </p>
        </div>
      </div>
    </Link>
  );
}

// Hover dropdown panel for a primary nav item
function NavDropdown({ category, onClose }: { category: any; onClose: () => void }) {
  const { data } = useCategoryPreview(category.id, true);
  const articles = data?.articles || [];

  return (
    <div
      className="absolute top-full left-1/2 -translate-x-1/2 bg-white border border-border shadow-xl z-50 w-[320px] p-5"
      onMouseLeave={onClose}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3 pb-3 border-b border-border">
        <span style={{ fontFamily: "Arial, sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "hsl(0 0% 55%)" }}>
          Latest in {category.name}
        </span>
        <Link href={`/category/${category.slug}`}>
          <span className="text-secondary hover:underline cursor-pointer"
            style={{ fontFamily: "Arial, sans-serif", fontSize: 11 }}
            onClick={onClose}>
            See all →
          </span>
        </Link>
      </div>

      {articles.length === 0 ? (
        <p style={{ fontFamily: "Arial, sans-serif", fontSize: 12, color: "hsl(0 0% 60%)" }}>No recent articles.</p>
      ) : (
        <div className="space-y-1 divide-y divide-border" onClick={onClose}>
          {articles.map((a: any) => <PreviewCard key={a.id} article={a} />)}
        </div>
      )}

      {category.description && (
        <p className="mt-3 pt-3 border-t border-border"
          style={{ fontFamily: "Georgia, serif", fontSize: 12, fontStyle: "italic", color: "hsl(0 0% 55%)", lineHeight: 1.5 }}>
          {category.description}
        </p>
      )}
    </div>
  );
}

// Current Issue dropdown
function CurrentIssueDropdown({ onClose }: { onClose: () => void }) {
  const { data, isLoading } = useQuery<{ articles: any[]; cutoff: string }>({
    queryKey: ["/api/articles/current-issue", { limit: 6 }],
    queryFn: () => fetch("/api/articles/current-issue?limit=6").then(r => r.json()),
    staleTime: 5 * 60 * 1000,
  });
  const articles = data?.articles || [];
  const cutoff = data?.cutoff ? format(new Date(data.cutoff), "d MMM") : "";
  const today = format(new Date(), "d MMM yyyy");

  return (
    <div
      className="absolute top-full left-0 bg-white border border-border shadow-xl z-50 w-[360px] p-5"
      onMouseLeave={onClose}
    >
      <div className="flex items-center justify-between mb-3 pb-3 border-b border-border">
        <div>
          <span style={{ fontFamily: "Arial, sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "hsl(0 0% 55%)" }}>
            Current Issue
          </span>
          {cutoff && (
            <span className="ml-2" style={{ fontFamily: "Arial, sans-serif", fontSize: 11, color: "hsl(0 0% 65%)" }}>
              {cutoff} – {today}
            </span>
          )}
        </div>
        <Link href="/current-issue">
          <span className="text-secondary hover:underline cursor-pointer"
            style={{ fontFamily: "Arial, sans-serif", fontSize: 11 }}
            onClick={onClose}>
            Browse all →
          </span>
        </Link>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => (
            <div key={i} className="flex gap-3">
              <div className="w-16 h-12 bg-border animate-pulse shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 bg-border animate-pulse rounded w-full" />
                <div className="h-3 bg-border animate-pulse rounded w-2/3" />
              </div>
            </div>
          ))}
        </div>
      ) : articles.length === 0 ? (
        <p style={{ fontFamily: "Arial, sans-serif", fontSize: 12, color: "hsl(0 0% 60%)" }}>
          No articles in the current 8-week window yet.
        </p>
      ) : (
        <div className="space-y-1 divide-y divide-border" onClick={onClose}>
          {articles.map((a: any) => <PreviewCard key={a.id} article={a} />)}
        </div>
      )}
    </div>
  );
}

export default function Header({ onSearch }: HeaderProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [hoveredSlug, setHoveredSlug] = useState<string | null>(null);
  const [isCurrentIssueOpen, setIsCurrentIssueOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchCategory, setSearchCategory] = useState<string>("all");
  const [searchYear, setSearchYear] = useState<string>("all");
  const [location, setLocation] = useLocation();
  const moreRef = useRef<HTMLDivElement>(null);
  const currentIssueRef = useRef<HTMLDivElement>(null);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: categoriesData } = useQuery<{ categories: any[] }>({
    queryKey: ["/api/categories"],
  });

  const currentDate = new Date().toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  const availableYears = useMemo(() => {
    const y: number[] = [];
    for (let yr = 2008; yr <= new Date().getFullYear(); yr++) y.push(yr);
    return y.reverse();
  }, []);

  const allCategories = categoriesData?.categories || [];
  const topLevel = allCategories.filter((c: any) => !c.parentId);
  const primaryNav = PRIMARY_SLUGS
    .map(slug => topLevel.find((c: any) => c.slug === slug))
    .filter(Boolean) as any[];
  const secondaryNav = topLevel
    .filter((c: any) => !PRIMARY_SLUGS.includes(c.slug))
    .sort((a: any, b: any) => a.name.localeCompare(b.name));

  // Close More dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setIsMoreOpen(false);
      if (currentIssueRef.current && !currentIssueRef.current.contains(e.target as Node)) setIsCurrentIssueOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleNavMouseEnter = useCallback((slug: string) => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    setHoveredSlug(slug);
    setIsCurrentIssueOpen(false);
  }, []);

  const handleNavMouseLeave = useCallback(() => {
    hoverTimerRef.current = setTimeout(() => setHoveredSlug(null), 200);
  }, []);

  const handleDropdownMouseEnter = useCallback(() => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (searchTerm) params.set("search", searchTerm);
    if (searchCategory !== "all") params.set("categoryId", searchCategory);
    if (searchYear !== "all") params.set("year", searchYear);
    const qs = params.toString();
    setLocation(qs ? `/?${qs}` : "/");
    setIsSearchExpanded(false);
    setSearchTerm("");
    setSearchCategory("all");
    setSearchYear("all");
  };

  return (
    <header className="border-b border-border sticky top-0 z-50" style={{ background: "hsl(50 14% 95%)" }}>

      {/* Masthead */}
      <div className="max-w-[1296px] mx-auto px-6 py-6 flex items-center gap-4 relative">
        {/* Hamburger — mobile only */}
        <button
          className="lg:hidden text-foreground hover:opacity-70 transition-opacity"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          data-testid="mobile-menu-toggle"
          aria-label="Menu"
        >
          {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>

        {/* Logo — centred on mobile (absolute), left on desktop (static, larger) */}
        <Link href="/"
          className="absolute left-1/2 -translate-x-1/2 lg:static lg:translate-x-0 lg:ml-[10px]"
        >
          <img
            src="/gallery-logo.png"
            alt="Gallery"
            className="cursor-pointer h-[22px] lg:h-[33px] w-auto"
            data-testid="site-logo"
          />
        </Link>

        {/* Push right-side items */}
        <div className="flex-1" />

        {/* Admin link — desktop only */}
        <Link href="/admin" className="hidden lg:block">
          <span
            className="flex items-center gap-1 hover:text-secondary transition-colors cursor-pointer"
            style={{ fontFamily: "Arial, Helvetica, sans-serif", fontSize: 12, color: "hsl(0 0% 43%)" }}
            data-testid="admin-link"
          >
            <UserCircle className="w-3.5 h-3.5" />
            Admin
          </span>
        </Link>

        <button
          onClick={() => setIsSearchExpanded(!isSearchExpanded)}
          className="flex items-center gap-1.5 text-foreground hover:text-secondary transition-colors"
          data-testid="search-toggle"
          aria-label="Search"
        >
          <Search className="w-4 h-4" />
        </button>
      </div>

      {/* Desktop category nav */}
      <div className="hidden md:block border-t border-border bg-white">
        <div className="max-w-[1296px] mx-auto px-6">
          <nav className="flex justify-center items-center gap-0"
            style={{ fontFamily: "Arial, Helvetica, sans-serif", fontSize: 13 }}>

            {/* Current Issue */}
            <div className="relative shrink-0" ref={currentIssueRef}>
              <button
                onMouseEnter={() => { setIsCurrentIssueOpen(true); setHoveredSlug(null); }}
                onMouseLeave={() => { if (!isCurrentIssueOpen) setIsCurrentIssueOpen(false); }}
                onClick={() => setIsCurrentIssueOpen(o => !o)}
                className={`inline-flex items-center gap-1.5 py-3 px-4 border-b-[2px] transition-colors whitespace-nowrap ${
                  isCurrentIssueOpen ? "border-secondary text-secondary" : "border-transparent text-foreground hover:text-secondary"
                }`}
                data-testid="nav-current-issue"
              >
                <BookOpen className="w-3.5 h-3.5" />
                Current Issue
              </button>
              {isCurrentIssueOpen && (
                <div onMouseEnter={() => setIsCurrentIssueOpen(true)}>
                  <CurrentIssueDropdown onClose={() => setIsCurrentIssueOpen(false)} />
                </div>
              )}
            </div>

            {/* Divider */}
            <span className="w-px h-4 bg-border mx-1" />

            {/* Primary nav items with hover dropdowns */}
            {primaryNav.map((category) => (
              <div key={category.id} className="relative"
                onMouseEnter={() => handleNavMouseEnter(category.slug)}
                onMouseLeave={handleNavMouseLeave}>
                <Link href={`/category/${category.slug}`}>
                  <span
                    className={`nav-link inline-block py-3 px-4 cursor-pointer transition-colors whitespace-nowrap border-b-[2px] ${
                      location === `/category/${category.slug}`
                        ? "border-secondary text-secondary"
                        : "border-transparent text-foreground hover:text-secondary"
                    }`}
                    data-testid={`nav-${category.slug}`}
                  >
                    {category.name}
                  </span>
                </Link>

                {hoveredSlug === category.slug && (
                  <div onMouseEnter={handleDropdownMouseEnter} onMouseLeave={() => setHoveredSlug(null)}>
                    <NavDropdown category={category} onClose={() => setHoveredSlug(null)} />
                  </div>
                )}
              </div>
            ))}

            {/* More dropdown */}
            {secondaryNav.length > 0 && (
              <div className="relative shrink-0" ref={moreRef}>
                <button
                  onClick={() => setIsMoreOpen(!isMoreOpen)}
                  className="inline-flex items-center gap-1 py-3 px-4 text-foreground hover:text-secondary transition-colors border-b-[2px] border-transparent"
                  style={{ fontFamily: "Arial, Helvetica, sans-serif", fontSize: 13 }}
                  data-testid="nav-more"
                >
                  More <ChevronDown className={`w-3 h-3 transition-transform ${isMoreOpen ? "rotate-180" : ""}`} />
                </button>
                {isMoreOpen && (
                  <div className="absolute top-full left-0 bg-white border border-border shadow-lg z-50 min-w-[200px] py-2"
                    data-testid="nav-more-dropdown">
                    {secondaryNav.map((category: any) => (
                      <Link key={category.id} href={`/category/${category.slug}`}>
                        <span
                          className="block px-5 py-2.5 text-foreground hover:text-secondary hover:bg-[hsl(0,0%,97%)] cursor-pointer transition-colors"
                          style={{ fontFamily: "Arial, Helvetica, sans-serif", fontSize: 13 }}
                          onClick={() => setIsMoreOpen(false)}
                          data-testid={`nav-more-${category.slug}`}
                        >
                          {category.name}
                        </span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}
          </nav>
        </div>
      </div>

      {/* Search panel */}
      {isSearchExpanded && (
        <div className="border-t border-border bg-white py-4 px-6" data-testid="search-bar">
          <form onSubmit={handleSearch} className="max-w-3xl mx-auto flex gap-3">
            <Input
              type="text"
              placeholder="Search articles…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 rounded-none border-border"
              data-testid="search-input"
              autoFocus
            />
            <Select value={searchCategory} onValueChange={setSearchCategory}>
              <SelectTrigger className="w-44 rounded-none" data-testid="search-category-filter">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {allCategories.map((category: any) => (
                  <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={searchYear} onValueChange={setSearchYear}>
              <SelectTrigger className="w-36 rounded-none" data-testid="search-year-filter">
                <SelectValue placeholder="All Years" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Years</SelectItem>
                {availableYears.map((year) => (
                  <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <button
              type="submit"
              className="bg-foreground text-white px-6 py-2 hover:bg-secondary hover:text-foreground transition-colors"
              style={{ fontFamily: "Arial, sans-serif", fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}
              data-testid="search-submit"
            >
              Search
            </button>
          </form>
        </div>
      )}

      {/* Mobile / full-section menu */}
      {isMobileMenuOpen && (
        <div className="border-t border-border bg-white" data-testid="mobile-menu">
          <nav className="px-6 py-4" style={{ fontFamily: "Arial, sans-serif", fontSize: 14 }}>
            <Link href="/">
              <span className="block py-3 border-b border-border text-foreground hover:text-secondary cursor-pointer font-semibold"
                onClick={() => setIsMobileMenuOpen(false)}
                data-testid="mobile-nav-home">Home</span>
            </Link>

            {/* Current Issue */}
            <Link href="/current-issue">
              <span className="flex items-center gap-2 py-3 border-b border-border text-secondary cursor-pointer font-semibold"
                onClick={() => setIsMobileMenuOpen(false)}
                data-testid="mobile-nav-current-issue">
                <BookOpen className="w-4 h-4" />
                Current Issue
              </span>
            </Link>

            <div className="mt-3 mb-1" style={{ fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "hsl(0 0% 60%)" }}>
              Sections
            </div>
            {primaryNav.map((category: any) => (
              <Link key={category.id} href={`/category/${category.slug}`}>
                <span className="block py-3 border-b border-border text-foreground hover:text-secondary cursor-pointer"
                  onClick={() => setIsMobileMenuOpen(false)}
                  data-testid={`mobile-nav-${category.slug}`}>
                  {category.name}
                </span>
              </Link>
            ))}

            {secondaryNav.length > 0 && (
              <>
                <div className="mt-4 mb-1" style={{ fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "hsl(0 0% 60%)" }}>
                  More Sections
                </div>
                <div className="grid grid-cols-2 gap-0">
                  {secondaryNav.map((category: any) => (
                    <Link key={category.id} href={`/category/${category.slug}`}>
                      <span className="block py-2.5 border-b border-border text-muted-foreground hover:text-foreground cursor-pointer pr-4"
                        onClick={() => setIsMobileMenuOpen(false)}
                        data-testid={`mobile-nav-${category.slug}`}>
                        {category.name}
                      </span>
                    </Link>
                  ))}
                </div>
              </>
            )}

            <Link href="/admin">
              <span className="flex items-center gap-2 mt-4 py-3 text-muted-foreground hover:text-foreground cursor-pointer"
                onClick={() => setIsMobileMenuOpen(false)}
                data-testid="mobile-admin-link">
                <UserCircle className="w-4 h-4" />
                Admin Dashboard
              </span>
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
