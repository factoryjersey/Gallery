import { useQuery } from "@tanstack/react-query";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import FeaturedHero from "@/components/FeaturedHero";
import CategoryFilter from "@/components/CategoryFilter";
import ArticleGrid from "@/components/ArticleGrid";
import Sidebar from "@/components/Sidebar";
import { useState, useMemo, useEffect } from "react";
import { useSearch } from "wouter";

export default function Home() {
  const searchString = useSearch();
  const urlParams = useMemo(() => new URLSearchParams(searchString), [searchString]);

  const [selectedCategory, setSelectedCategory] = useState<string>(urlParams.get("categoryId") || "");
  const [searchTerm, setSearchTerm] = useState<string>(urlParams.get("search") || "");
  const [selectedYear, setSelectedYear] = useState<string>(urlParams.get("year") || "all");
  const [withImage, setWithImage] = useState<boolean>(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);

  // Sync state when URL params change (e.g. after Header search navigation)
  useEffect(() => {
    setSearchTerm(urlParams.get("search") || "");
    setSelectedCategory(urlParams.get("categoryId") || "");
    setSelectedYear(urlParams.get("year") || "all");
    setCurrentPage(1);
  }, [searchString]);

  const { data: categoriesData } = useQuery({ queryKey: ["/api/categories"] });
  const { data: featuredData } = useQuery({ queryKey: ["/api/articles/featured"] });

  const queryParams = new URLSearchParams({
    ...(selectedCategory && { categoryId: selectedCategory }),
    ...(searchTerm && { search: searchTerm }),
    ...(selectedYear !== "all" && { year: selectedYear }),
    ...(withImage && { withImage: "true" }),
    page: currentPage.toString(),
    limit: itemsPerPage.toString(),
  });

  const { data: articlesData, isLoading } = useQuery({
    queryKey: [`/api/articles?${queryParams.toString()}`],
  });

  const availableYears = useMemo(() => {
    const years: number[] = [];
    for (let year = 2008; year <= new Date().getFullYear(); year++) years.push(year);
    return years.reverse();
  }, []);

  const handleCategoryFilter = (categoryId: string) => {
    setSelectedCategory(categoryId);
    setCurrentPage(1);
  };

  const handleSearch = (search: string, category?: string, year?: string) => {
    setSearchTerm(search);
    if (category) setSelectedCategory(category);
    if (year) setSelectedYear(year);
    setCurrentPage(1);
  };

  const handleYearFilter = (year: string) => {
    setSelectedYear(year);
    setCurrentPage(1);
  };

  const handleToggleWithImage = () => {
    setWithImage((prev) => !prev);
    setCurrentPage(1);
  };

  const handleItemsPerPageChange = (newLimit: number) => {
    setItemsPerPage(newLimit);
    setCurrentPage(1);
  };

  const hasActiveFilters = searchTerm || selectedCategory || selectedYear !== "all";
  const selectedCategoryName = categoriesData?.categories?.find(
    (cat: any) => cat.id === selectedCategory
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
        withImage={withImage}
        onToggleWithImage={handleToggleWithImage}
      />

      <section className="py-12 bg-background">
        <div className="max-w-[1296px] mx-auto px-6">

          {hasActiveFilters && (
            <div className="mb-6 flex items-center gap-3 flex-wrap"
              style={{ fontFamily: "Arial, sans-serif", fontSize: 13, color: "hsl(0 0% 43%)" }}>
              <span>Showing:</span>
              {searchTerm && (
                <span className="px-2 py-0.5 bg-foreground text-white text-xs">"{searchTerm}"</span>
              )}
              {selectedCategoryName && (
                <span className="px-2 py-0.5 border border-border text-xs">{selectedCategoryName}</span>
              )}
              {selectedYear !== "all" && (
                <span className="px-2 py-0.5 border border-border text-xs">{selectedYear}</span>
              )}
              <button
                onClick={clearAllFilters}
                className="underline hover:text-foreground transition-colors"
                data-testid="button-clear-filters"
              >
                Clear all
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
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
