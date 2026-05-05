import React from "react";
import { Search, Menu, Instagram, Facebook, Twitter } from "lucide-react";

// Gallery.je brand tokens
// Wordmark: "GALLERY" all-caps, wide-tracked, sans-serif
// Background: #f5f5f0 (warm off-white)
// Accent yellow: #fcde00 (used as section underline)
// Accent teal: #4ad0d3 (theme colour / category badges)
// Black: #0a0a0a  Grey: #6e6e6e  Divider: #d9d9d9

const BRAND = {
  bg: "#f5f5f0",
  white: "#ffffff",
  black: "#0a0a0a",
  yellow: "#fcde00",
  teal: "#4ad0d3",
  grey: "#6e6e6e",
  divider: "#d9d9d9",
  cardBg: "#ececea",
};

const NAV_ITEMS = ["Culture", "Community", "Appetite", "Places", "Events", "Fashion", "Agenda", "Active"];

function SectionLabel({ children, color = BRAND.yellow }: { children: React.ReactNode; color?: string }) {
  return (
    <div style={{ fontFamily: "Arial, Helvetica, sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase" as const, color: BRAND.black }}>
      <span>{children}</span>
      <div style={{ width: "100%", height: 3, background: color, marginTop: 4 }} />
    </div>
  );
}

function ImagePlaceholder({ label, aspect = "3/2" }: { label: string; aspect?: string }) {
  return (
    <div style={{ background: BRAND.cardBg, aspectRatio: aspect, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <span style={{ fontFamily: "Arial, sans-serif", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase" as const, color: BRAND.grey }}>{label}</span>
    </div>
  );
}

function ArticleCard({ category, title, author, date }: { category: string; title: string; author: string; date: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column" as const, gap: 12 }}>
      <ImagePlaceholder label={category} />
      <div>
        <div style={{ fontFamily: "Arial, sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" as const, color: BRAND.teal, marginBottom: 6 }}>
          {category}
        </div>
        <h3 style={{ fontFamily: "Georgia, serif", fontSize: 19, fontWeight: 400, lineHeight: 1.35, letterSpacing: "-0.3px", margin: "0 0 8px", color: BRAND.black }}>
          {title}
        </h3>
        <div style={{ fontFamily: "Arial, sans-serif", fontSize: 12, color: BRAND.grey }}>
          By {author} — {date}
        </div>
      </div>
    </div>
  );
}

export function Homepage() {
  return (
    <div style={{ minHeight: "100vh", background: BRAND.bg, color: BRAND.black, fontFamily: "Georgia, serif" }}>

      {/* Top bar */}
      <div style={{ background: BRAND.white, borderBottom: `1px solid ${BRAND.divider}`, padding: "8px 24px" }}>
        <div style={{ maxWidth: 1296, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center", fontFamily: "Arial, sans-serif", fontSize: 12, color: BRAND.grey }}>
          <div>Tuesday, 6 May 2026</div>
          <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
            <Facebook size={13} />
            <Twitter size={13} />
            <Instagram size={13} />
          </div>
        </div>
      </div>

      {/* Masthead */}
      <div style={{ background: BRAND.white, borderBottom: `1px solid ${BRAND.divider}`, padding: "20px 24px 0" }}>
        <div style={{ maxWidth: 1296, margin: "0 auto" }}>
          {/* Top row: hamburger | wordmark | search */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <button style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}>
              <Menu size={22} color={BRAND.black} />
            </button>

            {/* GALLERY wordmark — wide-tracked all-caps sans-serif, centred */}
            <div style={{ fontFamily: "Arial, Helvetica, sans-serif", fontSize: 28, fontWeight: 700, letterSpacing: "0.35em", textTransform: "uppercase" as const, color: BRAND.black }}>
              Gallery
            </div>

            <button style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center", gap: 6, fontFamily: "Arial, sans-serif", fontSize: 13, color: BRAND.black }}>
              Search <Search size={16} />
            </button>
          </div>

          {/* Category nav */}
          <nav style={{ display: "flex", justifyContent: "center", gap: 32, paddingBottom: 0 }}>
            {NAV_ITEMS.map((item) => (
              <a
                key={item}
                href="#"
                style={{
                  fontFamily: "Arial, sans-serif",
                  fontSize: 13,
                  fontWeight: 400,
                  color: BRAND.black,
                  textDecoration: "none",
                  paddingBottom: 12,
                  borderBottom: item === "Culture" ? `3px solid ${BRAND.teal}` : "3px solid transparent",
                }}
              >
                {item}
              </a>
            ))}
          </nav>
        </div>
      </div>

      {/* Main content */}
      <div style={{ maxWidth: 1296, margin: "0 auto", padding: "0 24px" }}>

        {/* Hero */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 40, padding: "40px 0 32px" }}>
          {/* Left: text */}
          <div style={{ display: "flex", flexDirection: "column" as const, justifyContent: "center" }}>
            <div style={{ fontFamily: "Arial, sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase" as const, color: BRAND.teal, marginBottom: 16 }}>
              Feature
            </div>
            <h1 style={{ fontFamily: "Georgia, serif", fontSize: 38, fontWeight: 400, lineHeight: 1.2, letterSpacing: "-0.5px", margin: "0 0 18px", color: BRAND.black }}>
              The Quiet Revolution in Jersey's Coastal Architecture
            </h1>
            <p style={{ fontFamily: "Georgia, serif", fontSize: 16, lineHeight: 1.6, color: BRAND.black, margin: "0 0 20px" }}>
              From restored tidal pools to brutalist concrete homes that weather the Atlantic storms, a new generation of architects is rethinking what it means to build on the edge of the world.
            </p>
            <div style={{ fontFamily: "Arial, sans-serif", fontSize: 12, color: BRAND.grey }}>By Sarah Mitchell — 4 May 2026</div>
          </div>

          {/* Right: image */}
          <ImagePlaceholder label="Cover Story" aspect="4/5" />
        </div>

        <hr style={{ border: "none", borderTop: `1px solid ${BRAND.divider}`, margin: 0 }} />

        {/* Latest Stories */}
        <div style={{ padding: "36px 0" }}>
          <div style={{ marginBottom: 28 }}>
            <SectionLabel>Latest Stories</SectionLabel>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 32 }}>
            <ArticleCard category="Culture" title="The Return of the Long Lunch" author="Tom Edwards" date="3 May 2026" />
            <ArticleCard category="Fashion" title="Autumn Essentials: The Heavy Wool Overcoat" author="Elena Rossi" date="2 May 2026" />
            <ArticleCard category="Community" title="A Conversation with Ceramist David Hock" author="Marcus Chen" date="1 May 2026" />
          </div>
        </div>

        <hr style={{ border: "none", borderTop: `1px solid ${BRAND.divider}`, margin: 0 }} />

        {/* Events strip */}
        <div style={{ padding: "36px 0" }}>
          <div style={{ marginBottom: 28 }}>
            <SectionLabel color={BRAND.teal}>Events</SectionLabel>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 32 }}>
            <ArticleCard category="Events" title="Jersey Arts Centre: Summer Exhibition Preview" author="Gallery" date="10 May 2026" />
            <ArticleCard category="Events" title="Farm-to-Table Supper at St Ouen's Manor" author="Gallery" date="15 May 2026" />
            <ArticleCard category="Events" title="Sunrise Swim Series Returns to Grève de Lecq" author="Gallery" date="20 May 2026" />
          </div>
        </div>
      </div>

      {/* Latest Issue band */}
      <div style={{ background: BRAND.white, borderTop: `1px solid ${BRAND.divider}`, borderBottom: `1px solid ${BRAND.divider}`, padding: "48px 24px" }}>
        <div style={{ maxWidth: 1296, margin: "0 auto", display: "grid", gridTemplateColumns: "2fr 1fr", gap: 64, alignItems: "center" }}>
          <div>
            <div style={{ marginBottom: 24 }}>
              <SectionLabel>Latest Issue</SectionLabel>
            </div>
            <h2 style={{ fontFamily: "Georgia, serif", fontSize: 32, fontWeight: 400, lineHeight: 1.2, letterSpacing: "-0.5px", margin: "0 0 16px", color: BRAND.black }}>
              Edito: Gallery 207
            </h2>
            <p style={{ fontFamily: "Georgia, serif", fontSize: 16, lineHeight: 1.6, color: BRAND.grey, margin: "0 0 24px" }}>
              This is my first time writing this, which probably explains why I've left it… Welcome to a new chapter for Gallery magazine.
            </p>
            <button style={{ background: BRAND.black, color: BRAND.white, border: "none", padding: "12px 28px", fontFamily: "Arial, sans-serif", fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" as const, cursor: "pointer", borderRadius: 0 }}>
              Read Now
            </button>
          </div>
          <ImagePlaceholder label="Issue 207" aspect="3/4" />
        </div>
      </div>

      {/* Footer */}
      <div style={{ background: BRAND.white, borderTop: `3px solid ${BRAND.black}`, padding: "40px 24px" }}>
        <div style={{ maxWidth: 1296, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontFamily: "Arial, Helvetica, sans-serif", fontSize: 20, fontWeight: 700, letterSpacing: "0.25em", textTransform: "uppercase" as const }}>Gallery</div>
          <div style={{ display: "flex", gap: 28, fontFamily: "Arial, sans-serif", fontSize: 12, color: BRAND.grey }}>
            {["About Us", "Advertise", "Contact", "Privacy Policy"].map(l => (
              <a key={l} href="#" style={{ color: BRAND.grey, textDecoration: "none" }}>{l}</a>
            ))}
          </div>
          <div style={{ fontFamily: "Arial, sans-serif", fontSize: 12, color: BRAND.grey }}>© 2026 Gallery Magazine. All rights reserved.</div>
        </div>
      </div>

    </div>
  );
}
