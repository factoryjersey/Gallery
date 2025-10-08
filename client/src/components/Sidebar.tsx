import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Flame, Mail, TrendingUp } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";

export default function Sidebar() {
  const [email, setEmail] = useState("");
  const { toast } = useToast();

  const { data: trendingData } = useQuery({
    queryKey: ["/api/articles/trending"],
  });

  const { data: categoriesData } = useQuery({
    queryKey: ["/api/categories"],
  });

  const handleNewsletterSignup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    
    // TODO: Implement newsletter signup API call
    toast({
      title: "Success!",
      description: "Thank you for subscribing to our newsletter.",
    });
    setEmail("");
  };

  const trendingArticles = trendingData?.articles || [];
  const categories = categoriesData?.categories || [];

  return (
    <aside className="space-y-6">
      {/* Trending Stories */}
      <Card className="shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center text-foreground" data-testid="trending-title">
            <Flame className="h-5 w-5 text-secondary mr-2" />
            Trending Now
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4" data-testid="trending-articles">
            {trendingArticles.length > 0 ? (
              trendingArticles.map((article, index) => (
                <Link key={article.id} href={`/article/${article.slug}`}>
                  <div className="flex items-start space-x-3 pb-4 border-b border-border last:border-0 last:pb-0 cursor-pointer hover:bg-muted/50 p-2 rounded transition-colors" data-testid={`trending-article-${index}`}>
                    <span className="text-2xl font-bold text-muted-foreground min-w-[2rem]" data-testid={`trending-rank-${index}`}>
                      {index + 1}
                    </span>
                    <div className="flex-1">
                      <h4 className="font-semibold text-foreground text-sm mb-1 hover:text-secondary line-clamp-2" data-testid={`trending-title-${index}`}>
                        {article.title}
                      </h4>
                      <div className="text-xs text-muted-foreground">
                        <span data-testid={`trending-read-time-${index}`}>{article.readTime} min read</span>
                        <span className="mx-1">•</span>
                        <span data-testid={`trending-views-${index}`}>{article.views.toLocaleString()} views</span>
                      </div>
                    </div>
                  </div>
                </Link>
              ))
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-sm">No trending articles yet</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Newsletter Signup */}
      <Card className="bg-primary text-primary-foreground shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center" data-testid="newsletter-title">
            <Mail className="h-5 w-5 mr-2" />
            Stay Informed
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm mb-4 opacity-90">
            Get the latest stories delivered to your inbox.
          </p>
          <form onSubmit={handleNewsletterSignup} className="space-y-3" data-testid="sidebar-newsletter-form">
            <Input
              type="email"
              placeholder="Your email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground placeholder:text-primary-foreground/60 focus:ring-secondary"
              required
              data-testid="sidebar-newsletter-email"
            />
            <Button 
              type="submit" 
              className="w-full bg-secondary hover:bg-secondary/90 text-white font-semibold"
              data-testid="sidebar-newsletter-submit"
            >
              Subscribe Now
            </Button>
          </form>
          <p className="text-xs mt-3 opacity-75">
            We respect your privacy. Unsubscribe anytime.
          </p>
        </CardContent>
      </Card>

      {/* Popular Categories */}
      <Card className="shadow-md">
        <CardHeader>
          <CardTitle className="text-foreground" data-testid="popular-categories-title">
            Popular Topics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2" data-testid="popular-categories">
            {categories.length > 0 ? (
              categories.slice(0, 6).map((category) => (
                <Link key={category.id} href={`/category/${category.slug}`}>
                  <div className="flex items-center justify-between py-2 px-3 rounded hover:bg-muted transition-colors group cursor-pointer" data-testid={`category-${category.slug}`}>
                    <span className="text-foreground group-hover:text-secondary font-medium">
                      {category.name}
                    </span>
                    <Badge variant="secondary" className="text-xs">
                      Popular
                    </Badge>
                  </div>
                </Link>
              ))
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <p className="text-sm">No categories available</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </aside>
  );
}
