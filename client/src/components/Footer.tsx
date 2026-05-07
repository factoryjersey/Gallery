import { Input } from "@/components/ui/input";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";

export default function Footer() {
  const [email, setEmail] = useState("");
  const { toast } = useToast();

  const { data: categoriesData } = useQuery<{ categories: any[] }>({
    queryKey: ["/api/categories"],
  });

  const topCategories = (categoriesData?.categories || [])
    .filter((c: any) => !c.parentId)
    .slice(0, 6);

  const handleNewsletterSignup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    toast({ title: "Subscribed!", description: "Thanks — we'll be in touch." });
    setEmail("");
  };

  return (
    <footer className="bg-white border-t-[3px] border-foreground">
      <div className="max-w-[1296px] mx-auto px-6 py-12">

        {/* Top: wordmark + tagline */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-8 border-b border-border">
          <Link href="/">
            <img
              src="/gallery-logo.png"
              alt="Gallery"
              className="cursor-pointer"
              style={{ height: 22, width: "auto" }}
              data-testid="footer-title"
            />
          </Link>
          <p style={{ fontFamily: "Georgia, serif", fontSize: 14, color: "hsl(0 0% 43%)", fontStyle: "italic" }}>
            Life &amp; style in Jersey.
          </p>
        </div>

        {/* Grid: links + newsletter */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 py-8 border-b border-border"
          style={{ fontFamily: "Arial, Helvetica, sans-serif", fontSize: 13 }}>

          {/* About */}
          <div>
            <h4 className="font-bold mb-4 uppercase tracking-widest text-xs text-foreground">About</h4>
            <ul className="space-y-2.5 text-muted-foreground">
              <li>
                <Link href="/about">
                  <span className="hover:text-foreground transition-colors cursor-pointer">About Us</span>
                </Link>
              </li>
              <li>
                <Link href="/archive">
                  <span className="hover:text-foreground transition-colors cursor-pointer">Back Issues</span>
                </Link>
              </li>
              <li>
                <Link href="/media-pack">
                  <span className="hover:text-foreground transition-colors cursor-pointer">Advertise</span>
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="font-bold mb-4 uppercase tracking-widest text-xs text-foreground">Legal</h4>
            <ul className="space-y-2.5 text-muted-foreground">
              {[["Privacy Policy", "#"], ["Terms of Service", "#"], ["Cookie Policy", "#"], ["Sitemap", "#"]].map(([label, href]) => (
                <li key={label}><a href={href} className="hover:text-foreground transition-colors">{label}</a></li>
              ))}
            </ul>
          </div>

          {/* Categories */}
          <div>
            <h4 className="font-bold mb-4 uppercase tracking-widest text-xs text-foreground">Sections</h4>
            <ul className="space-y-2.5 text-muted-foreground">
              {topCategories.map((cat: any) => (
                <li key={cat.id}>
                  <Link href={`/category/${cat.slug}`}>
                    <span className="hover:text-foreground transition-colors cursor-pointer">{cat.name}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Newsletter */}
          <div>
            <h4 className="font-bold mb-4 uppercase tracking-widest text-xs text-foreground">Newsletter</h4>
            <p className="text-muted-foreground mb-3" style={{ fontSize: 13, lineHeight: 1.5 }}>
              The best of Gallery, delivered now and again.
            </p>
            <form onSubmit={handleNewsletterSignup} className="space-y-2" data-testid="newsletter-form">
              <Input
                type="email"
                placeholder="Your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="rounded-none border-border"
                required
                data-testid="newsletter-email"
              />
              <button
                type="submit"
                className="w-full py-2.5 bg-foreground text-white hover:bg-secondary hover:text-foreground transition-colors"
                style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}
                data-testid="newsletter-submit"
              >
                Subscribe
              </button>
            </form>
          </div>
        </div>

        {/* Bottom bar */}
        <div
          className="pt-6 flex flex-col md:flex-row justify-between items-center gap-3"
          style={{ fontFamily: "Arial, sans-serif", fontSize: 12, color: "hsl(0 0% 43%)" }}
        >
          <p data-testid="footer-copyright">© {new Date().getFullYear()} Gallery Magazine. All rights reserved.</p>
          <div className="flex gap-5">
            <a href="#" className="hover:text-foreground transition-colors" data-testid="footer-terms">Terms</a>
            <a href="#" className="hover:text-foreground transition-colors" data-testid="footer-cookies">Cookies</a>
            <a href="#" className="hover:text-foreground transition-colors" data-testid="footer-sitemap">Sitemap</a>
          </div>
        </div>

      </div>
    </footer>
  );
}
