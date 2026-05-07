import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Download } from "lucide-react";

const editions2026 = [
  { number: 206, months: "Feb / Mar", theme: "Fresh", supplements: "Bridal Bible, Women in Business", editorial: "24 January", artwork: "31 January" },
  { number: 207, months: "Apr / May", theme: "Expression", supplements: "Events, Gradu8", editorial: "9 March", artwork: "14 March" },
  { number: 208, months: "Jun / Jul", theme: "Form", supplements: "ESG Focus, Agenda: Law", editorial: "8 May", artwork: "15 May" },
  { number: 209, months: "Aug / Sep", theme: "Evolve", supplements: "Home Renovation, Gradu8", editorial: "10 July", artwork: "17 July" },
  { number: 210, months: "Oct / Nov", theme: "Value", supplements: "Agenda: Wealth, Family Law", editorial: "11 September", artwork: "18 September" },
  { number: 211, months: "Dec / Jan", theme: "Clarity", supplements: "Gradu8, Gorgeous Gift Guide", editorial: "6 November", artwork: "13 November" },
];

const readerProfiles = [
  {
    title: "The Urban 20-Something",
    subtitle: "Our core readers for 20 years.",
    copy: "It was our profile when we began producing Gallery and continues to form the backbone of our targeting and content. Gallery acts as a reflection for this audience as they begin and grow through their careers, start to spend, get married and buy their first homes. This audience are progressive, experientially focused, upwardly mobile and desire new products and services. They care about provenance and supporting small businesses.",
  },
  {
    title: "The Middle-Age Rebel",
    subtitle: "Established and rebellious.",
    copy: "The core audience that grew up with Gallery are now in their 40s and have progressed in their careers and are more settled. They have families, are more financially secure and are building their forever homes. They're replacing matching and hatching with collecting key pieces and living for that stolen special night. We profile their businesses, feature their work and celebrate their achievements.",
  },
  {
    title: "The Quicksilvers",
    subtitle: "Staying relevant.",
    copy: "We've always been flattered that the more mature reader looks to connect with our vibrant approach. Whether it's spotting their children in our events section or grandchildren in the Paparazzi nightlife pages, this audience still strives to stay on the ball as they maintain their mature gardens and stay engaged in the arts. They want to stay versed with the latest restaurants and entertainment, and have time and money to spend.",
  },
];

const sections = [
  {
    title: "People",
    copy: "Profiles, interviews and features about the people of Jersey — from entrepreneurs and creatives to community figures and personalities making a difference.",
  },
  {
    title: "Fashion & Beauty",
    copy: "Jersey's best quality shoots, featuring local photographers, models, stylists and retailers — showcasing the island's fashion scene at its finest.",
  },
  {
    title: "Appetite",
    copy: "Food and drink coverage across the island — from restaurant openings and chef profiles to recipes and the best places to eat and drink in Jersey.",
  },
  {
    title: "Culture",
    copy: "Arts, music, theatre, film and the cultural heartbeat of the island. Gallery champions local creative talent and keeps readers connected to Jersey's cultural life.",
  },
  {
    title: "Travel",
    copy: "Inspiring travel content with a Jersey perspective — from weekend escapes to long-haul adventures — curated for readers with a taste for quality experiences.",
  },
  {
    title: "Interiors",
    copy: "Property, homes and interior design. We feature stunning local homes and profile the designers, architects and makers behind Jersey's most beautiful spaces.",
  },
  {
    title: "Business",
    copy: "Thought leadership, business profiles and sector news for Jersey's professional community — delivered with Gallery's signature approachable editorial voice.",
  },
  {
    title: "Events",
    copy: "Gallery is Jersey's gallery of the island. We cover corporate, charity and nightlife events across the island — the best photography of the people that make Jersey tick.",
  },
];

export default function MediaPack() {
  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* Hero */}
      <section className="bg-foreground text-white py-16 border-b border-border">
        <div className="max-w-[1296px] mx-auto px-6">
          <div className="max-w-[640px]">
            <div
              className="mb-4"
              style={{ fontFamily: "Arial, sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "hsl(182 55% 56%)" }}
            >
              Media Pack & Rate Card 2026
            </div>
            <h1
              className="mb-6"
              style={{ fontFamily: "Georgia, serif", fontSize: "clamp(32px, 5vw, 52px)", fontWeight: 400, lineHeight: 1.1, letterSpacing: "-0.5px" }}
            >
              Jersey's Life &amp; Style Magazine
            </h1>
            <p style={{ fontFamily: "Georgia, serif", fontSize: 18, lineHeight: 1.7, color: "hsl(0 0% 75%)", fontStyle: "italic" }}>
              20 years of reflecting on Jersey — the best way for quality brands to reach an engaged, discerning local audience.
            </p>
          </div>
          <div className="mt-10">
            <a
              href="/media-pack-2026.pdf"
              download
              className="inline-flex items-center gap-2 px-6 py-3 bg-white text-foreground hover:bg-secondary hover:text-foreground transition-colors"
              style={{ fontFamily: "Arial, sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}
              data-testid="button-download-media-pack"
            >
              <Download className="h-4 w-4" />
              Download Full Media Pack PDF
            </a>
          </div>
        </div>
      </section>

      {/* Intro */}
      <section className="py-16 bg-white border-b border-border">
        <div className="max-w-[1296px] mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-start">
            <div>
              <div
                className="mb-4"
                style={{ fontFamily: "Arial, sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "hsl(182 55% 56%)" }}
              >
                Why Gallery
              </div>
              <p style={{ fontFamily: "Georgia, serif", fontSize: "clamp(20px, 3vw, 28px)", fontWeight: 400, lineHeight: 1.4, color: "hsl(0 0% 4%)" }}>
                With the perfect mix of content focused on local lifestyle, culture and business, Gallery is the best way for quality brands to get consistent marketing messages across in quality periodical print.
              </p>
            </div>
            <div style={{ fontFamily: "Georgia, serif", fontSize: 17, lineHeight: 1.8, color: "hsl(0 0% 20%)" }}>
              <p className="mb-5">
                Focused on 'life and style' in Jersey, the intention is to communicate style beyond fashion and beauty, representing the unique local style of Jersey in all ways — through fashion, events, culture, property, interiors, retail and beyond, all with an editorial voice that is approachable and casual.
              </p>
              <p>
                The result is communication and advertising success for brands that choose us to communicate with potential clients. With pick-up and distribution beyond that of the usual business magazines, Gallery also provides greater cut-through for businesses looking to communicate a marketing message in a popular format.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 2026 Editions */}
      <section className="py-16 bg-background border-b border-border">
        <div className="max-w-[1296px] mx-auto px-6">
          <div className="mb-10">
            <div
              className="mb-3"
              style={{ fontFamily: "Arial, sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "hsl(182 55% 56%)" }}
            >
              Publication Schedule
            </div>
            <h2 style={{ fontFamily: "Georgia, serif", fontSize: "clamp(24px, 4vw, 36px)", fontWeight: 400, color: "hsl(0 0% 4%)" }}>
              2026 Editions
            </h2>
            <p className="mt-3" style={{ fontFamily: "Arial, sans-serif", fontSize: 13, color: "hsl(0 0% 43%)", lineHeight: 1.6 }}>
              Gallery is released on the first of the month with artwork cut-off as close as possible to our print deadline. Editorial to be supplied a week before. Each issue is themed — if you have content that fits, get in touch.
            </p>
          </div>

          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr style={{ borderBottom: "2px solid hsl(0 0% 4%)" }}>
                  {["Issue", "Edition", "Theme", "Features & Supplements", "Editorial Deadline", "Artwork Deadline"].map(h => (
                    <th
                      key={h}
                      className="pb-3 text-left"
                      style={{ fontFamily: "Arial, sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "hsl(0 0% 4%)", paddingRight: 24 }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {editions2026.map((ed, i) => (
                  <tr key={ed.number} style={{ borderBottom: "1px solid hsl(0 0% 90%)" }}>
                    <td className="py-4" style={{ fontFamily: "Arial, sans-serif", fontSize: 13, fontWeight: 700, color: "hsl(0 0% 4%)", paddingRight: 24 }}>
                      #{ed.number}
                    </td>
                    <td className="py-4" style={{ fontFamily: "Arial, sans-serif", fontSize: 13, color: "hsl(0 0% 20%)", paddingRight: 24, whiteSpace: "nowrap" }}>
                      {ed.months}
                    </td>
                    <td className="py-4" style={{ paddingRight: 24 }}>
                      <span
                        style={{ fontFamily: "Arial, sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "hsl(182 55% 56%)" }}
                      >
                        {ed.theme}
                      </span>
                    </td>
                    <td className="py-4" style={{ fontFamily: "Arial, sans-serif", fontSize: 12, color: "hsl(0 0% 40%)", paddingRight: 24 }}>
                      {ed.supplements}
                    </td>
                    <td className="py-4" style={{ fontFamily: "Arial, sans-serif", fontSize: 12, color: "hsl(0 0% 30%)", paddingRight: 24, whiteSpace: "nowrap" }}>
                      {ed.editorial}
                    </td>
                    <td className="py-4" style={{ fontFamily: "Arial, sans-serif", fontSize: 12, fontWeight: 600, color: "hsl(0 0% 4%)", whiteSpace: "nowrap" }}>
                      {ed.artwork}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-4">
            {editions2026.map(ed => (
              <div key={ed.number} className="border border-border p-5 bg-white">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <span style={{ fontFamily: "Arial, sans-serif", fontSize: 13, fontWeight: 700, color: "hsl(0 0% 4%)" }}>#{ed.number}</span>
                    <span style={{ fontFamily: "Arial, sans-serif", fontSize: 13, color: "hsl(0 0% 40%)", marginLeft: 8 }}>{ed.months}</span>
                  </div>
                  <span style={{ fontFamily: "Arial, sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "hsl(182 55% 56%)" }}>
                    {ed.theme}
                  </span>
                </div>
                <div style={{ fontFamily: "Arial, sans-serif", fontSize: 12, color: "hsl(0 0% 40%)", marginBottom: 8 }}>{ed.supplements}</div>
                <div className="flex gap-6">
                  <div>
                    <div style={{ fontFamily: "Arial, sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "hsl(0 0% 60%)", marginBottom: 2 }}>Editorial</div>
                    <div style={{ fontFamily: "Arial, sans-serif", fontSize: 12, color: "hsl(0 0% 20%)" }}>{ed.editorial}</div>
                  </div>
                  <div>
                    <div style={{ fontFamily: "Arial, sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "hsl(0 0% 60%)", marginBottom: 2 }}>Artwork</div>
                    <div style={{ fontFamily: "Arial, sans-serif", fontSize: 12, fontWeight: 600, color: "hsl(0 0% 4%)" }}>{ed.artwork}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Affordable Luxury */}
      <section className="py-16 bg-white border-b border-border">
        <div className="max-w-[720px] mx-auto px-6 text-center">
          <div
            className="mb-6"
            style={{ fontFamily: "Arial, sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "hsl(182 55% 56%)" }}
          >
            Affordable Luxury
          </div>
          <p style={{ fontFamily: "Georgia, serif", fontSize: "clamp(17px, 2.5vw, 21px)", lineHeight: 1.75, color: "hsl(0 0% 15%)", fontStyle: "italic" }}>
            Our focus is creating a magazine that is more stylish and better produced than other regular Jersey media options, projecting quality without being elitist. Our mission is to provide engaging content for culture vultures, fashionistas, gadget freaks, petrolheads, style icons, and business movers and shakers alike — upwardly-mobile readers of all income brackets. Your advertising in Gallery therefore not only looks its best, but also offers market-leading value.
          </p>
        </div>
      </section>

      {/* Readership stats */}
      <section className="py-16 bg-foreground text-white border-b border-border">
        <div className="max-w-[1296px] mx-auto px-6">
          <div className="mb-10 text-center">
            <div
              className="mb-3"
              style={{ fontFamily: "Arial, sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "hsl(182 55% 56%)" }}
            >
              Who Reads Gallery
            </div>
            <h2 style={{ fontFamily: "Georgia, serif", fontSize: "clamp(24px, 4vw, 36px)", fontWeight: 400 }}>
              Forward-thinking ABC1 readership. Ages 18 to 80.
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {readerProfiles.map(p => (
              <div key={p.title} className="border border-white/20 p-8">
                <h3
                  className="mb-1"
                  style={{ fontFamily: "Georgia, serif", fontSize: 20, fontWeight: 400, color: "white" }}
                >
                  {p.title}
                </h3>
                <p
                  className="mb-4"
                  style={{ fontFamily: "Arial, sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "hsl(182 55% 56%)" }}
                >
                  {p.subtitle}
                </p>
                <p style={{ fontFamily: "Georgia, serif", fontSize: 15, lineHeight: 1.75, color: "hsl(0 0% 75%)" }}>
                  {p.copy}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Distribution */}
      <section className="py-16 bg-background border-b border-border">
        <div className="max-w-[1296px] mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div>
              <div
                className="mb-4"
                style={{ fontFamily: "Arial, sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "hsl(182 55% 56%)" }}
              >
                Distribution
              </div>
              <h2
                className="mb-5"
                style={{ fontFamily: "Georgia, serif", fontSize: "clamp(24px, 4vw, 36px)", fontWeight: 400, color: "hsl(0 0% 4%)" }}
              >
                We get everywhere.
              </h2>
              <p style={{ fontFamily: "Georgia, serif", fontSize: 17, lineHeight: 1.8, color: "hsl(0 0% 20%)" }}>
                We have the widest distribution network of any lifestyle print media in Jersey. We utilise both our own Factory-owned distribution service, Distro, and also Jersey Post's network, ensuring our titles are read far and wide across our fair isle. We produce 6,000 copies per edition and reach an audience of 21,000 ABC1 readers.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-4">
              {[
                { label: "6,000", sub: "Copies per edition" },
                { label: "21,000", sub: "ABC1 readers reached" },
              ].map(stat => (
                <div key={stat.label} className="bg-white border border-border p-6 flex items-center gap-6">
                  <span style={{ fontFamily: "Georgia, serif", fontSize: 42, fontWeight: 400, color: "hsl(0 0% 4%)", lineHeight: 1 }}>{stat.label}</span>
                  <span style={{ fontFamily: "Arial, sans-serif", fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "hsl(0 0% 50%)" }}>{stat.sub}</span>
                </div>
              ))}
              {[
                "Exclusive island-wide stand network",
                "Direct selected business drops",
                "Hotel & hospitality tourist distribution",
              ].map(item => (
                <div key={item} className="bg-white border border-border p-4 flex items-center gap-3">
                  <div className="w-2 h-2 bg-secondary flex-shrink-0" />
                  <span style={{ fontFamily: "Arial, sans-serif", fontSize: 13, color: "hsl(0 0% 20%)" }}>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Sections */}
      <section className="py-16 bg-white border-b border-border">
        <div className="max-w-[1296px] mx-auto px-6">
          <div className="mb-10">
            <div
              className="mb-3"
              style={{ fontFamily: "Arial, sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "hsl(182 55% 56%)" }}
            >
              Content
            </div>
            <h2 style={{ fontFamily: "Georgia, serif", fontSize: "clamp(24px, 4vw, 36px)", fontWeight: 400, color: "hsl(0 0% 4%)" }}>
              Our sections
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-0 border-t border-l border-border">
            {sections.map(s => (
              <div key={s.title} className="border-b border-r border-border p-6">
                <h3
                  className="mb-3"
                  style={{ fontFamily: "Arial, sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "hsl(0 0% 4%)" }}
                >
                  {s.title}
                </h3>
                <p style={{ fontFamily: "Georgia, serif", fontSize: 14, lineHeight: 1.7, color: "hsl(0 0% 40%)" }}>
                  {s.copy}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-background">
        <div className="max-w-[720px] mx-auto px-6 text-center">
          <div
            className="mb-4"
            style={{ fontFamily: "Arial, sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "hsl(182 55% 56%)" }}
          >
            Advertise with us
          </div>
          <h2
            className="mb-6"
            style={{ fontFamily: "Georgia, serif", fontSize: "clamp(24px, 4vw, 36px)", fontWeight: 400, color: "hsl(0 0% 4%)" }}
          >
            Ready to reach Jersey's most engaged readers?
          </h2>
          <p
            className="mb-8"
            style={{ fontFamily: "Georgia, serif", fontSize: 17, lineHeight: 1.75, color: "hsl(0 0% 40%)", fontStyle: "italic" }}
          >
            Download the full media pack for rate cards, ad specifications, and detailed readership data, or get in touch to discuss a campaign.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="/media-pack-2026.pdf"
              download
              className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-foreground text-white hover:bg-secondary hover:text-foreground transition-colors"
              style={{ fontFamily: "Arial, sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}
              data-testid="button-download-media-pack-cta"
            >
              <Download className="h-4 w-4" />
              Download Media Pack
            </a>
            <a
              href="mailto:advertising@gallery.je"
              className="inline-flex items-center justify-center px-8 py-4 border border-foreground text-foreground hover:bg-foreground hover:text-white transition-colors"
              style={{ fontFamily: "Arial, sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}
              data-testid="link-contact-advertising"
            >
              Get in Touch
            </a>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
