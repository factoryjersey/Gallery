import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ArticleGrid from "@/components/ArticleGrid";
import Sidebar from "@/components/Sidebar";
import { ArrowLeft, Image, ImageOff } from "lucide-react";
import { Link } from "wouter";

type Category = { id: string; name: string; slug: string; parentId: string | null; description?: string };

export default function Category() {
  const { slug } = useParams();
  const [currentPage, setCurrentPage] = useState(1);
  const [withImage, setWithImage] = useState(true);

  const { data: categoryData } = useQuery({
    queryKey: [`/api/categories/by-slug/${slug}`],
  });

  // Subcategory navigation: figure out parent + siblings if this category
  // belongs to a hierarchy.
  const { data: allCategoriesData } = useQuery<{ categories: Category[] }>({
    queryKey: ["/api/categories"],
  });

  const nav = useMemo(() => {
    const all = allCategoriesData?.categories || [];
    const current = categoryData?.category as Category | undefined;
    if (!current) return null;
    const parent = current.parentId
      ? all.find((c) => c.id === current.parentId) ?? null
      : current; // if we're a parent, treat ourselves as the parent
    if (!parent) return null;
    const children = all.filter((c) => c.parentId === parent.id);
    if (children.length === 0) return null;
    return { parent, children, currentIsParent: current.id === parent.id };
  }, [allCategoriesData, categoryData]);

  const queryParams = new URLSearchParams({
    ...(categoryData?.category?.id && { categoryId: categoryData.category.id }),
    ...(withImage && { withImage: "true" }),
    page: currentPage.toString(),
    limit: "16",
  });

  const { data: articlesData, isLoading } = useQuery({
    queryKey: [`/api/articles?${queryParams.toString()}`],
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

      {/* Sub-category tabs (only when hierarchy exists) */}
      {nav && (
        <section className="bg-white border-b border-border">
          <div className="max-w-[1296px] mx-auto px-6">
            <div className="flex items-center gap-0 overflow-x-auto" style={{ fontFamily: "Arial, sans-serif", fontSize: 13 }}>
              <Link href={`/category/${nav.parent.slug}`}>
                <span
                  className={`shrink-0 py-4 px-4 border-b-[3px] transition-colors whitespace-nowrap cursor-pointer ${
                    nav.currentIsParent
                      ? "border-secondary text-foreground font-semibold"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                  data-testid={`subnav-parent-${nav.parent.slug}`}
                >
                  All {nav.parent.name}
                </span>
              </Link>
              {nav.children.map((c) => (
                <Link key={c.id} href={`/category/${c.slug}`}>
                  <span
                    className={`shrink-0 py-4 px-4 border-b-[3px] transition-colors whitespace-nowrap cursor-pointer ${
                      category.id === c.id
                        ? "border-secondary text-foreground font-semibold"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    }`}
                    data-testid={`subnav-child-${c.slug}`}
                  >
                    {c.name}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Articles */}
      <section className="py-10 bg-background">
        <div className="max-w-[1296px] mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
            <div className="lg:col-span-2">
              {/* Toolbar */}
              <div className="flex items-center justify-between mb-6">
                <p style={{ fontFamily: "Arial, sans-serif", fontSize: 12, color: "hsl(0 0% 43%)" }}>
                  {articlesData?.pagination?.total ?? 0} articles
                  {withImage ? " with images" : ""}
                </p>
                <button
                  onClick={() => { setWithImage(p => !p); setCurrentPage(1); }}
                  className="flex items-center gap-1.5 py-1.5 px-3 border border-border hover:border-foreground transition-colors"
                  style={{ fontFamily: "Arial, sans-serif", fontSize: 12, color: withImage ? "hsl(0 0% 10%)" : "hsl(0 0% 55%)" }}
                  title={withImage ? "Showing articles with images only" : "Showing all articles"}
                  data-testid="toggle-with-image"
                >
                  {withImage ? <Image className="w-3.5 h-3.5" /> : <ImageOff className="w-3.5 h-3.5" />}
                  <span>{withImage ? "With images" : "All articles"}</span>
                </button>
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
