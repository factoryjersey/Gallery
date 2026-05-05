import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ArticleGrid from "@/components/ArticleGrid";
import Sidebar from "@/components/Sidebar";
import { ArrowLeft } from "lucide-react";
import { Link } from "wouter";

export default function Category() {
  const { slug } = useParams();
  const [currentPage, setCurrentPage] = useState(1);

  const { data: categoryData } = useQuery({
    queryKey: [`/api/categories/by-slug/${slug}`],
  });

  const { data: articlesData, isLoading } = useQuery({
    queryKey: [`/api/articles?categoryId=${categoryData?.category?.id}&page=${currentPage}&limit=12`],
    enabled: !!categoryData?.category?.id,
  });

  if (!categoryData?.category) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="max-w-[1296px] mx-auto px-6 py-16 text-center">
          <h1 className="text-2xl mb-4" style={{ fontFamily: "Georgia, serif", fontWeight: 400 }}>
            Category Not Found
          </h1>
          <p className="text-muted-foreground mb-6" style={{ fontFamily: "Arial, sans-serif", fontSize: 14 }}>
            The category you're looking for doesn't exist.
          </p>
          <Link href="/">
            <span className="inline-flex items-center gap-2 text-secondary hover:underline cursor-pointer"
              style={{ fontFamily: "Arial, sans-serif", fontSize: 13 }}>
              <ArrowLeft className="h-4 w-4" /> Back to Home
            </span>
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

      {/* Category masthead */}
      <section className="bg-white border-b border-border py-10">
        <div className="max-w-[1296px] mx-auto px-6">
          <Link href="/">
            <span className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors cursor-pointer mb-6 block"
              style={{ fontFamily: "Arial, sans-serif", fontSize: 12 }}
              data-testid="back-button">
              <ArrowLeft className="h-3.5 w-3.5" /> Back to Home
            </span>
          </Link>
          <div className="text-center">
            <h1
              className="mb-2"
              style={{ fontFamily: "Georgia, serif", fontSize: 42, fontWeight: 400, letterSpacing: "-0.5px", color: "hsl(0 0% 4%)" }}
              data-testid="category-title"
            >
              {category.name}
            </h1>
            {category.description && (
              <p
                className="max-w-xl mx-auto"
                style={{ fontFamily: "Georgia, serif", fontSize: 16, lineHeight: 1.6, color: "hsl(0 0% 43%)", fontStyle: "italic" }}
                data-testid="category-description"
              >
                {category.description}
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Articles */}
      <section className="py-10 bg-background">
        <div className="max-w-[1296px] mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
            <div className="lg:col-span-2">
              <div className="mb-6">
                <h2 style={{ fontFamily: "Georgia, serif", fontSize: 20, fontWeight: 400, color: "hsl(0 0% 4%)" }}>
                  Articles in {category.name}
                </h2>
                <p style={{ fontFamily: "Arial, sans-serif", fontSize: 12, color: "hsl(0 0% 43%)" }}>
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
