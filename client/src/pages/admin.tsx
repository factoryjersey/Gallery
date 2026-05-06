import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
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
  BookOpen
} from "lucide-react";
import ArticleEditor from "@/components/ArticleEditor";
import ArticleList from "@/components/ArticleList";
import CategoryList from "@/components/CategoryList";
import { CategoryHierarchyUpdater } from "@/components/CategoryHierarchyUpdater";
import AuthorList from "@/components/AuthorList";
import WordPressImporter from "@/components/WordPressImporter";
import WordPressDBMigration from "@/components/WordPressDBMigration";
import WordPressAuthorUpdater from "@/components/WordPressAuthorUpdater";
import { MediaManager } from "@/components/MediaManager";
import { MediaIndexing } from "@/components/MediaIndexing";
import { WPSync } from "@/components/WPSync";
import { FeaturedStoriesManager } from "@/components/FeaturedStoriesManager";
import { CartoonsManager } from "@/components/CartoonsManager";
import { DataMigration } from "@/components/DataMigration";
import IssuesManager from "@/components/IssuesManager";
import { useAdmin } from "@/contexts/AdminContext";

export default function Admin() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [showArticleEditor, setShowArticleEditor] = useState(false);
  const [editingArticleId, setEditingArticleId] = useState<string | undefined>(undefined);
  const { isAdmin, toggleAdmin } = useAdmin();

  const handleEditArticle = useCallback((articleId: string) => {
    setEditingArticleId(articleId);
    setShowArticleEditor(true);
    setActiveTab("articles");
  }, []);

  const handleCloseEditor = useCallback(() => {
    setShowArticleEditor(false);
    setEditingArticleId(undefined);
  }, []);

  // Enable admin mode when entering admin page
  useEffect(() => {
    if (!isAdmin) {
      toggleAdmin();
    }
  }, [isAdmin, toggleAdmin]);

  // Check for article edit request from URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('edit') === 'true' && params.get('tab') === 'articles') {
      const articleId = localStorage.getItem('editArticleId');
      if (articleId) {
        handleEditArticle(articleId);
        localStorage.removeItem('editArticleId');
        // Clean up URL
        window.history.replaceState({}, '', '/admin');
      }
    }
  }, [handleEditArticle]);

  const { data: statsData } = useQuery({
    queryKey: ["/api/stats"],
  });

  const { data: articlesData } = useQuery({
    queryKey: ["/api/articles?status=all&limit=10"],
  });

  const stats = statsData?.stats;

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
                  onClick={() => setActiveTab("authors")}
                  className={`w-full flex items-center px-4 py-3 rounded font-medium text-left ${
                    activeTab === "authors" 
                      ? "bg-primary text-primary-foreground" 
                      : "text-foreground hover:bg-accent"
                  }`}
                  data-testid="nav-authors"
                >
                  <Users className="w-5 h-5 mr-3" />
                  Authors
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

                  {/* Recent Articles */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Recent Articles</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4" data-testid="recent-articles">
                        {articlesData?.articles?.slice(0, 5).map((article) => (
                          <div key={article.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                            <div>
                              <h4 className="font-medium">{article.title}</h4>
                              <p className="text-sm text-muted-foreground">
                                {article.category.name} • {article.author.name}
                              </p>
                            </div>
                            <div className="flex items-center space-x-2">
                              <span className={`px-2 py-1 text-xs rounded-full ${
                                article.status === 'published' 
                                  ? 'bg-green-100 text-green-800' 
                                  : 'bg-yellow-100 text-yellow-800'
                              }`}>
                                {article.status}
                              </span>
                              <span className="text-sm text-muted-foreground">
                                {article.views} views
                              </span>
                            </div>
                          </div>
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

              {activeTab === "authors" && (
                <AuthorList />
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
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
