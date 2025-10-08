import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ArticleGrid from "@/components/ArticleGrid";
import Sidebar from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Link } from "wouter";

export default function Category() {
  const { slug } = useParams();
  const [currentPage, setCurrentPage] = useState(1);

  const { data: categoryData } = useQuery({
    queryKey: ["/api/categories/by-slug", slug],
  });

  const { data: articlesData, isLoading } = useQuery({
    queryKey: ["/api/articles", {
      categorySlug: slug,
      page: currentPage,
      limit: 12,
    }],
  });

  if (!categoryData?.category) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="max-w-7xl mx-auto px-4 py-12 text-center">
          <h1 className="text-2xl font-bold mb-4">Category Not Found</h1>
          <p className="text-muted-foreground mb-6">
            The category you're looking for doesn't exist.
          </p>
          <Link href="/">
            <Button>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Home
            </Button>
          </Link>
        </div>
        <Footer />
      </div>
    );
  }

  const { category } = categoryData;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      {/* Category Header */}
      <section className="bg-muted py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Link href="/">
            <Button variant="ghost" className="mb-6" data-testid="back-button">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Home
            </Button>
          </Link>
          
          <div className="text-center">
            <h1 className="text-4xl font-bold font-serif text-foreground mb-4" data-testid="category-title">
              {category.name}
            </h1>
            {category.description && (
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto" data-testid="category-description">
                {category.description}
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Articles */}
      <section className="py-12 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <div className="mb-6">
                <h2 className="text-2xl font-bold font-serif text-foreground">
                  Articles in {category.name}
                </h2>
                <p className="text-muted-foreground">
                  {articlesData?.pagination?.total || 0} articles found
                </p>
              </div>

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
