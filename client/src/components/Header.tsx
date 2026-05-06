import { useState, useMemo, useRef, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Menu, X, UserCircle, ChevronDown } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

// Curated primary nav — ordered editorially
const PRIMARY_SLUGS = ["people", "fashion", "appetite-1", "culture", "travel-1", "interiors", "business"];

interface HeaderProps {
  onSearch?: (search: string, category?: string, year?: string) => void;
}

export default function Header({ onSearch }: HeaderProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchCategory, setSearchCategory] = useState<string>("all");
  const [searchYear, setSearchYear] = useState<string>("all");
  const [location] = useLocation();
  const moreRef = useRef<HTMLDivElement>(null);

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

  // Split into primary (curated order) and secondary (everything else)
  const primaryNav = PRIMARY_SLUGS
    .map(slug => topLevel.find((c: any) => c.slug === slug))
    .filter(Boolean) as any[];
  const secondaryNav = topLevel.filter((c: any) => !PRIMARY_SLUGS.includes(c.slug))
    .sort((a: any, b: any) => a.name.localeCompare(b.name));

  // Close "More" dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setIsMoreOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch?.(
      searchTerm,
      searchCategory === "all" ? undefined : searchCategory,
      searchYear === "all" ? undefined : searchYear
    );
    setIsSearchExpanded(false);
  };

  return (
    <header className="bg-white border-b border-border sticky top-0 z-50">

      {/* Thin top bar */}
      <div className="border-b border-border">
        <div className="max-w-[1296px] mx-auto px-6 py-2 flex justify-between items-center"
          style={{ fontFamily: "Arial, Helvetica, sans-serif", fontSize: 12, color: "hsl(0 0% 43%)" }}>
          <span data-testid="current-date">{currentDate}</span>
          <Link href="/admin">
            <span className="flex items-center gap-1 hover:text-foreground transition-colors cursor-pointer" data-testid="admin-link">
              <UserCircle className="w-3.5 h-3.5" />
              Admin
            </span>
          </Link>
        </div>
      </div>

      {/* Masthead */}
      <div className="max-w-[1296px] mx-auto px-6 py-4 flex justify-between items-center">
        <button
          className="text-foreground hover:opacity-70 transition-opacity md:hidden"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          data-testid="mobile-menu-toggle"
          aria-label="Menu"
        >
          {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>

        {/* Desktop hamburger — triggers full category panel */}
        <button
          className="text-foreground hover:opacity-70 transition-opacity hidden md:block"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          data-testid="desktop-menu-toggle"
          aria-label="All sections"
        >
          {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>

        <Link href="/">
          <img src="/gallery-logo.png" alt="Gallery" className="cursor-pointer"
            style={{ height: 22, width: "auto" }} data-testid="site-logo" />
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
          <nav className="flex justify-center items-center gap-0" style={{ fontFamily: "Arial, Helvetica, sans-serif", fontSize: 13 }}>
            {primaryNav.map((category) => (
              <Link key={category.id} href={`/category/${category.slug}`}>
                <span
                  className={`nav-link inline-block py-3 px-4 cursor-pointer hover:text-secondary transition-colors whitespace-nowrap ${
                    location === `/category/${category.slug}` ? "active text-secondary" : "text-foreground"
                  }`}
                  data-testid={`nav-${category.slug}`}
                >
                  {category.name}
                </span>
              </Link>
            ))}

            {/* More dropdown */}
            {secondaryNav.length > 0 && (
              <div className="relative" ref={moreRef}>
                <button
                  onClick={() => setIsMoreOpen(!isMoreOpen)}
                  className="inline-flex items-center gap-1 py-3 px-4 text-foreground hover:text-secondary transition-colors"
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

      {/* Mobile / full-section menu (all categories) */}
      {isMobileMenuOpen && (
        <div className="border-t border-border bg-white" data-testid="mobile-menu">
          <nav className="px-6 py-4" style={{ fontFamily: "Arial, sans-serif", fontSize: 14 }}>
            <Link href="/">
              <span className="block py-3 border-b border-border text-foreground hover:text-secondary cursor-pointer font-semibold"
                onClick={() => setIsMobileMenuOpen(false)}
                data-testid="mobile-nav-home">Home</span>
            </Link>

            {/* Primary */}
            <div className="mt-2 mb-1" style={{ fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "hsl(0 0% 60%)" }}>
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

            {/* Secondary */}
            {secondaryNav.length > 0 && (
              <>
                <div className="mt-4 mb-1" style={{ fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "hsl(0 0% 60%)" }}>
                  More
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
