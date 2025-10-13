import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "lucide-react";
import type { Category } from "@shared/schema";

interface CategoryFilterProps {
  categories: Category[];
  selectedCategory: string;
  onSelectCategory: (categoryId: string) => void;
  selectedYear?: string;
  onSelectYear?: (year: string) => void;
  availableYears?: number[];
}

export default function CategoryFilter({ 
  categories, 
  selectedCategory, 
  onSelectCategory,
  selectedYear = "all",
  onSelectYear,
  availableYears = []
}: CategoryFilterProps) {
  return (
    <section className="bg-muted py-6 border-y border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4">
          {/* Category Filter */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <h3 className="text-lg font-semibold text-foreground">Browse by Category</h3>
            <div className="flex flex-wrap gap-2 justify-center md:justify-end">
              <Button
                variant={selectedCategory === "" ? "default" : "outline"}
                size="sm"
                className="category-tag"
                onClick={() => onSelectCategory("")}
                data-testid="category-filter-all"
              >
                All Stories
              </Button>
              {categories.map((category) => (
                <Button
                  key={category.id}
                  variant={selectedCategory === category.id ? "default" : "outline"}
                  size="sm"
                  className="category-tag"
                  onClick={() => onSelectCategory(category.id)}
                  data-testid={`category-filter-${category.slug}`}
                >
                  {category.name}
                </Button>
              ))}
            </div>
          </div>

          {/* Year Filter */}
          {onSelectYear && availableYears.length > 0 && (
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 pt-2 border-t border-border">
              <h3 className="text-lg font-semibold text-foreground">Filter by Year</h3>
              <Select value={selectedYear} onValueChange={onSelectYear}>
                <SelectTrigger className="w-[180px]" data-testid="select-frontend-year-filter">
                  <Calendar className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="All Years" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Years</SelectItem>
                  {availableYears.map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
