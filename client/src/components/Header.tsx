import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  onSearch?: (search: string) => void;
}

export default function Header({ onSearch }: HeaderProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const { data: categoriesData } = useQuery({
    queryKey: ["/api/categories"],
  });

  const currentDate = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric"
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch?.(searchTerm);
    setIsSearchExpanded(false);
  };

  const categories = categoriesData?.categories?.slice(0, 6) || [];

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
            <form onSubmit={handleSearch} className="relative max-w-2xl mx-auto">
              <Input
                type="text"
                placeholder="Search articles..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pr-12"
                data-testid="search-input"
              />
              <Button
                type="submit"
                variant="ghost"
                size="sm"
                className="absolute right-2 top-1/2 transform -translate-y-1/2"
                data-testid="search-submit"
              >
                <Search className="h-4 w-4" />
              </Button>
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
