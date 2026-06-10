import { useQuery } from "@tanstack/react-query";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import CategoryFilter from "@/components/CategoryFilter";
import HungerGrid from "@/components/HungerGrid";
import CategorySection from "@/components/CategorySection";
import LatestHighlights from "@/components/LatestHighlights";
import Sidebar from "@/components/Sidebar";
import { useState, useMemo, useEffect } from "react";
import { useSearch } from "wouter";

// Large feature sections — each gets its own band with one big tile + 2
// side tiles. Order is editorial: timely events first, then ideas, then
// editorial spreads, then the most image-driven (paparazzi), then business.
const FEATURE_SECTIONS: { slug: string; label: string; preferGallery?: boolean }[] = [
  { slug: "events", label: "Events" },
  { slug: "culture", label: "Culture" },
  { slug: "fashion-shoots", label: "Fashion Shoots" },
  { slug: "paparazzi", label: "Paparazzi", preferGallery: true },
  { slug: "business", label: "Business" },
];

// Smaller categories combined into a final "More to read" strip.
const COMPACT_SECTIONS: { slug: string; label: string }[] = [
  { slug: "appetite-1", label: "Appetite" },
  { slug: "interiors", label: "Interiors" },
];

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

  const hasActiveFilters = searchTerm || selectedCategory || selectedYear !== "all";

  // Only fetch the flat grid when a filter is active (otherwise the sections
  // take over). Skips a needless 20-row query on a vanilla homepage visit.
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
    enabled: !!hasActiveFilters,
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

      {/* When the visitor lands on a clean home URL, show the editorial
          category sections. When they arrive with search/filter params
          (e.g. via the header search), fall back to the flat HungerGrid
          so the filter UI keeps working. */}
      {hasActiveFilters ? (
        <>
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
          <section className="pb-12 bg-background">
            <div
              className="max-w-[1600px] mx-auto px-6 mb-6 flex items-center gap-3 flex-wrap"
              style={{ fontFamily: "Arial, sans-serif", fontSize: 13, color: "hsl(0 0% 43%)" }}
            >
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
            <div className="max-w-[1600px] mx-auto">
              <HungerGrid
                articles={articlesData?.articles || []}
                isLoading={isLoading}
                pagination={articlesData?.pagination}
                onPageChange={setCurrentPage}
                itemsPerPage={itemsPerPage}
                onItemsPerPageChange={handleItemsPerPageChange}
              />
            </div>
          </section>
        </>
      ) : (
        <main>
          {/* Curated hero — admin-picked latest highlights */}
          <LatestHighlights />

          {/* Editorial grid with sticky sidebar on the right */}
          <div className="max-w-[1500px] mx-auto px-6 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-10 py-8">
            <div className="min-w-0">
              {FEATURE_SECTIONS.map((s) => (
                <CategorySection
                  key={s.slug}
                  slug={s.slug}
                  label={s.label}
                  variant="feature"
                  preferGallery={s.preferGallery}
                />
              ))}

              {/* Combined "more to read" — three small categories side by side. */}
              <section className="py-10 border-t border-border" data-testid="more-to-read">
                <h2
                  className="mb-6"
                  style={{
                    fontFamily: "Georgia, serif",
                    fontSize: "clamp(22px, 2vw, 32px)",
                    fontWeight: 400,
                    lineHeight: 1.1,
                    letterSpacing: "-0.4px",
                    color: "hsl(0 0% 4%)",
                    margin: 0,
                  }}
                >
                  More to read
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {COMPACT_SECTIONS.map((s) => (
                    <div key={s.slug}>
                      <CategorySection slug={s.slug} label={s.label} variant="compact" />
                    </div>
                  ))}
                </div>
              </section>
            </div>
            <aside className="lg:sticky lg:top-24 lg:self-start">
              <Sidebar />
            </aside>
          </div>
        </main>
      )}

      <Footer />
    </div>
  );
}
