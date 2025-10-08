import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Plus, 
  Newspaper, 
  Users, 
  Eye, 
  Edit, 
  Trash2,
  BarChart3,
  Settings,
  FolderOpen,
  Tags,
  Image,
  FileDown,
  Filter,
  TrendingUp
} from "lucide-react";
import ArticleEditor from "./ArticleEditor";
import WordPressImporter from "./WordPressImporter";
import { format } from "date-fns";

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [showEditor, setShowEditor] = useState(false);
  const [editingArticle, setEditingArticle] = useState(null);

  const { data: stats } = useQuery({
    queryKey: ['/api/articles/stats'],
  });

  const { data: articlesData } = useQuery({
    queryKey: ['/api/articles', { limit: 10, offset: 0 }],
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['/api/categories'],
  });

  const articles = articlesData?.articles || [];

  const formatDate = (date: string | Date) => {
    return format(new Date(date), 'MMM d, yyyy');
  };

  const formatViews = (views: number) => {
    if (views >= 1000) {
      return `${(views / 1000).toFixed(1)}K`;
    }
    return views.toString();
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Dashboard Header */}
      <div className="bg-primary text-primary-foreground px-6 py-4 border-b border-border/20">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <h1 className="text-2xl font-bold font-serif">Admin Dashboard</h1>
          <div className="flex items-center space-x-4">
            <Button
              onClick={() => setShowEditor(true)}
              className="bg-secondary hover:bg-secondary/90 text-white font-semibold"
            >
              <Plus className="w-4 h-4 mr-2" />
              New Article
            </Button>
            <Button
              variant="secondary"
              className="bg-primary-foreground/10 hover:bg-primary-foreground/20 text-primary-foreground"
            >
              <Settings className="w-4 h-4 mr-2" />
              Settings
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-7">
            <TabsTrigger value="dashboard" className="flex items-center">
              <BarChart3 className="w-4 h-4 mr-2" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="articles" className="flex items-center">
              <Newspaper className="w-4 h-4 mr-2" />
              Articles
            </TabsTrigger>
            <TabsTrigger value="categories" className="flex items-center">
              <FolderOpen className="w-4 h-4 mr-2" />
              Categories
            </TabsTrigger>
            <TabsTrigger value="tags" className="flex items-center">
              <Tags className="w-4 h-4 mr-2" />
              Tags
            </TabsTrigger>
            <TabsTrigger value="media" className="flex items-center">
              <Image className="w-4 h-4 mr-2" />
              Media
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center">
              <TrendingUp className="w-4 h-4 mr-2" />
              Analytics
            </TabsTrigger>
            <TabsTrigger value="import" className="flex items-center">
              <FileDown className="w-4 h-4 mr-2" />
              Import
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Total Articles</p>
                      <p className="text-3xl font-bold text-foreground">
                        {stats?.total || 0}
                      </p>
                    </div>
                    <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                      <Newspaper className="w-6 h-6 text-primary" />
                    </div>
                  </div>
                  <p className="text-xs text-green-600 mt-2 flex items-center">
                    <TrendingUp className="w-3 h-3 mr-1" />
                    12% from last month
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Published</p>
                      <p className="text-3xl font-bold text-foreground">
                        {stats?.published || 0}
                      </p>
                    </div>
                    <div className="w-12 h-12 bg-green-500/10 rounded-full flex items-center justify-center">
                      <Eye className="w-6 h-6 text-green-600" />
                    </div>
                  </div>
                  <p className="text-xs text-green-600 mt-2 flex items-center">
                    <TrendingUp className="w-3 h-3 mr-1" />
                    8% from last month
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Drafts</p>
                      <p className="text-3xl font-bold text-foreground">
                        {stats?.drafts || 0}
                      </p>
                    </div>
                    <div className="w-12 h-12 bg-yellow-500/10 rounded-full flex items-center justify-center">
                      <Edit className="w-6 h-6 text-yellow-600" />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Pending review
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Total Views</p>
                      <p className="text-3xl font-bold text-foreground">
                        {formatViews(stats?.totalViews || 0)}
                      </p>
                    </div>
                    <div className="w-12 h-12 bg-secondary/10 rounded-full flex items-center justify-center">
                      <Eye className="w-6 h-6 text-secondary" />
                    </div>
                  </div>
                  <p className="text-xs text-green-600 mt-2 flex items-center">
                    <TrendingUp className="w-3 h-3 mr-1" />
                    18% from last month
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Recent Articles */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Recent Articles</CardTitle>
                <div className="flex space-x-2">
                  <Button variant="outline" size="sm">
                    <Filter className="w-4 h-4 mr-2" />
                    Filter
                  </Button>
                  <Button variant="outline" size="sm">
                    <FileDown className="w-4 h-4 mr-2" />
                    Export
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-4 font-semibold text-muted-foreground">Title</th>
                        <th className="text-left py-3 px-4 font-semibold text-muted-foreground">Category</th>
                        <th className="text-left py-3 px-4 font-semibold text-muted-foreground">Author</th>
                        <th className="text-left py-3 px-4 font-semibold text-muted-foreground">Status</th>
                        <th className="text-left py-3 px-4 font-semibold text-muted-foreground">Views</th>
                        <th className="text-left py-3 px-4 font-semibold text-muted-foreground">Date</th>
                        <th className="text-left py-3 px-4 font-semibold text-muted-foreground">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {articles.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="text-center py-8 text-muted-foreground">
                            No articles found. Create your first article to get started.
                          </td>
                        </tr>
                      ) : (
                        articles.map((article) => (
                          <tr key={article.id} className="border-b hover:bg-muted/50">
                            <td className="py-3 px-4">
                              <div className="flex items-center">
                                <div className="w-12 h-12 rounded bg-muted mr-3 flex-shrink-0">
                                  {article.featuredImageUrl && (
                                    <img
                                      src={article.featuredImageUrl}
                                      alt=""
                                      className="w-full h-full object-cover rounded"
                                    />
                                  )}
                                </div>
                                <div>
                                  <div className="text-sm font-medium text-foreground line-clamp-1">
                                    {article.title}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    /{article.slug}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              {article.category && (
                                <Badge variant="secondary">
                                  {article.category.name}
                                </Badge>
                              )}
                            </td>
                            <td className="py-3 px-4 text-sm">
                              {article.author.username}
                            </td>
                            <td className="py-3 px-4">
                              <Badge variant={article.status === 'published' ? 'default' : 'secondary'}>
                                {article.status}
                              </Badge>
                            </td>
                            <td className="py-3 px-4 text-sm">
                              {formatViews(article.views)}
                            </td>
                            <td className="py-3 px-4 text-sm text-muted-foreground">
                              {formatDate(article.createdAt)}
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex space-x-2">
                                <Button variant="ghost" size="sm">
                                  <Edit className="w-4 h-4" />
                                </Button>
                                <Button variant="ghost" size="sm">
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="articles">
            <ArticleEditor />
          </TabsContent>

          <TabsContent value="categories">
            <Card>
              <CardHeader>
                <CardTitle>Categories</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">Category management coming soon.</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tags">
            <Card>
              <CardHeader>
                <CardTitle>Tags</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">Tag management coming soon.</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="media">
            <Card>
              <CardHeader>
                <CardTitle>Media Library</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">Media library coming soon.</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analytics">
            <Card>
              <CardHeader>
                <CardTitle>Analytics</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">Analytics dashboard coming soon.</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="import">
            <WordPressImporter />
          </TabsContent>
        </Tabs>
      </div>

      {/* Article Editor Modal */}
      {showEditor && (
        <ArticleEditor
          article={editingArticle}
          onClose={() => {
            setShowEditor(false);
            setEditingArticle(null);
          }}
        />
      )}
    </div>
  );
}
