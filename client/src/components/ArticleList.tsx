import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Search, Edit, Eye, Trash2, Calendar } from "lucide-react";
import { format } from "date-fns";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface ArticleListProps {
  onEditArticle?: (articleId: string) => void;
}

export default function ArticleList({ onEditArticle }: ArticleListProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedYear, setSelectedYear] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [selectedArticles, setSelectedArticles] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<string>("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [articleToDelete, setArticleToDelete] = useState<string | null>(null);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const queryParams = new URLSearchParams({
    status: 'all',
    ...(searchTerm && { search: searchTerm }),
    ...(selectedYear !== "all" && { year: selectedYear }),
    page: currentPage.toString(),
    limit: itemsPerPage.toString(),
  });

  const { data: articlesData, isLoading } = useQuery({
    queryKey: [`/api/articles?${queryParams.toString()}`],
  });

  const articles = articlesData?.articles || [];
  const pagination = articlesData?.pagination;
  
  // Generate available years (2008-2025)
  const availableYears = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const years: number[] = [];
    for (let year = 2008; year <= currentYear; year++) {
      years.push(year);
    }
    return years.reverse(); // Show newest first
  }, []);

  // Delete mutation
  const deleteMutation = useMutation({
    // apiRequest signature is (method, url, data?) — was being called as
    // (url, options) so the underlying fetch saw a literal "/api/..." as the
    // HTTP method and an options object as the URL. Hence every delete
    // returned a generic "Failed to delete article" toast.
    mutationFn: async (articleId: string) => {
      return await apiRequest("DELETE", `/api/articles/${articleId}`);
    },
    onSuccess: () => {
      // Invalidate all article queries by matching keys that start with /api/articles
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === 'string' && key.startsWith('/api/articles');
        }
      });
      toast({
        title: "Success",
        description: "Article deleted successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete article",
        variant: "destructive",
      });
    }
  });

  // Bulk delete mutation
  const bulkDeleteMutation = useMutation({
    mutationFn: async (articleIds: string[]) => {
      await Promise.all(
        articleIds.map((id) => apiRequest("DELETE", `/api/articles/${id}`)),
      );
    },
    onSuccess: () => {
      // Invalidate all article queries by matching keys that start with /api/articles
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === 'string' && key.startsWith('/api/articles');
        }
      });
      setSelectedArticles(new Set());
      toast({
        title: "Success",
        description: `${selectedArticles.size} articles deleted successfully`,
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete articles",
        variant: "destructive",
      });
    }
  });

  // Handlers
  const toggleArticle = (articleId: string) => {
    const newSelected = new Set(selectedArticles);
    if (newSelected.has(articleId)) {
      newSelected.delete(articleId);
    } else {
      newSelected.add(articleId);
    }
    setSelectedArticles(newSelected);
  };

  const toggleAll = () => {
    if (selectedArticles.size === articles.length) {
      setSelectedArticles(new Set());
    } else {
      setSelectedArticles(new Set(articles.map(a => a.id)));
    }
  };

  const handleBulkAction = () => {
    if (bulkAction === 'delete' && selectedArticles.size > 0) {
      bulkDeleteMutation.mutate(Array.from(selectedArticles));
      setBulkAction('');
    }
  };

  const handleDelete = (articleId: string) => {
    setArticleToDelete(articleId);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (articleToDelete) {
      deleteMutation.mutate(articleToDelete);
      setDeleteDialogOpen(false);
      setArticleToDelete(null);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center text-muted-foreground">Loading articles...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Articles</h2>
        <div className="flex items-center space-x-2">
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-[150px]" data-testid="select-year-filter">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue placeholder="All Years" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Years</SelectItem>
              {availableYears.map((year) => (
                <SelectItem key={year} value={year.toString()}>
                  {year} ({articles.filter((a: any) => a.publishedAt && new Date(a.publishedAt).getFullYear() === year).length})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search articles..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-64"
              data-testid="input-search-articles"
            />
          </div>
        </div>
      </div>

      {/* Bulk Actions */}
      {selectedArticles.size > 0 && (
        <div className="flex items-center space-x-2 bg-muted p-3 rounded-md">
          <span className="text-sm font-medium">{selectedArticles.size} selected</span>
          <Select value={bulkAction} onValueChange={setBulkAction}>
            <SelectTrigger className="w-[180px]" data-testid="select-bulk-action">
              <SelectValue placeholder="Bulk Actions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="delete">Delete</SelectItem>
            </SelectContent>
          </Select>
          <Button 
            onClick={handleBulkAction} 
            disabled={!bulkAction || bulkDeleteMutation.isPending}
            data-testid="button-apply-bulk"
          >
            Apply
          </Button>
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          {articles.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchTerm || selectedYear !== "all" ? "No articles found matching your filters." : "No articles yet. Create your first article!"}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox 
                      checked={selectedArticles.size === articles.length && articles.length > 0}
                      onCheckedChange={toggleAll}
                      data-testid="checkbox-select-all"
                    />
                  </TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Author</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Views</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {articles.map((article: any) => (
                  <TableRow key={article.id} data-testid={`row-article-${article.id}`}>
                    <TableCell>
                      <Checkbox 
                        checked={selectedArticles.has(article.id)}
                        onCheckedChange={() => toggleArticle(article.id)}
                        data-testid={`checkbox-${article.id}`}
                      />
                    </TableCell>
                    <TableCell className="font-medium max-w-xs">
                      <button
                        onClick={() => onEditArticle?.(article.id)}
                        className="truncate hover:text-primary hover:underline cursor-pointer text-left w-full"
                        data-testid={`title-${article.id}`}
                      >
                        {article.title}
                      </button>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" style={{ borderColor: article.category?.color }}>
                        {article.category?.name}
                      </Badge>
                    </TableCell>
                    <TableCell>{article.author?.name}</TableCell>
                    <TableCell>
                      <Badge
                        variant={article.status === "published" ? "default" : "secondary"}
                        data-testid={`status-${article.id}`}
                      >
                        {article.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{article.views || 0}</TableCell>
                    <TableCell>
                      {article.publishedAt 
                        ? format(new Date(article.publishedAt), "MMM d, yyyy")
                        : "Draft"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end space-x-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setLocation(`/article/${article.slug}`)}
                          data-testid={`button-view-${article.id}`}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onEditArticle?.(article.id)}
                          data-testid={`button-edit-${article.id}`}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(article.id)}
                          disabled={deleteMutation.isPending}
                          data-testid={`button-delete-${article.id}`}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {pagination && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} articles
          </div>
          <div className="flex items-center space-x-2">
            <div className="text-sm text-muted-foreground mr-4">
              Items per page:
              <select 
                value={itemsPerPage} 
                onChange={(e) => {
                  setItemsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="ml-2 border rounded px-2 py-1 bg-background"
                data-testid="select-items-per-page"
              >
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(currentPage - 1)}
              data-testid="pagination-prev"
            >
              Previous
            </Button>
            <div className="text-sm">
              Page {pagination.page} of {pagination.totalPages}
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage >= pagination.totalPages}
              onClick={() => setCurrentPage(currentPage + 1)}
              data-testid="pagination-next"
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the article.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
