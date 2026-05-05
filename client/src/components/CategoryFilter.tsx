import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  availableYears = [],
}: CategoryFilterProps) {
  const topLevel = categories.filter((c) => !(c as any).parentId);

  return (
    <section className="bg-white border-b border-border">
      <div className="max-w-[1296px] mx-auto px-6">
        <div className="flex items-center justify-between gap-4 overflow-x-auto">

          {/* Category tabs */}
          <div className="flex items-center gap-0 flex-nowrap min-w-0"
            style={{ fontFamily: "Arial, Helvetica, sans-serif", fontSize: 13 }}>

            <button
              className={`shrink-0 py-4 px-4 border-b-[3px] transition-colors whitespace-nowrap ${
                selectedCategory === ""
                  ? "border-secondary text-foreground font-semibold"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => onSelectCategory("")}
              data-testid="category-filter-all"
            >
              All Stories
            </button>

            {topLevel.map((category) => (
              <button
                key={category.id}
                className={`shrink-0 py-4 px-4 border-b-[3px] transition-colors whitespace-nowrap ${
                  selectedCategory === category.id
                    ? "border-secondary text-foreground font-semibold"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => onSelectCategory(category.id)}
                data-testid={`category-filter-${category.slug}`}
              >
                {category.name}
              </button>
            ))}
          </div>

          {/* Year filter */}
          {onSelectYear && availableYears.length > 0 && (
            <div className="shrink-0">
              <Select value={selectedYear} onValueChange={onSelectYear}>
                <SelectTrigger
                  className="w-[120px] border-0 border-b border-border rounded-none text-muted-foreground text-sm focus:ring-0"
                  data-testid="select-frontend-year-filter"
                >
                  <SelectValue placeholder="All Years" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Years</SelectItem>
                  {availableYears.map((year) => (
                    <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
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
