import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ImageOff, Image } from "lucide-react";
import type { Category } from "@shared/schema";

interface CategoryFilterProps {
  categories: Category[];
  selectedCategory: string;
  onSelectCategory: (categoryId: string) => void;
  selectedYear?: string;
  onSelectYear?: (year: string) => void;
  availableYears?: number[];
  withImage?: boolean;
  onToggleWithImage?: () => void;
}

// A compact filter bar for the home grid. Replaces the old tab strip — the
// header already carries category navigation, so this bar is purely for
// refining the visible grid (category dropdown, year, images toggle).
export default function CategoryFilter({
  categories,
  selectedCategory,
  onSelectCategory,
  selectedYear = "all",
  onSelectYear,
  availableYears = [],
  withImage = true,
  onToggleWithImage,
}: CategoryFilterProps) {
  const topLevel = categories
    .filter((c) => !(c as any).parentId)
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <section className="bg-white border-b border-border">
      <div className="max-w-[1600px] mx-auto px-6 py-3 flex items-center gap-3 flex-wrap">
        <span
          style={{
            fontFamily: "Arial, Helvetica, sans-serif",
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "hsl(0 0% 55%)",
          }}
        >
          Filter
        </span>

        {/* Category dropdown */}
        <Select value={selectedCategory || "all"} onValueChange={(v) => onSelectCategory(v === "all" ? "" : v)}>
          <SelectTrigger
            className="w-[200px] h-9 border-border rounded-none text-sm"
            data-testid="category-filter-select"
          >
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {topLevel.map((c) => (
              <SelectItem key={c.id} value={c.id} data-testid={`category-filter-${(c as any).slug}`}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Year filter */}
        {onSelectYear && availableYears.length > 0 && (
          <Select value={selectedYear} onValueChange={onSelectYear}>
            <SelectTrigger
              className="w-[130px] h-9 border-border rounded-none text-sm"
              data-testid="select-frontend-year-filter"
            >
              <SelectValue placeholder="All years" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All years</SelectItem>
              {availableYears.map((year) => (
                <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <div className="flex-1" />

        {/* Images toggle */}
        {onToggleWithImage && (
          <button
            onClick={onToggleWithImage}
            className="flex items-center gap-1.5 py-1.5 px-3 border border-border hover:border-foreground transition-colors"
            style={{
              fontFamily: "Arial, sans-serif",
              fontSize: 12,
              color: withImage ? "hsl(0 0% 10%)" : "hsl(0 0% 55%)",
            }}
            title={withImage ? "Showing articles with images only — click to show all" : "Click to show only articles with images"}
            data-testid="toggle-with-image"
          >
            {withImage ? <Image className="w-3.5 h-3.5" /> : <ImageOff className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{withImage ? "With images" : "All articles"}</span>
          </button>
        )}
      </div>
    </section>
  );
}
