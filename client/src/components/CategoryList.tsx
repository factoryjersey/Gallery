import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Search, Edit, Trash2, FolderOpen } from "lucide-react";

export default function CategoryList() {
  const [searchTerm, setSearchTerm] = useState("");

  const { data: categoriesData, isLoading } = useQuery({
    queryKey: ["/api/categories"],
  });

  const categories = categoriesData?.categories || [];
  
  // Build hierarchical structure
  const buildHierarchy = (cats: any[], parentId: string | null = null, level: number = 0): any[] => {
    const result: any[] = [];
    cats.filter(c => c.parentId === parentId).forEach(cat => {
      result.push({ ...cat, level });
      result.push(...buildHierarchy(cats, cat.id, level + 1));
    });
    return result;
  };
  
  const hierarchicalCategories = buildHierarchy(categories);
  
  const filteredCategories = hierarchicalCategories.filter((category: any) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      (category.name ?? '').toLowerCase().includes(searchLower) ||
      (category.slug ?? '').toLowerCase().includes(searchLower) ||
      (category.description ?? '').toLowerCase().includes(searchLower)
    );
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center text-muted-foreground">Loading categories...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Categories</h2>
        <div className="flex items-center space-x-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search categories..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-64"
              data-testid="input-search-categories"
            />
          </div>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {filteredCategories.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchTerm ? "No categories found matching your search." : "No categories yet."}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Color</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCategories.map((category: any) => (
                  <TableRow key={category.id} data-testid={`row-category-${category.id}`}>
                    <TableCell className="font-medium">
                      <div className="flex items-center space-x-2" style={{ paddingLeft: `${category.level * 24}px` }}>
                        <FolderOpen className="h-4 w-4" style={{ color: category.color }} />
                        <span>{category.name}</span>
                        {category.level > 0 && (
                          <Badge variant="outline" className="text-xs">
                            Subcategory
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <code className="text-sm bg-muted px-2 py-1 rounded">{category.slug}</code>
                    </TableCell>
                    <TableCell className="max-w-xs truncate">
                      {category.description || "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <div
                          className="w-6 h-6 rounded border"
                          style={{ backgroundColor: category.color }}
                        />
                        <span className="text-sm text-muted-foreground">{category.color}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end space-x-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          data-testid={`button-edit-category-${category.id}`}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          data-testid={`button-delete-category-${category.id}`}
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
        Showing {filteredCategories.length} of {categories.length} categories
      </div>
    </div>
  );
}
