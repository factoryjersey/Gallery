import { Button } from "@/components/ui/button";
import type { Category } from "@shared/schema";

interface CategoryFilterProps {
  categories: Category[];
  selectedCategory: string;
  onSelectCategory: (categoryId: string) => void;
}

export default function CategoryFilter({ categories, selectedCategory, onSelectCategory }: CategoryFilterProps) {
  return (
    <section className="bg-muted py-6 border-y border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
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
      </div>
    </section>
  );
}
