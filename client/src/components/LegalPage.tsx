import { ReactNode } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

interface LegalPageProps {
  eyebrow: string;
  title: string;
  intro: string;
  children: ReactNode;
}

export default function LegalPage({ eyebrow, title, intro, children }: LegalPageProps) {
  return (
    <div className="min-h-screen bg-background">
      <Header />

      <header className="border-b border-border bg-white">
        <div className="max-w-[760px] mx-auto px-6 py-14">
          <div
            className="mb-3"
            style={{ fontFamily: "Arial, sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "hsl(182 55% 56%)" }}
          >
            {eyebrow}
          </div>
          <h1
            style={{ fontFamily: "Georgia, serif", fontSize: "clamp(30px, 5vw, 44px)", fontWeight: 400, letterSpacing: "-0.5px", color: "hsl(0 0% 4%)", lineHeight: 1.15, margin: 0 }}
          >
            {title}
          </h1>
          <p
            className="mt-5"
            style={{ fontFamily: "Georgia, serif", fontSize: 18, fontStyle: "italic", color: "hsl(0 0% 35%)", lineHeight: 1.6 }}
          >
            {intro}
          </p>
        </div>
      </header>

      <article className="max-w-[760px] mx-auto px-6 py-12 prose prose-lg max-w-none prose-headings:font-serif prose-headings:font-normal prose-headings:text-foreground prose-h2:text-2xl prose-h2:mt-12 prose-h2:mb-4 prose-h3:text-xl prose-p:text-foreground prose-p:leading-relaxed prose-p:font-serif prose-a:text-secondary prose-a:no-underline hover:prose-a:underline prose-ul:font-serif prose-li:text-foreground">
        {children}
        <hr className="my-12 border-border" />
        <p className="text-sm text-muted-foreground" style={{ fontFamily: "Arial, sans-serif" }}>
          Last updated: {new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}.
          Questions? Email <a href="mailto:hello@gallery.je">hello@gallery.je</a> and someone real will reply.
        </p>
      </article>

      <Footer />
    </div>
  );
}
