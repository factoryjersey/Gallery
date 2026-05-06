import { useState, useRef, useEffect } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronDown, ImageOff, Image } from "lucide-react";
import type { Category } from "@shared/schema";

const PRIMARY_SLUGS = ["people", "fashion", "appetite-1", "culture", "travel-1", "interiors", "business"];

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
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  const topLevel = categories.filter((c) => !(c as any).parentId);

  const primaryCats = PRIMARY_SLUGS
    .map(slug => topLevel.find((c) => (c as any).slug === slug))
    .filter(Boolean) as Category[];
  const secondaryCats = topLevel
    .filter(c => !PRIMARY_SLUGS.includes((c as any).slug))
    .sort((a, b) => a.name.localeCompare(b.name));

  const isSecondarySelected = secondaryCats.some(c => c.id === selectedCategory);
  const selectedSecondaryName = secondaryCats.find(c => c.id === selectedCategory)?.name;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setIsMoreOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const tabClass = (active: boolean) =>
    `shrink-0 py-4 px-4 border-b-[3px] transition-colors whitespace-nowrap cursor-pointer ${
      active
        ? "border-secondary text-foreground font-semibold"
        : "border-transparent text-muted-foreground hover:text-foreground"
    }`;

  return (
    <section className="bg-white border-b border-border">
      <div className="max-w-[1296px] mx-auto px-6">
        <div className="flex items-center justify-between gap-4">

          {/* Category tabs */}
          <div className="flex items-center gap-0 flex-nowrap min-w-0 overflow-x-auto"
            style={{ fontFamily: "Arial, Helvetica, sans-serif", fontSize: 13 }}>

            <button
              className={tabClass(selectedCategory === "")}
              onClick={() => onSelectCategory("")}
              data-testid="category-filter-all"
            >
              All
            </button>

            {primaryCats.map((category) => (
              <button
                key={category.id}
                className={tabClass(selectedCategory === category.id)}
                onClick={() => onSelectCategory(category.id)}
                data-testid={`category-filter-${(category as any).slug}`}
              >
                {category.name}
              </button>
            ))}

            {/* More dropdown */}
            {secondaryCats.length > 0 && (
              <div className="relative shrink-0" ref={moreRef}>
                <button
                  onClick={() => setIsMoreOpen(!isMoreOpen)}
                  className={tabClass(isSecondarySelected)}
                  data-testid="category-filter-more"
                >
                  {isSecondarySelected ? selectedSecondaryName : "More"}
                  <ChevronDown className={`inline w-3 h-3 ml-1 transition-transform ${isMoreOpen ? "rotate-180" : ""}`} />
                </button>
                {isMoreOpen && (
                  <div className="absolute top-full left-0 bg-white border border-border shadow-lg z-50 min-w-[190px] py-2"
                    data-testid="category-filter-more-dropdown">
                    {secondaryCats.map((category) => (
                      <button
                        key={category.id}
                        className={`block w-full text-left px-5 py-2.5 transition-colors whitespace-nowrap ${
                          selectedCategory === category.id
                            ? "text-secondary font-semibold bg-[hsl(0,0%,97%)]"
                            : "text-foreground hover:text-secondary hover:bg-[hsl(0,0%,97%)]"
                        }`}
                        style={{ fontFamily: "Arial, Helvetica, sans-serif", fontSize: 13 }}
                        onClick={() => { onSelectCategory(category.id); setIsMoreOpen(false); }}
                        data-testid={`category-filter-${(category as any).slug}`}
                      >
                        {category.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right controls */}
          <div className="flex items-center gap-3 shrink-0">
            {/* Images toggle */}
            {onToggleWithImage && (
              <button
                onClick={onToggleWithImage}
                className="flex items-center gap-1.5 py-1.5 px-3 border border-border hover:border-foreground transition-colors"
                style={{ fontFamily: "Arial, sans-serif", fontSize: 12, color: withImage ? "hsl(0 0% 10%)" : "hsl(0 0% 55%)" }}
                title={withImage ? "Showing articles with images only — click to show all" : "Click to show only articles with images"}
                data-testid="toggle-with-image"
              >
                {withImage ? <Image className="w-3.5 h-3.5" /> : <ImageOff className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline">{withImage ? "With images" : "All articles"}</span>
              </button>
            )}

            {/* Year filter */}
            {onSelectYear && availableYears.length > 0 && (
              <Select value={selectedYear} onValueChange={onSelectYear}>
                <SelectTrigger
                  className="w-[110px] border-0 border-b border-border rounded-none text-muted-foreground text-sm focus:ring-0"
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
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
