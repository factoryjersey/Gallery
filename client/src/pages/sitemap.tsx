import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

type SitemapData = {
  staticPages: { path: string; label: string }[];
  categories: { slug: string; name: string }[];
  articles: { slug: string; title: string; updatedAt: string }[];
  issues: { number: number; displayLabel: string | null; publishedAt: string | null }[];
};

export default function Sitemap() {
  const { data, isLoading } = useQuery<SitemapData>({ queryKey: ["/api/sitemap"] });

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <header className="border-b border-border bg-white">
        <div className="max-w-[1100px] mx-auto px-6 py-14">
          <div
            className="mb-3"
            style={{ fontFamily: "Arial, sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "hsl(182 55% 56%)" }}
          >
            Find your way around
          </div>
          <h1
            style={{ fontFamily: "Georgia, serif", fontSize: "clamp(30px, 5vw, 44px)", fontWeight: 400, letterSpacing: "-0.5px", color: "hsl(0 0% 4%)", lineHeight: 1.15, margin: 0 }}
          >
            Sitemap
          </h1>
          <p
            className="mt-5"
            style={{ fontFamily: "Georgia, serif", fontSize: 17, color: "hsl(0 0% 43%)", lineHeight: 1.6 }}
          >
            Every public page on gallery.je in one place. Search engines might prefer{" "}
            <a href="/sitemap.xml" className="underline">/sitemap.xml</a>.
          </p>
        </div>
      </header>

      <main className="max-w-[1100px] mx-auto px-6 py-12 space-y-12">
        {isLoading && <p className="text-muted-foreground">Loading…</p>}

        {data && (
          <>
            <section>
              <h2 style={{ fontFamily: "Georgia, serif", fontSize: 24, fontWeight: 400, marginBottom: 16, color: "hsl(0 0% 4%)" }}>
                Pages
              </h2>
              <ul className="grid sm:grid-cols-2 md:grid-cols-3 gap-2" style={{ fontFamily: "Arial, sans-serif", fontSize: 14 }}>
                {data.staticPages.map((p) => (
                  <li key={p.path}>
                    <Link href={p.path}>
                      <span className="text-foreground hover:text-secondary cursor-pointer">{p.label}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>

            <section>
              <h2 style={{ fontFamily: "Georgia, serif", fontSize: 24, fontWeight: 400, marginBottom: 16, color: "hsl(0 0% 4%)" }}>
                Sections ({data.categories.length})
              </h2>
              <ul className="grid sm:grid-cols-2 md:grid-cols-3 gap-2" style={{ fontFamily: "Arial, sans-serif", fontSize: 14 }}>
                {data.categories.map((c) => (
                  <li key={c.slug}>
                    <Link href={`/category/${c.slug}`}>
                      <span className="text-foreground hover:text-secondary cursor-pointer">{c.name}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>

            <section>
              <h2 style={{ fontFamily: "Georgia, serif", fontSize: 24, fontWeight: 400, marginBottom: 16, color: "hsl(0 0% 4%)" }}>
                Issues ({data.issues.length})
              </h2>
              <ul className="grid sm:grid-cols-3 md:grid-cols-5 gap-2" style={{ fontFamily: "Arial, sans-serif", fontSize: 13 }}>
                {data.issues.map((i) => (
                  <li key={i.number}>
                    <Link href={`/current-issue?issue=${i.number}`}>
                      <span className="text-foreground hover:text-secondary cursor-pointer">
                        #{i.number}
                        {i.displayLabel ? (
                          <span className="text-muted-foreground"> · {i.displayLabel}</span>
                        ) : null}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>

            <section>
              <h2 style={{ fontFamily: "Georgia, serif", fontSize: 24, fontWeight: 400, marginBottom: 16, color: "hsl(0 0% 4%)" }}>
                Articles ({data.articles.length})
              </h2>
              <p className="text-sm text-muted-foreground mb-4" style={{ fontFamily: "Arial, sans-serif" }}>
                Ordered by most recently updated.
              </p>
              <ul className="columns-1 sm:columns-2 md:columns-3 gap-6 space-y-1" style={{ fontFamily: "Arial, sans-serif", fontSize: 13 }}>
                {data.articles.map((a) => (
                  <li key={a.slug} className="break-inside-avoid">
                    <Link href={`/article/${a.slug}`}>
                      <span className="text-foreground hover:text-secondary cursor-pointer line-clamp-2">{a.title}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          </>
        )}
      </main>

      <Footer />
    </div>
  );
}
