import { useMemo, useRef, useEffect } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

type DirectoryAuthor = {
  id: string;
  name: string;
  slug: string | null;
  bio: string | null;
  photoUrl: string | null;
  avatar: string | null;
  defaultRole: string | null;
  articleCount: number;
  categoryNames: string[];
  recentArticle: { title: string; slug: string } | null;
};

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

export default function Authors() {
  const { data, isLoading } = useQuery<{ authors: DirectoryAuthor[] }>({
    queryKey: ["/api/authors/directory"],
  });

  const authors = data?.authors ?? [];

  // Group authors by first-letter for the A–Z jumper.
  const groups = useMemo(() => {
    const map = new Map<string, DirectoryAuthor[]>();
    for (const a of authors) {
      const ch = (a.name?.[0] || "#").toUpperCase();
      const key = /[A-Z]/.test(ch) ? ch : "#";
      const bucket = map.get(key) ?? [];
      bucket.push(a);
      map.set(key, bucket);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [authors]);

  const presentLetters = useMemo(() => new Set(groups.map(([l]) => l)), [groups]);

  // Smooth-scroll handling for the A–Z jumper so the letter heading
  // doesn't slide under the sticky header.
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const scrollTo = (letter: string) => {
    const el = sectionRefs.current[letter];
    if (!el) return;
    const y = el.getBoundingClientRect().top + window.scrollY - 96;
    window.scrollTo({ top: y, behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <section className="max-w-[1296px] mx-auto px-6 pt-12 pb-6">
        <div
          style={{ fontFamily: "Arial, sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "#888" }}
        >
          The People
        </div>
        <h1
          style={{ fontFamily: "Georgia, serif", fontSize: "clamp(28px, 5vw, 52px)", fontWeight: 400, letterSpacing: "-0.5px", margin: "8px 0 0" }}
        >
          Authors &amp; Contributors
        </h1>
        <p
          className="max-w-2xl"
          style={{ fontFamily: "Georgia, serif", fontSize: 17, color: "#555", lineHeight: 1.6, margin: "16px 0 0" }}
        >
          The writers, photographers and contributors who&apos;ve shaped Gallery&apos;s pages.
        </p>
      </section>

      {/* A–Z jumper */}
      <nav
        className="max-w-[1296px] mx-auto px-6 sticky top-0 z-10 bg-background/95 backdrop-blur border-b"
        style={{ paddingBlock: 10 }}
        aria-label="Jump to letter"
      >
        <div className="flex flex-wrap gap-1">
          {LETTERS.map((l) => {
            const present = presentLetters.has(l);
            return (
              <button
                key={l}
                disabled={!present}
                onClick={() => scrollTo(l)}
                className={present
                  ? "px-2 py-1 hover:bg-muted rounded cursor-pointer"
                  : "px-2 py-1 text-muted-foreground/40 cursor-default"}
                style={{ fontFamily: "Arial, sans-serif", fontSize: 12, fontWeight: 600, letterSpacing: "0.05em" }}
                aria-label={present ? `Jump to ${l}` : undefined}
                data-testid={`az-${l}`}
              >
                {l}
              </button>
            );
          })}
        </div>
      </nav>

      <section className="max-w-[1296px] mx-auto px-6 py-10">
        {isLoading && (
          <div className="text-muted-foreground" style={{ fontFamily: "Arial, sans-serif", fontSize: 14 }}>
            Loading…
          </div>
        )}

        {!isLoading && groups.length === 0 && (
          <div className="text-muted-foreground" style={{ fontFamily: "Arial, sans-serif", fontSize: 14 }}>
            No published authors yet.
          </div>
        )}

        {groups.map(([letter, list]) => (
          <div
            key={letter}
            ref={(el) => { sectionRefs.current[letter] = el; }}
            className="mb-10"
          >
            <h2
              className="border-b pb-2 mb-5"
              style={{ fontFamily: "Georgia, serif", fontSize: 28, fontWeight: 400 }}
            >
              {letter}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {list.map((a: DirectoryAuthor) => {
                const photo = a.photoUrl || a.avatar;
                const authorHref = a.slug ? `/author/${a.slug}` : "#";
                return (
                  <div
                    key={a.id}
                    className="flex gap-4 p-3 rounded hover:bg-muted/40 transition-colors"
                    data-testid={`author-${a.slug ?? a.id}`}
                  >
                    <Link href={authorHref}>
                      <a className="shrink-0" aria-label={a.name}>
                        {photo ? (
                          <img
                            src={photo}
                            alt={a.name}
                            className="h-16 w-16 rounded-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div
                            className="h-16 w-16 rounded-full flex items-center justify-center bg-muted"
                            style={{ fontFamily: "Georgia, serif", fontSize: 18, color: "#555" }}
                            aria-hidden
                          >
                            {initials(a.name)}
                          </div>
                        )}
                      </a>
                    </Link>
                    <div className="min-w-0">
                      <Link href={authorHref}>
                        <a
                          className="hover:underline block"
                          style={{ fontFamily: "Georgia, serif", fontSize: 19, fontWeight: 500 }}
                        >
                          {a.name}
                        </a>
                      </Link>
                      {a.defaultRole && (
                        <div
                          style={{ fontFamily: "Arial, sans-serif", fontSize: 11, color: "#888", textTransform: "uppercase", letterSpacing: "0.08em", marginTop: 2 }}
                        >
                          {a.defaultRole}
                        </div>
                      )}
                      {a.recentArticle && (
                        <Link href={`/article/${a.recentArticle.slug}`}>
                          <a
                            className="line-clamp-2 hover:underline block"
                            style={{ fontFamily: "Georgia, serif", fontSize: 14, fontStyle: "italic", color: "#555", marginTop: 4, lineHeight: 1.45 }}
                            data-testid={`author-${a.slug ?? a.id}-example`}
                          >
                            {a.recentArticle.title}
                          </a>
                        </Link>
                      )}
                      <div
                        style={{ fontFamily: "Arial, sans-serif", fontSize: 11, color: "#888", marginTop: 6 }}
                      >
                        {a.articleCount} {a.articleCount === 1 ? "article" : "articles"}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </section>

      <Footer />
    </div>
  );
}
