import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Calendar, Clock, Eye, User, ArrowLeft, Edit } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Link } from "wouter";
import ArticleGallery from "@/components/ArticleGallery";
import { useAdmin } from "@/contexts/AdminContext";

export default function Article() {
  const { slug } = useParams();
  const [, navigate] = useLocation();
  const { isAdmin } = useAdmin();

  const { data, isLoading, error } = useQuery({
    queryKey: [`/api/articles/by-slug/${slug}`],
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="max-w-4xl mx-auto px-4 py-12">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-muted rounded w-3/4"></div>
            <div className="h-4 bg-muted rounded w-1/2"></div>
            <div className="h-64 bg-muted rounded"></div>
            <div className="space-y-2">
              <div className="h-4 bg-muted rounded"></div>
              <div className="h-4 bg-muted rounded w-5/6"></div>
              <div className="h-4 bg-muted rounded w-4/6"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !data?.article) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="max-w-4xl mx-auto px-4 py-12 text-center">
          <h1 className="text-2xl font-bold mb-4">Article Not Found</h1>
          <p className="text-muted-foreground mb-6">
            The article you're looking for doesn't exist or has been removed.
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

  const { article } = data;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <article className="max-w-4xl mx-auto px-4 py-12">
        {/* Back Button and Admin Edit */}
        <div className="flex justify-between items-center mb-6">
          <Link href="/">
            <Button variant="ghost" data-testid="back-button">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Articles
            </Button>
          </Link>
          {isAdmin && article && (
            <Button
              onClick={() => {
                // Store the article ID in localStorage to be picked up by admin page
                localStorage.setItem('editArticleId', article.id);
                navigate('/admin?tab=articles&edit=true');
              }}
              variant="default"
              size="sm"
              data-testid="button-edit-article"
            >
              <Edit className="h-4 w-4 mr-2" />
              Edit Article
            </Button>
          )}
        </div>

        {/* Article Header */}
        <header className="mb-8">
          <div className="flex flex-wrap gap-2 mb-4">
            <Badge variant="secondary" data-testid="article-category">
              {article.category.name}
            </Badge>
            {article.tags.map((tag) => (
              <Badge key={tag.id} variant="outline" data-testid={`article-tag-${tag.slug}`}>
                {tag.name}
              </Badge>
            ))}
          </div>

          <h1 className="text-4xl font-bold font-serif text-foreground mb-4" data-testid="article-title">
            {article.title}
          </h1>

          {article.excerpt && (
            <p className="text-xl text-muted-foreground mb-6 leading-relaxed" data-testid="article-excerpt">
              {article.excerpt}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-6 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4" />
              <span data-testid="article-author">{article.author.name}</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              <span data-testid="article-date">
                {format(new Date(article.publishedAt || article.createdAt), "MMM d, yyyy")}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              <span data-testid="article-read-time">{article.readTime} min read</span>
            </div>
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4" />
              <span data-testid="article-views">{article.views.toLocaleString()} views</span>
            </div>
          </div>
        </header>

        {/* Featured Image */}
        {article.featuredImage && (
          <div className="mb-8">
            <img
              src={article.featuredImage}
              alt={article.title}
              className="w-full h-64 md:h-96 object-cover rounded-lg shadow-lg"
              data-testid="article-featured-image"
            />
          </div>
        )}

        {/* Article Content */}
        <ArticleGallery 
          content={article.content}
          className="prose prose-lg max-w-none prose-headings:font-serif prose-headings:font-bold prose-p:text-foreground prose-p:leading-relaxed"
        />

        {/* Article Footer */}
        <footer className="mt-12 pt-8 border-t border-border">
          <div className="flex items-center gap-4">
            {article.author.avatar && (
              <img
                src={article.author.avatar}
                alt={article.author.name}
                className="w-12 h-12 rounded-full"
                data-testid="author-avatar"
              />
            )}
            <div>
              <h3 className="font-semibold" data-testid="author-name-footer">
                {article.author.name}
              </h3>
              {article.author.bio && (
                <p className="text-sm text-muted-foreground" data-testid="author-bio">
                  {article.author.bio}
                </p>
              )}
            </div>
          </div>
        </footer>
      </article>

      <Footer />
    </div>
  );
}
