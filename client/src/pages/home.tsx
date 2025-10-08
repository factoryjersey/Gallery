import { useQuery } from "@tanstack/react-query";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import FeaturedHero from "@/components/FeaturedHero";
import CategoryFilter from "@/components/CategoryFilter";
import ArticleGrid from "@/components/ArticleGrid";
import Sidebar from "@/components/Sidebar";
import { useState } from "react";

export default function Home() {
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [currentPage, setCurrentPage] = useState(1);

  const { data: categoriesData } = useQuery({
    queryKey: ["/api/categories"],
  });

  const { data: featuredData } = useQuery({
    queryKey: ["/api/articles/featured"],
  });

  const queryParams = new URLSearchParams({
    ...(selectedCategory && { categoryId: selectedCategory }),
    ...(searchTerm && { search: searchTerm }),
    page: currentPage.toString(),
    limit: "6",
  });

  const { data: articlesData, isLoading } = useQuery({
    queryKey: [`/api/articles?${queryParams.toString()}`],
  });

  const handleCategoryFilter = (categoryId: string) => {
    setSelectedCategory(categoryId);
    setCurrentPage(1);
  };

  const handleSearch = (search: string) => {
    setSearchTerm(search);
    setCurrentPage(1);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header onSearch={handleSearch} />
      
      <FeaturedHero articles={featuredData?.articles || []} />
      
      <CategoryFilter 
        categories={categoriesData?.categories || []}
        selectedCategory={selectedCategory}
        onSelectCategory={handleCategoryFilter}
      />

      <section className="py-12 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <ArticleGrid 
                articles={articlesData?.articles || []}
                isLoading={isLoading}
                pagination={articlesData?.pagination}
                onPageChange={setCurrentPage}
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
