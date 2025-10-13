import { useQuery } from "@tanstack/react-query";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import FeaturedHero from "@/components/FeaturedHero";
import CategoryFilter from "@/components/CategoryFilter";
import ArticleGrid from "@/components/ArticleGrid";
import Sidebar from "@/components/Sidebar";
import { useState, useMemo } from "react";

export default function Home() {
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedYear, setSelectedYear] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);

  const { data: categoriesData } = useQuery({
    queryKey: ["/api/categories"],
  });

  const { data: featuredData } = useQuery({
    queryKey: ["/api/articles/featured"],
  });

  const queryParams = new URLSearchParams({
    ...(selectedCategory && { categoryId: selectedCategory }),
    ...(searchTerm && { search: searchTerm }),
    ...(selectedYear !== "all" && { year: selectedYear }),
    page: currentPage.toString(),
    limit: itemsPerPage.toString(),
  });

  const { data: articlesData, isLoading } = useQuery({
    queryKey: [`/api/articles?${queryParams.toString()}`],
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

  const handleCategoryFilter = (categoryId: string) => {
    setSelectedCategory(categoryId);
    setCurrentPage(1);
  };

  const handleSearch = (search: string, category?: string, year?: string) => {
    setSearchTerm(search);
    if (category) {
      setSelectedCategory(category);
    }
    if (year) {
      setSelectedYear(year);
    }
    setCurrentPage(1);
  };

  const handleYearFilter = (year: string) => {
    setSelectedYear(year);
    setCurrentPage(1);
  };

  const handleItemsPerPageChange = (newLimit: number) => {
    setItemsPerPage(newLimit);
    setCurrentPage(1);
  };

  // Check if any filters are active
  const hasActiveFilters = searchTerm || selectedCategory || selectedYear !== "all";

  // Get display names for active filters
  const selectedCategoryName = categoriesData?.categories?.find(
    cat => cat.id === selectedCategory
  )?.name;

  const clearAllFilters = () => {
    setSearchTerm("");
    setSelectedCategory("");
    setSelectedYear("all");
    setCurrentPage(1);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header onSearch={handleSearch} />
      
      {!hasActiveFilters && <FeaturedHero articles={featuredData?.articles || []} />}
      
      <CategoryFilter 
        categories={categoriesData?.categories || []}
        selectedCategory={selectedCategory}
        onSelectCategory={handleCategoryFilter}
        selectedYear={selectedYear}
        onSelectYear={handleYearFilter}
        availableYears={availableYears}
      />

      <section className="py-12 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {hasActiveFilters && (
            <div className="mb-6 p-4 bg-muted rounded-lg border border-border">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium">Showing results for:</span>
                  {searchTerm && (
                    <span className="px-3 py-1 bg-primary text-primary-foreground rounded-full text-sm">
                      "{searchTerm}"
                    </span>
                  )}
                  {selectedCategoryName && (
                    <span className="px-3 py-1 bg-secondary text-secondary-foreground rounded-full text-sm">
                      {selectedCategoryName}
                    </span>
                  )}
                  {selectedYear !== "all" && (
                    <span className="px-3 py-1 bg-accent text-accent-foreground rounded-full text-sm">
                      Year: {selectedYear}
                    </span>
                  )}
                </div>
                <button
                  onClick={clearAllFilters}
                  className="text-sm text-muted-foreground hover:text-foreground underline"
                  data-testid="button-clear-filters"
                >
                  Clear all
                </button>
              </div>
            </div>
          )}
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <ArticleGrid 
                articles={articlesData?.articles || []}
                isLoading={isLoading}
                pagination={articlesData?.pagination}
                onPageChange={setCurrentPage}
                itemsPerPage={itemsPerPage}
                onItemsPerPageChange={handleItemsPerPageChange}
              />
            </div>
            <div className="lg:col-span-1">
              <Sidebar />
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
