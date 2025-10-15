import { useState, useMemo } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Search, 
  Menu, 
  X, 
  Calendar,
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

  const { data: categoriesData } = useQuery<{ categories: any[] }>({
    queryKey: ["/api/categories"],
  });

  const currentDate = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric"
  });

  // Generate available years (2008-2025)
  const availableYears = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const years: number[] = [];
    for (let year = 2008; year <= currentYear; year++) {
      years.push(year);
    }
    return years.reverse(); // Show newest first
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

  // Filter to show only top-level categories (no parent)
  const topLevelCategories = categoriesData?.categories?.filter((cat: any) => !cat.parentId) || [];
  const categories = topLevelCategories.slice(0, 6);
  const allCategories = categoriesData?.categories || [];

  return (
    <header className="bg-background border-b border-border sticky top-0 z-50 shadow-sm">
      {/* Top Bar */}
      <div className="bg-primary text-primary-foreground py-2 border-b border-border/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center text-sm">
            <div className="flex items-center space-x-4">
              <span className="flex items-center" data-testid="current-date">
                <Calendar className="w-4 h-4 mr-2" />
                {currentDate}
              </span>
            </div>
            <div className="flex items-center space-x-4">
              <a href="#" className="hover:text-secondary transition-colors" data-testid="social-facebook">
                <Facebook className="w-4 h-4" />
              </a>
              <a href="#" className="hover:text-secondary transition-colors" data-testid="social-twitter">
                <Twitter className="w-4 h-4" />
              </a>
              <a href="#" className="hover:text-secondary transition-colors" data-testid="social-instagram">
                <Instagram className="w-4 h-4" />
              </a>
              <a href="#" className="hover:text-secondary transition-colors" data-testid="social-youtube">
                <Youtube className="w-4 h-4" />
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Main Header */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center py-4">
          {/* Logo */}
          <div className="flex items-center">
            <Link href="/">
              <h1 className="text-3xl font-bold font-serif text-primary cursor-pointer" data-testid="site-logo">
                Modern Magazine
              </h1>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-8">
            <Link href="/" className="nav-link text-foreground hover:text-secondary font-medium" data-testid="nav-home">
              Home
            </Link>
            {categories.map((category) => (
              <Link key={category.id} href={`/category/${category.slug}`} className="nav-link text-foreground hover:text-secondary font-medium" data-testid={`nav-${category.slug}`}>
                {category.name}
              </Link>
            ))}
          </nav>

          {/* Search and Mobile Menu */}
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              size="sm"
              className="hidden md:flex"
              onClick={() => setIsSearchExpanded(!isSearchExpanded)}
              data-testid="search-toggle"
            >
              <Search className="h-4 w-4" />
            </Button>
            
            <Link href="/admin">
              <Button variant="ghost" size="sm" className="hidden md:flex" data-testid="admin-link">
                <UserCircle className="h-4 w-4 mr-2" />
                Admin
              </Button>
            </Link>

            <Button
              variant="ghost"
              size="sm"
              className="md:hidden"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              data-testid="mobile-menu-toggle"
            >
              {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        {/* Search Bar */}
        {isSearchExpanded && (
          <div className="pb-4" data-testid="search-bar">
            <form onSubmit={handleSearch} className="max-w-4xl mx-auto space-y-3">
              <div className="flex gap-3">
                <div className="flex-1">
                  <Input
                    type="text"
                    placeholder="Search articles by title or content..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    data-testid="search-input"
                  />
                </div>
                <Select value={searchCategory} onValueChange={setSearchCategory}>
                  <SelectTrigger className="w-[180px]" data-testid="search-category-filter">
                    <SelectValue placeholder="All Categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {allCategories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={searchYear} onValueChange={setSearchYear}>
                  <SelectTrigger className="w-[140px]" data-testid="search-year-filter">
                    <SelectValue placeholder="All Years" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Years</SelectItem>
                    {availableYears.map((year) => (
                      <SelectItem key={year} value={year.toString()}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="submit"
                  data-testid="search-submit"
                >
                  <Search className="h-4 w-4 mr-2" />
                  Search
                </Button>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden bg-background border-t border-border" data-testid="mobile-menu">
          <nav className="px-4 py-4 space-y-2">
            <Link href="/" className="block py-2 text-foreground hover:text-secondary font-medium" data-testid="mobile-nav-home">
              Home
            </Link>
            {categories.map((category) => (
              <Link key={category.id} href={`/category/${category.slug}`} className="block py-2 text-foreground hover:text-secondary font-medium" data-testid={`mobile-nav-${category.slug}`}>
                {category.name}
              </Link>
            ))}
            <div className="pt-2 border-t border-border">
              <Link href="/admin" className="flex items-center py-2 text-foreground hover:text-secondary font-medium" data-testid="mobile-admin-link">
                <UserCircle className="w-4 h-4 mr-2" />
                Admin Dashboard
              </Link>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
