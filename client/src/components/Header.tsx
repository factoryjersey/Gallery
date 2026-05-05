import { useState, useMemo } from "react";
import { Link, useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Search,
  Menu,
  X,
  Facebook,
  Twitter,
  Instagram,
  Youtube,
  UserCircle
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";

interface HeaderProps {
  onSearch?: (search: string, category?: string, year?: string) => void;
}

export default function Header({ onSearch }: HeaderProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchCategory, setSearchCategory] = useState<string>("all");
  const [searchYear, setSearchYear] = useState<string>("all");
  const [location] = useLocation();

  const { data: categoriesData } = useQuery<{ categories: any[] }>({
    queryKey: ["/api/categories"],
  });

  const currentDate = new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const availableYears = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const years: number[] = [];
    for (let year = 2008; year <= currentYear; year++) years.push(year);
    return years.reverse();
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

  const topLevelCategories = categoriesData?.categories?.filter((cat: any) => !cat.parentId) || [];
  const navCategories = topLevelCategories.slice(0, 7);
  const allCategories = categoriesData?.categories || [];

  return (
    <header className="bg-white border-b border-border sticky top-0 z-50">

      {/* Thin top bar: date + socials */}
      <div className="border-b border-border">
        <div className="max-w-[1296px] mx-auto px-6 py-2 flex justify-between items-center"
          style={{ fontFamily: "Arial, Helvetica, sans-serif", fontSize: 12, color: "hsl(0 0% 43%)" }}>
          <span data-testid="current-date">{currentDate}</span>
          <div className="flex items-center gap-4">
            <a href="https://www.facebook.com/gallery.je" target="_blank" rel="noreferrer"
              className="hover:text-foreground transition-colors" data-testid="social-facebook">
              <Facebook className="w-3.5 h-3.5" />
            </a>
            <a href="https://twitter.com/galleryje" target="_blank" rel="noreferrer"
              className="hover:text-foreground transition-colors" data-testid="social-twitter">
              <Twitter className="w-3.5 h-3.5" />
            </a>
            <a href="https://www.instagram.com/gallery.je" target="_blank" rel="noreferrer"
              className="hover:text-foreground transition-colors" data-testid="social-instagram">
              <Instagram className="w-3.5 h-3.5" />
            </a>
            <a href="#" className="hover:text-foreground transition-colors" data-testid="social-youtube">
              <Youtube className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </div>

      {/* Main masthead row */}
      <div className="max-w-[1296px] mx-auto px-6 py-4 flex justify-between items-center">

        {/* Left: hamburger (mobile) */}
        <button
          className="text-foreground hover:opacity-70 transition-opacity"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          data-testid="mobile-menu-toggle"
          aria-label="Menu"
        >
          {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>

        {/* Centre: GALLERY wordmark */}
        <Link href="/">
          <img
            src="/gallery-logo.png"
            alt="Gallery"
            className="cursor-pointer"
            style={{ height: 28, width: "auto" }}
            data-testid="site-logo"
          />
        </Link>

        {/* Right: search + admin */}
        <div className="flex items-center gap-5" style={{ fontFamily: "Arial, sans-serif", fontSize: 13 }}>
          <button
            onClick={() => setIsSearchExpanded(!isSearchExpanded)}
            className="flex items-center gap-1.5 text-foreground hover:text-secondary transition-colors"
            data-testid="search-toggle"
            aria-label="Search"
          >
            Search <Search className="w-4 h-4" />
          </button>
          <Link href="/admin">
            <span className="hidden md:flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors cursor-pointer" data-testid="admin-link">
              <UserCircle className="w-4 h-4" />
              Admin
            </span>
          </Link>
        </div>
      </div>

      {/* Desktop category nav */}
      <div className="hidden md:block border-t border-border bg-white">
        <div className="max-w-[1296px] mx-auto px-6">
          <nav className="flex justify-center gap-8" style={{ fontFamily: "Arial, Helvetica, sans-serif", fontSize: 13 }}>
            {navCategories.map((category) => (
              <Link key={category.id} href={`/category/${category.slug}`}>
                <span
                  className={`nav-link inline-block py-3 cursor-pointer hover:text-secondary transition-colors ${location === `/category/${category.slug}` ? "active text-secondary" : "text-foreground"}`}
                  data-testid={`nav-${category.slug}`}
                >
                  {category.name}
                </span>
              </Link>
            ))}
          </nav>
        </div>
      </div>

      {/* Expandable search panel */}
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
                {allCategories.map((category) => (
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

      {/* Mobile menu */}
      {isMobileMenuOpen && (
        <div className="border-t border-border bg-white" data-testid="mobile-menu">
          <nav className="px-6 py-4 space-y-0" style={{ fontFamily: "Arial, sans-serif", fontSize: 14 }}>
            <Link href="/">
              <span className="block py-3 border-b border-border text-foreground hover:text-secondary cursor-pointer" data-testid="mobile-nav-home">Home</span>
            </Link>
            {navCategories.map((category) => (
              <Link key={category.id} href={`/category/${category.slug}`}>
                <span className="block py-3 border-b border-border text-foreground hover:text-secondary cursor-pointer" data-testid={`mobile-nav-${category.slug}`}>
                  {category.name}
                </span>
              </Link>
            ))}
            <Link href="/admin">
              <span className="flex items-center gap-2 py-3 text-muted-foreground hover:text-foreground cursor-pointer" data-testid="mobile-admin-link">
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
