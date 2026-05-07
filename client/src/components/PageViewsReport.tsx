import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Eye, TrendingUp, FileText, Users, BarChart2, ExternalLink } from "lucide-react";

interface Summary {
  article_count: number;
  total_views: number;
  avg_views: number;
  max_views: number;
}

interface TopArticle {
  id: string;
  title: string;
  slug: string;
  views: number;
  published_at: string;
  status: string;
  category_name: string;
  category_id: string;
  author_name: string;
}

interface CategoryStat {
  id: string;
  name: string;
  article_count: number;
  total_views: number;
}

interface AuthorStat {
  id: string;
  name: string;
  article_count: number;
  total_views: number;
}

const PERIODS = [
  { label: "All time",    value: "all" },
  { label: "Last 7 days", value: "7" },
  { label: "Last 30 days",value: "30" },
  { label: "Last 90 days",value: "90" },
];

function BarRow({
  label,
  value,
  max,
  sub,
}: {
  label: string;
  value: number;
  max: number;
  sub?: string;
}) {
  const pct = max > 0 ? Math.max(2, (value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3 py-2" data-testid={`bar-row-${label}`}>
      <div className="w-36 shrink-0 text-sm font-medium truncate" title={label}>
        {label}
      </div>
      <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
        <div
          className="h-2 bg-primary rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="w-20 text-right shrink-0">
        <span className="text-sm font-semibold">{value.toLocaleString()}</span>
        {sub && <span className="text-xs text-muted-foreground block">{sub}</span>}
      </div>
    </div>
  );
}

export function PageViewsReport() {
  const [period, setPeriod] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");

  const { data, isLoading, refetch } = useQuery<{
    summary: Summary;
    topArticles: TopArticle[];
    byCategory: CategoryStat[];
    byAuthor: AuthorStat[];
  }>({
    queryKey: ["/api/analytics/page-views", period, categoryFilter],
    queryFn: async () => {
      const params = new URLSearchParams({ period, limit: "50" });
      if (categoryFilter !== "all") params.set("categoryId", categoryFilter);
      const res = await fetch(`/api/analytics/page-views?${params}`);
      if (!res.ok) throw new Error("Failed to fetch analytics");
      return res.json();
    },
  });

  const { data: categoriesData } = useQuery<{ categories: { id: string; name: string }[] }>({
    queryKey: ["/api/categories"],
  });

  const summary   = data?.summary;
  const articles  = data?.topArticles  ?? [];
  const byCategory= data?.byCategory   ?? [];
  const byAuthor  = data?.byAuthor     ?? [];
  const maxCatViews  = byCategory[0]?.total_views  ?? 1;
  const maxAuthViews = byAuthor[0]?.total_views    ?? 1;
  const maxArticleViews = articles[0]?.views       ?? 1;

  return (
    <div className="space-y-6" data-testid="page-views-report">
      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold font-serif">Page Views Report</h2>
        <div className="flex items-center gap-2">
          <Select value={period} onValueChange={setPeriod} data-testid="select-period">
            <SelectTrigger className="w-36" data-testid="trigger-period">
              <SelectValue placeholder="Period" />
            </SelectTrigger>
            <SelectContent>
              {PERIODS.map(p => (
                <SelectItem key={p.value} value={p.value} data-testid={`period-${p.value}`}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={categoryFilter} onValueChange={setCategoryFilter} data-testid="select-category">
            <SelectTrigger className="w-44" data-testid="trigger-category">
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {categoriesData?.categories?.map(c => (
                <SelectItem key={c.id} value={c.id} data-testid={`cat-${c.id}`}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => refetch()} data-testid="button-refresh">
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card data-testid="card-total-views">
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Views</p>
                <p className="text-2xl font-bold mt-1">
                  {isLoading ? "—" : (summary?.total_views ?? 0).toLocaleString()}
                </p>
              </div>
              <Eye className="h-7 w-7 text-primary/50" />
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-articles-with-views">
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Articles Viewed</p>
                <p className="text-2xl font-bold mt-1">
                  {isLoading ? "—" : (summary?.article_count ?? 0).toLocaleString()}
                </p>
              </div>
              <FileText className="h-7 w-7 text-primary/50" />
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-avg-views">
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Avg per Article</p>
                <p className="text-2xl font-bold mt-1">
                  {isLoading ? "—" : Math.round(summary?.avg_views ?? 0).toLocaleString()}
                </p>
              </div>
              <TrendingUp className="h-7 w-7 text-primary/50" />
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-top-views">
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Most Viewed</p>
                <p className="text-2xl font-bold mt-1">
                  {isLoading ? "—" : (summary?.max_views ?? 0).toLocaleString()}
                </p>
              </div>
              <BarChart2 className="h-7 w-7 text-primary/50" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Top articles table */}
        <Card className="xl:col-span-2" data-testid="card-top-articles">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Top Articles by Views</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 text-center text-muted-foreground text-sm">Loading…</div>
            ) : articles.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground text-sm">No views recorded yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm" data-testid="table-top-articles">
                  <thead>
                    <tr className="border-b border-border bg-muted/40">
                      <th className="text-left px-4 py-2 font-medium text-muted-foreground">#</th>
                      <th className="text-left px-4 py-2 font-medium text-muted-foreground">Article</th>
                      <th className="text-left px-4 py-2 font-medium text-muted-foreground hidden md:table-cell">Category</th>
                      <th className="text-left px-4 py-2 font-medium text-muted-foreground hidden md:table-cell">Author</th>
                      <th className="text-right px-4 py-2 font-medium text-muted-foreground">Views</th>
                      <th className="px-2 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {articles.map((article, i) => {
                      const barPct = maxArticleViews > 0
                        ? Math.max(4, (article.views / maxArticleViews) * 100)
                        : 0;
                      return (
                        <tr
                          key={article.id}
                          className="border-b border-border/50 hover:bg-muted/30 transition-colors"
                          data-testid={`row-article-${article.id}`}
                        >
                          <td className="px-4 py-3 text-muted-foreground font-mono text-xs w-8">
                            {i + 1}
                          </td>
                          <td className="px-4 py-3 max-w-[220px]">
                            <div className="font-medium truncate leading-tight" title={article.title}>
                              {article.title}
                            </div>
                            <div className="mt-1 w-full bg-muted rounded-full h-1 overflow-hidden">
                              <div
                                className="h-1 bg-primary/60 rounded-full"
                                style={{ width: `${barPct}%` }}
                              />
                            </div>
                          </td>
                          <td className="px-4 py-3 hidden md:table-cell">
                            <Badge variant="outline" className="text-xs font-normal">
                              {article.category_name}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground hidden md:table-cell text-xs">
                            {article.author_name}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold tabular-nums">
                            {article.views.toLocaleString()}
                          </td>
                          <td className="px-2 py-3">
                            <a
                              href={`/article/${article.slug}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-muted-foreground hover:text-foreground"
                              data-testid={`link-article-${article.id}`}
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Side panels */}
        <div className="space-y-6">
          {/* By category */}
          <Card data-testid="card-by-category">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart2 className="h-4 w-4" />
                Views by Category
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center text-muted-foreground text-sm py-4">Loading…</div>
              ) : byCategory.length === 0 ? (
                <div className="text-center text-muted-foreground text-sm py-4">No data</div>
              ) : (
                <div className="divide-y divide-border/40">
                  {byCategory.map(cat => (
                    <BarRow
                      key={cat.id}
                      label={cat.name}
                      value={cat.total_views}
                      max={maxCatViews}
                      sub={`${cat.article_count} art.`}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* By author */}
          <Card data-testid="card-by-author">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4" />
                Views by Author
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center text-muted-foreground text-sm py-4">Loading…</div>
              ) : byAuthor.length === 0 ? (
                <div className="text-center text-muted-foreground text-sm py-4">No data</div>
              ) : (
                <div className="divide-y divide-border/40">
                  {byAuthor.map(au => (
                    <BarRow
                      key={au.id}
                      label={au.name}
                      value={au.total_views}
                      max={maxAuthViews}
                      sub={`${au.article_count} art.`}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
