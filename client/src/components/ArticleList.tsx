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

  const { data: articlesData, isLoading } = useQuery({
    queryKey: ["/api/articles?status=all&limit=10000"],
  });

  const articles = articlesData?.articles || [];
  
  // Extract unique years from articles
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    articles.forEach((article: any) => {
      if (article.publishedAt) {
        const year = new Date(article.publishedAt).getFullYear();
        years.add(year);
      }
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [articles]);

  const filteredArticles = articles.filter((article: any) => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = (
      (article.title ?? '').toLowerCase().includes(searchLower) ||
      (article.category?.name ?? '').toLowerCase().includes(searchLower) ||
      (article.author?.name ?? '').toLowerCase().includes(searchLower)
    );

    const matchesYear = selectedYear === "all" || 
      (article.publishedAt && new Date(article.publishedAt).getFullYear() === parseInt(selectedYear));

    return matchesSearch && matchesYear;
  });

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
          {filteredArticles.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchTerm ? "No articles found matching your search." : "No articles yet. Create your first article!"}
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
                {filteredArticles.map((article: any) => (
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

      <div className="text-sm text-muted-foreground">
        Showing {filteredArticles.length} of {articles.length} articles
      </div>
    </div>
  );
}
