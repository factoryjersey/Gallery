import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

export default function ArticleList() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedYear, setSelectedYear] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);

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
                    <TableCell className="font-medium max-w-xs truncate">
                      {article.title}
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
                          data-testid={`button-view-${article.id}`}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          data-testid={`button-edit-${article.id}`}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
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
    </div>
  );
}
