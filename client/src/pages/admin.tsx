import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation, useSearch } from "wouter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  FileText, 
  PlusCircle, 
  BarChart3, 
  Users, 
  FolderOpen, 
  Tags,
  Image,
  Upload,
  Settings,
  Home,
  Eye,
  ArrowLeft,
  RefreshCw,
  Star,
  Database,
  Pencil,
  BookOpen,
  TrendingUp,
  Mail
} from "lucide-react";
import ArticleEditor from "@/components/ArticleEditor";
import ArticleList from "@/components/ArticleList";
import CategoryList from "@/components/CategoryList";
import { CategoryHierarchyUpdater } from "@/components/CategoryHierarchyUpdater";
import AuthorList from "@/components/AuthorList";
import PeopleManager from "@/components/PeopleManager";
import WordPressImporter from "@/components/WordPressImporter";
import WordPressDBMigration from "@/components/WordPressDBMigration";
import WordPressAuthorUpdater from "@/components/WordPressAuthorUpdater";
import { MediaManager } from "@/components/MediaManager";
import { MediaIndexing } from "@/components/MediaIndexing";
import { WPSync } from "@/components/WPSync";
import { FeaturedStoriesManager } from "@/components/FeaturedStoriesManager";
import { PdfIngestManager } from "@/components/PdfIngestManager";
import { SplashSlidesManager } from "@/components/SplashSlidesManager";
import { CartoonsManager } from "@/components/CartoonsManager";
import { DataMigration } from "@/components/DataMigration";
import IssuesManager from "@/components/IssuesManager";
import { ContributorsManager } from "@/components/ContributorsManager";
import { PageViewsReport } from "@/components/PageViewsReport";
import SubscribersList from "@/components/SubscribersList";
import FeatureImporter from "@/components/FeatureImporter";
import { useAdmin } from "@/contexts/AdminContext";
import { Input } from "@/components/ui/input";
import { LogOut, LogIn } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Admin() {
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const searchParams = new URLSearchParams(searchString);
  // Tab + editing state derived from the URL query string so the page
  // can be refreshed, shared, or opened in a new tab. Reader lives in a
  // useEffect below that syncs URL → local state; writers all go
  // through pushLocation() to keep the URL authoritative.
  const [activeTab, setActiveTab] = useState<string>(searchParams.get("tab") || "dashboard");
  const [showArticleEditor, setShowArticleEditor] = useState<boolean>(!!searchParams.get("edit"));
  const [editingArticleId, setEditingArticleId] = useState<string | undefined>(
    searchParams.get("edit") || undefined,
  );
  const { isAdmin, configured, isLoading, login, logout } = useAdmin();
  const { toast } = useToast();

  /** Update /admin's query string in one go. Uses replaceState-flavour
   *  navigation via wouter's setLocation so back-button semantics still
   *  work — leaving the editor pops back to the article list. */
  const pushLocation = useCallback(
    (next: { tab?: string; edit?: string | null }) => {
      const params = new URLSearchParams(window.location.search);
      if (next.tab) params.set("tab", next.tab);
      if (next.edit === null) params.delete("edit");
      else if (next.edit) params.set("edit", next.edit);
      const qs = params.toString();
      setLocation(`/admin${qs ? `?${qs}` : ""}`);
    },
    [setLocation],
  );

  const handleEditArticle = useCallback(
    (articleId: string) => {
      setEditingArticleId(articleId);
      setShowArticleEditor(true);
      setActiveTab("articles");
      pushLocation({ tab: "articles", edit: articleId });
    },
    [pushLocation],
  );

  const handleCloseEditor = useCallback(() => {
    setShowArticleEditor(false);
    setEditingArticleId(undefined);
    pushLocation({ tab: "articles", edit: null });
  }, [pushLocation]);

  // URL → state: whenever the query string changes (browser back/forward,
  // direct paste of /admin?tab=articles&edit=<id>, refresh, etc.), pull
  // the tab + edit id out of it. Guarded to avoid clobbering local state
  // when the URL is already in sync.
  useEffect(() => {
    const params = new URLSearchParams(searchString);
    const tabParam = params.get("tab");
    const editParam = params.get("edit");
    if (tabParam && tabParam !== activeTab) setActiveTab(tabParam);
    if (editParam && editParam !== editingArticleId) {
      setEditingArticleId(editParam);
      setShowArticleEditor(true);
      setActiveTab("articles");
    } else if (!editParam && showArticleEditor) {
      setShowArticleEditor(false);
      setEditingArticleId(undefined);
    }
    // Legacy: earlier the editor was addressed via localStorage +
    // edit=true. If we see that shape, migrate it into a real id so
    // bookmarks minted before this change still work.
    if (editParam === "true") {
      const stashed = localStorage.getItem("editArticleId");
      if (stashed) {
        localStorage.removeItem("editArticleId");
        pushLocation({ tab: "articles", edit: stashed });
      }
    }
  }, [searchString]);

  const { data: statsData } = useQuery({
    queryKey: ["/api/stats"],
  });

  const { data: articlesData } = useQuery({
    queryKey: ["/api/articles?status=all&limit=10"],
  });

  const stats = statsData?.stats;

  // Gate: while we don't know yet whether the visitor is admin, render nothing;
  // if they're not admin, show the password prompt instead of the dashboard.
  if (isLoading) {
    return <div className="min-h-screen" />;
  }
  if (!isAdmin) {
    return <AdminLoginGate configured={configured} onSubmit={login} toast={toast} />;
  }

  return (
    <div className="min-h-screen bg-muted">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-card rounded-lg shadow-lg overflow-hidden">
          {/* Header */}
          <div className="bg-primary text-primary-foreground px-6 py-4 border-b border-border/20">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold font-serif">Admin Dashboard</h1>
              <div className="flex items-center space-x-4">
                <Link href="/">
                  <Button variant="secondary" size="sm" data-testid="button-view-site">
                    <Eye className="h-4 w-4 mr-2" />
                    View Site
                  </Button>
                </Link>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-primary-foreground hover:bg-primary-foreground/10"
                  onClick={() => {
                    setActiveTab("articles");
                    setShowArticleEditor(true);
                  }}
                  data-testid="button-new-article"
                >
                  <PlusCircle className="h-4 w-4 mr-2" />
                  New Article
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-primary-foreground hover:bg-primary-foreground/10"
                  onClick={() => logout()}
                  data-testid="button-admin-logout"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign out
                </Button>
              </div>
            </div>
          </div>

          <div className="flex">
            {/* Sidebar */}
            <div className="w-64 bg-muted/50 border-r border-border p-4">
              <nav className="space-y-1">
                <button
                  onClick={() => setActiveTab("dashboard")}
                  className={`w-full flex items-center px-4 py-3 rounded font-medium text-left ${
                    activeTab === "dashboard" 
                      ? "bg-primary text-primary-foreground" 
                      : "text-foreground hover:bg-accent"
                  }`}
                  data-testid="nav-dashboard"
                >
                  <BarChart3 className="w-5 h-5 mr-3" />
                  Dashboard
                </button>
                <button
                  onClick={() => {
                    setActiveTab("articles");
                    setShowArticleEditor(false);
                  }}
                  className={`w-full flex items-center px-4 py-3 rounded font-medium text-left ${
                    activeTab === "articles" 
                      ? "bg-primary text-primary-foreground" 
                      : "text-foreground hover:bg-accent"
                  }`}
                  data-testid="nav-articles"
                >
                  <FileText className="w-5 h-5 mr-3" />
                  Articles
                </button>
                <button
                  onClick={() => setActiveTab("categories")}
                  className={`w-full flex items-center px-4 py-3 rounded font-medium text-left ${
                    activeTab === "categories" 
                      ? "bg-primary text-primary-foreground" 
                      : "text-foreground hover:bg-accent"
                  }`}
                  data-testid="nav-categories"
                >
                  <FolderOpen className="w-5 h-5 mr-3" />
                  Categories
                </button>
                <button
                  onClick={() => setActiveTab("people")}
                  className={`w-full flex items-center px-4 py-3 rounded font-medium text-left ${
                    activeTab === "people"
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground hover:bg-accent"
                  }`}
                  data-testid="nav-people"
                >
                  <Users className="w-5 h-5 mr-3" />
                  People
                </button>
                <button
                  onClick={() => setActiveTab("media")}
                  className={`w-full flex items-center px-4 py-3 rounded font-medium text-left ${
                    activeTab === "media" 
                      ? "bg-primary text-primary-foreground" 
                      : "text-foreground hover:bg-accent"
                  }`}
                  data-testid="nav-media"
                >
                  <Image className="w-5 h-5 mr-3" />
                  Media
                </button>
                <button
                  onClick={() => setActiveTab("storage")}
                  className={`w-full flex items-center px-4 py-3 rounded font-medium text-left ${
                    activeTab === "storage" 
                      ? "bg-primary text-primary-foreground" 
                      : "text-foreground hover:bg-accent"
                  }`}
                  data-testid="nav-storage"
                >
                  <Settings className="w-5 h-5 mr-3" />
                  Storage & Indexing
                </button>
                <button
                  onClick={() => setActiveTab("import")}
                  className={`w-full flex items-center px-4 py-3 rounded font-medium text-left ${
                    activeTab === "import" 
                      ? "bg-primary text-primary-foreground" 
                      : "text-foreground hover:bg-accent"
                  }`}
                  data-testid="nav-import"
                >
                  <Upload className="w-5 h-5 mr-3" />
                  WordPress Import
                </button>
                <button
                  onClick={() => setActiveTab("featured")}
                  className={`w-full flex items-center px-4 py-3 rounded font-medium text-left ${
                    activeTab === "featured"
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground hover:bg-accent"
                  }`}
                  data-testid="nav-featured"
                >
                  <Star className="w-5 h-5 mr-3" />
                  Featured Stories
                </button>
                <button
                  onClick={() => setActiveTab("pdf-ingest")}
                  className={`w-full flex items-center px-4 py-3 rounded font-medium text-left ${
                    activeTab === "pdf-ingest"
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground hover:bg-accent"
                  }`}
                  data-testid="nav-pdf-ingest"
                >
                  <FileText className="w-5 h-5 mr-3" />
                  Import from PDF
                </button>
                <button
                  onClick={() => setActiveTab("splash")}
                  className={`w-full flex items-center px-4 py-3 rounded font-medium text-left ${
                    activeTab === "splash"
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground hover:bg-accent"
                  }`}
                  data-testid="nav-splash"
                >
                  <Image className="w-5 h-5 mr-3" />
                  Splash Intro
                </button>
                <button
                  onClick={() => setActiveTab("cartoons")}
                  className={`w-full flex items-center px-4 py-3 rounded font-medium text-left ${
                    activeTab === "cartoons"
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground hover:bg-accent"
                  }`}
                  data-testid="nav-cartoons"
                >
                  <Pencil className="w-5 h-5 mr-3" />
                  Cartoons
                </button>
                <button
                  onClick={() => setActiveTab("migration")}
                  className={`w-full flex items-center px-4 py-3 rounded font-medium text-left ${
                    activeTab === "migration"
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground hover:bg-accent"
                  }`}
                  data-testid="nav-migration"
                >
                  <Database className="w-5 h-5 mr-3" />
                  Data Migration
                </button>
                <button
                  onClick={() => setActiveTab("sync")}
                  className={`w-full flex items-center px-4 py-3 rounded font-medium text-left ${
                    activeTab === "sync" 
                      ? "bg-primary text-primary-foreground" 
                      : "text-foreground hover:bg-accent"
                  }`}
                  data-testid="nav-sync"
                >
                  <RefreshCw className="w-5 h-5 mr-3" />
                  Live Sync
                </button>
                <button
                  onClick={() => setActiveTab("issues")}
                  className={`w-full flex items-center px-4 py-3 rounded font-medium text-left ${
                    activeTab === "issues"
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground hover:bg-accent"
                  }`}
                  data-testid="nav-issues"
                >
                  <BookOpen className="w-5 h-5 mr-3" />
                  Issue Archive
                </button>
                <button
                  onClick={() => setActiveTab("contributors")}
                  className={`w-full flex items-center px-4 py-3 rounded font-medium text-left ${
                    activeTab === "contributors"
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground hover:bg-accent"
                  }`}
                  data-testid="nav-contributors"
                >
                  <Users className="w-5 h-5 mr-3" />
                  Issue contributors
                </button>
                <button
                  onClick={() => setActiveTab("pageviews")}
                  className={`w-full flex items-center px-4 py-3 rounded font-medium text-left ${
                    activeTab === "pageviews"
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground hover:bg-accent"
                  }`}
                  data-testid="nav-pageviews"
                >
                  <TrendingUp className="w-5 h-5 mr-3" />
                  Page Views
                </button>
                <button
                  onClick={() => setActiveTab("subscribers")}
                  className={`w-full flex items-center px-4 py-3 rounded font-medium text-left ${
                    activeTab === "subscribers"
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground hover:bg-accent"
                  }`}
                  data-testid="nav-subscribers"
                >
                  <Mail className="w-5 h-5 mr-3" />
                  Subscribers
                </button>
                <button
                  onClick={() => setActiveTab("feature-import")}
                  className={`w-full flex items-center px-4 py-3 rounded font-medium text-left ${
                    activeTab === "feature-import"
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground hover:bg-accent"
                  }`}
                  data-testid="nav-feature-import"
                >
                  <Image className="w-5 h-5 mr-3" />
                  Feature import
                </button>
              </nav>
            </div>

            {/* Main Content */}
            <div className="flex-1 p-6">
              {activeTab === "dashboard" && (
                <div className="space-y-6">
                  {/* Stats Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <Card>
                      <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-muted-foreground">Total Articles</p>
                            <p className="text-2xl font-bold" data-testid="stat-total-articles">
                              {stats?.totalArticles || 0}
                            </p>
                          </div>
                          <FileText className="h-8 w-8 text-primary/60" />
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-muted-foreground">Published</p>
                            <p className="text-2xl font-bold" data-testid="stat-published">
                              {stats?.publishedArticles || 0}
                            </p>
                          </div>
                          <div className="h-8 w-8 bg-green-100 rounded-full flex items-center justify-center">
                            <div className="h-4 w-4 bg-green-500 rounded-full" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-muted-foreground">Drafts</p>
                            <p className="text-2xl font-bold" data-testid="stat-drafts">
                              {stats?.draftArticles || 0}
                            </p>
                          </div>
                          <div className="h-8 w-8 bg-yellow-100 rounded-full flex items-center justify-center">
                            <div className="h-4 w-4 bg-yellow-500 rounded-full" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-muted-foreground">Total Views</p>
                            <p className="text-2xl font-bold" data-testid="stat-total-views">
                              {stats?.totalViews?.toLocaleString() || 0}
                            </p>
                          </div>
                          <BarChart3 className="h-8 w-8 text-secondary/60" />
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Recent Articles — clickable rows open the editor for
                      that article; thumbnail comes from featuredImage
                      (falls back to a category-name placeholder so a
                      missing image doesn't leave a hollow tile). */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Recent Articles</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2" data-testid="recent-articles">
                        {articlesData?.articles?.slice(0, 5).map((article) => (
                          <button
                            key={article.id}
                            type="button"
                            onClick={() => handleEditArticle(article.id)}
                            className="w-full flex items-center gap-4 py-2 px-2 -mx-2 border-b border-border last:border-0 text-left hover:bg-accent/40 transition-colors rounded-sm focus:outline-none focus:ring-2 focus:ring-secondary"
                            data-testid={`recent-article-${article.id}`}
                          >
                            <div
                              className="shrink-0 w-16 h-16 overflow-hidden bg-[hsl(0,0%,94%)] border border-border"
                              aria-hidden="true"
                            >
                              {article.featuredImage ? (
                                <img
                                  src={article.featuredImage}
                                  alt=""
                                  loading="lazy"
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-[9px] uppercase tracking-widest text-muted-foreground px-1 text-center leading-tight">
                                  {article.category?.name || "No image"}
                                </div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="font-medium line-clamp-2">{article.title}</h4>
                              <p className="text-sm text-muted-foreground line-clamp-1">
                                {article.category?.name || "Uncategorised"}
                                {article.author?.name ? ` • ${article.author.name}` : ""}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span
                                className={`px-2 py-1 text-xs rounded-full ${
                                  article.status === "published"
                                    ? "bg-green-100 text-green-800"
                                    : "bg-yellow-100 text-yellow-800"
                                }`}
                              >
                                {article.status}
                              </span>
                              <span className="text-sm text-muted-foreground whitespace-nowrap">
                                {article.views} views
                              </span>
                            </div>
                          </button>
                        )) || (
                          <div className="text-center py-8 text-muted-foreground">
                            No articles found. Create your first article!
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {activeTab === "articles" && (
                showArticleEditor ? (
                  <div>
                    <Button
                      variant="ghost"
                      onClick={handleCloseEditor}
                      className="mb-4"
                      data-testid="button-back-to-list"
                    >
                      <ArrowLeft className="h-4 w-4 mr-2" />
                      Back to Articles
                    </Button>
                    <ArticleEditor articleId={editingArticleId} onClose={handleCloseEditor} />
                  </div>
                ) : (
                  <ArticleList onEditArticle={handleEditArticle} />
                )
              )}

              {activeTab === "import" && (
                <div className="space-y-6">
                  <Tabs defaultValue="xml" data-testid="import-tabs">
                    <TabsList className="grid w-full grid-cols-3">
                      <TabsTrigger value="xml" data-testid="tab-xml-import">
                        Full Import
                      </TabsTrigger>
                      <TabsTrigger value="authors" data-testid="tab-authors-update">
                        Update Authors
                      </TabsTrigger>
                      <TabsTrigger value="database" data-testid="tab-db-import">
                        Database Migration
                      </TabsTrigger>
                    </TabsList>
                    <TabsContent value="xml" data-testid="xml-import-content">
                      <WordPressImporter />
                    </TabsContent>
                    <TabsContent value="authors" data-testid="authors-update-content">
                      <WordPressAuthorUpdater />
                    </TabsContent>
                    <TabsContent value="database" data-testid="db-import-content">
                      <WordPressDBMigration />
                    </TabsContent>
                  </Tabs>
                </div>
              )}

              {activeTab === "categories" && (
                <div className="space-y-6">
                  <CategoryHierarchyUpdater />
                  <CategoryList />
                </div>
              )}

              {activeTab === "people" && (
                <PeopleManager />
              )}

              {activeTab === "media" && (
                <MediaManager />
              )}

              {activeTab === "storage" && (
                <MediaIndexing />
              )}

              {activeTab === "featured" && (
                <FeaturedStoriesManager />
              )}

              {activeTab === "pdf-ingest" && (
                <PdfIngestManager />
              )}

              {activeTab === "splash" && (
                <SplashSlidesManager />
              )}

              {activeTab === "cartoons" && (
                <CartoonsManager />
              )}

              {activeTab === "migration" && (
                <DataMigration />
              )}

              {activeTab === "sync" && (
                <WPSync />
              )}

              {activeTab === "issues" && (
                <IssuesManager />
              )}

              {activeTab === "contributors" && (
                <ContributorsManager />
              )}

              {activeTab === "pageviews" && (
                <PageViewsReport />
              )}

              {activeTab === "subscribers" && (
                <SubscribersList />
              )}

              {activeTab === "feature-import" && (
                <FeatureImporter />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AdminLoginGate({
  configured,
  onSubmit,
  toast,
}: {
  configured: boolean;
  onSubmit: (password: string) => Promise<{ ok: boolean; error?: string }>;
  toast: ReturnType<typeof useToast>["toast"];
}) {
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;
    setSubmitting(true);
    const result = await onSubmit(password);
    setSubmitting(false);
    if (!result.ok) {
      toast({
        title: "Sign-in failed",
        description: result.error || "Incorrect password.",
        variant: "destructive",
      });
      setPassword("");
    }
  };

  return (
    <div className="min-h-screen bg-muted flex items-center justify-center px-6">
      <div className="bg-card border border-border shadow-lg w-full max-w-sm p-8">
        <h1
          className="mb-1"
          style={{ fontFamily: "Georgia, serif", fontSize: 24, fontWeight: 400 }}
        >
          Admin sign-in
        </h1>
        <p
          className="mb-6 text-sm"
          style={{ color: "hsl(0 0% 45%)", fontFamily: "Georgia, serif" }}
        >
          {configured
            ? "Enter the admin password to manage Gallery."
            : "Admin access is not yet configured on this server (ADMIN_PASSWORD / ADMIN_COOKIE_SECRET unset)."}
        </p>
        <form onSubmit={handle} className="space-y-4">
          <Input
            type="password"
            autoFocus
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={submitting || !configured}
            data-testid="admin-login-password"
          />
          <Button
            type="submit"
            className="w-full"
            disabled={submitting || !configured || !password}
            data-testid="admin-login-submit"
          >
            <LogIn className="h-4 w-4 mr-2" />
            {submitting ? "Signing in…" : "Sign in"}
          </Button>
        </form>
        <div className="mt-6 text-center">
          <Link href="/">
            <span className="text-xs underline text-muted-foreground hover:text-foreground cursor-pointer">
              Back to the site
            </span>
          </Link>
        </div>
      </div>
    </div>
  );
}
