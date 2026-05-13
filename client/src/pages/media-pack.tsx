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
    key: "urban",
    image: "/media/reader-urban.jpg",
    superhead: "Forward-thinking ABC1 Readership",
    title: "The Urban 20-Something",
    subtitle: "Our core readers for 20 years.",
    copy: "It was our profile when we began producing Gallery and continues to form the backbone of our targeting and content. Gallery acts as a reflection for this audience as they begin and grow through their careers, start to spend, get married and buy their first homes. This audience are progressive, experientially focused, upwardly mobile and desire new products and services. They care about provenance and supporting small businesses.",
  },
  {
    key: "rebel",
    image: "/media/reader-rebel.jpg",
    superhead: "Readers from Eighteen to Eighty",
    title: "The Middle-Age Rebel",
    subtitle: "Established and rebellious.",
    copy: "The core audience that grew up with Gallery are now in their 40s and have progressed in their careers and are more settled. They have families, are more financially secure and are building their forever homes. They're replacing matching and hatching with collecting key pieces and living for that stolen special night. We profile their businesses, feature their work and celebrate their achievements.",
  },
  {
    key: "silver",
    image: "/media/reader-silver.jpg",
    superhead: "People who Appreciate Style & Substance",
    title: "The Quick Silvers",
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

const rateCard = [
  { ad: "Full Page", size: "210×297mm + 3mm bleed", single: 1350, two: 1215, four: 1080, annualDD: 945, annualPre: 878 },
  { ad: "Half Page", size: "Portrait 95×277mm / Landscape 190×137mm", single: 715, two: 644, four: 572, annualDD: 501, annualPre: 465 },
  { ad: "Quarter Page", size: "93×137mm", single: 375, two: 338, four: 300, annualDD: 263, annualPre: 244 },
  { ad: "Double Page Spread", size: "420×297mm + 3mm bleed", single: 1995, two: 1796, four: 1596, annualDD: 1397, annualPre: 1297 },
  { ad: "Inside Front Cover", size: "210×297mm + 3mm bleed", single: 1895, two: 1706, four: 1516, annualDD: 1327, annualPre: 1232 },
  { ad: "Inside Front DPS", size: "420×297mm + 3mm bleed", single: 1995, two: 1796, four: 1596, annualDD: 1397, annualPre: 1297 },
  { ad: "Inside Back", size: "210×297mm + 3mm bleed", single: 1595, two: 1436, four: 1276, annualDD: 1117, annualPre: 1037 },
  { ad: "Back Cover", size: "210×297mm + 3mm bleed", single: 2275, two: 2048, four: 1820, annualDD: 1593, annualPre: 1479 },
  { ad: "Page + Page*", size: "210×297mm + 3mm bleed / 500 words", single: 1350, two: 1215, four: 1080, annualDD: 945, annualPre: 878 },
  { ad: "Quarter + Quarter*", size: "93×137mm + 3mm bleed / 200 words", single: 525, two: 473, four: 420, annualDD: 368, annualPre: 341 },
  { ad: "Intro Banner", size: "60×190mm", single: 475, two: 428, four: 380, annualDD: 333, annualPre: 309 },
  { ad: "Solus Banner ROP", size: "60×190mm + 20% creative breakout", single: 475, two: 428, four: 380, annualDD: 333, annualPre: 309 },
  { ad: "Nightlife Banner DPS", size: "30×400mm", single: 340, two: 306, four: 272, annualDD: 238, annualPre: 221 },
  { ad: "Event Half Page*", size: "6 images and 100 word description", single: 275, two: null, four: null, annualDD: null, annualPre: null },
];

const fmt = (v: number | null) => v === null ? "—" : `£${v.toLocaleString()}`;

export default function MediaPack() {
  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* Hero banner — matches the /about page style */}
      <div
        className="w-full flex items-center justify-center text-center px-6"
        style={{
          minHeight: "clamp(320px, 45vw, 560px)",
          backgroundImage: "linear-gradient(rgba(80,30,120,0.55), rgba(80,30,120,0.55)), url('/media/gallery-collage.jpg')",
          backgroundSize: "cover",
          backgroundPosition: "center top",
          backgroundRepeat: "no-repeat",
        }}
      >
        <div className="flex flex-col items-center">
          <div
            className="mb-4"
            style={{ fontFamily: "Arial, sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "rgba(255,255,255,0.75)" }}
          >
            Media Pack &amp; Rate Card 2026
          </div>
          <h1
            style={{ fontFamily: "Georgia, serif", fontSize: "clamp(28px, 5vw, 52px)", fontWeight: 400, letterSpacing: "-0.5px", color: "#fff", margin: 0 }}
          >
            Jersey's Life &amp; Style Magazine
          </h1>
          <p
            className="max-w-xl"
            style={{ fontFamily: "Georgia, serif", fontSize: "clamp(14px, 1.8vw, 18px)", color: "rgba(255,255,255,0.85)", lineHeight: 1.6, margin: "20px auto 0" }}
          >
            20 years of reflecting on Jersey — the best way for quality brands to reach an engaged, discerning local audience.
          </p>
          <div className="mt-8">
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
      </div>

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
                {editions2026.map((ed) => (
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

          {/* Reader profile cards with illustrations */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-0 border border-white/10">
            {readerProfiles.map(p => (
              <div key={p.key} className="border-b md:border-b-0 md:border-r border-white/10 last:border-0 flex flex-col">
                {/* Superhead */}
                <div className="px-8 pt-8 pb-4">
                  <p
                    style={{ fontFamily: "Arial, sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "hsl(182 55% 56%)" }}
                  >
                    {p.superhead}
                  </p>
                </div>
                {/* Illustration */}
                <div className="bg-white mx-8 mb-0">
                  <img
                    src={p.image}
                    alt={p.title}
                    className="w-full object-contain"
                    style={{ maxHeight: 340 }}
                    data-testid={`img-reader-${p.key}`}
                  />
                </div>
                {/* Text */}
                <div className="px-8 py-6 flex flex-col flex-1">
                  <h3
                    className="mb-1"
                    style={{ fontFamily: "Arial, sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "white" }}
                  >
                    {p.title}
                  </h3>
                  <p
                    className="mb-4"
                    style={{ fontFamily: "Georgia, serif", fontSize: 16, fontWeight: 400, fontStyle: "italic", color: "hsl(182 55% 56%)" }}
                  >
                    {p.subtitle}
                  </p>
                  <p style={{ fontFamily: "Georgia, serif", fontSize: 14, lineHeight: 1.75, color: "hsl(0 0% 70%)" }}>
                    {p.copy}
                  </p>
                </div>
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

      {/* Rate Card */}
      <section className="py-16 bg-background border-b border-border">
        <div className="max-w-[1296px] mx-auto px-6">
          <div className="mb-10">
            <div
              className="mb-3"
              style={{ fontFamily: "Arial, sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "hsl(182 55% 56%)" }}
            >
              Advertising Rates
            </div>
            <h2 style={{ fontFamily: "Georgia, serif", fontSize: "clamp(24px, 4vw, 36px)", fontWeight: 400, color: "hsl(0 0% 4%)" }}>
              Standard Rate Card & Booking Discounts
            </h2>
            <p className="mt-3 max-w-[720px]" style={{ fontFamily: "Arial, sans-serif", fontSize: 13, color: "hsl(0 0% 43%)", lineHeight: 1.6 }}>
              Considering our print run and coverage, our rates offer strong value, particularly when booked as a campaign of multiple bookings. We avoid overprice/slash pricing and keep rates competitive and relevant to our reach and coverage. We're also able to offer editorial coverage to compliment clients' bookings. All prices subject to 5% GST.
            </p>
          </div>

          {/* Desktop rate card table */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full border-collapse" data-testid="table-rate-card">
              <thead>
                <tr style={{ borderBottom: "2px solid hsl(0 0% 4%)" }}>
                  <th className="pb-3 text-left" style={{ fontFamily: "Arial, sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "hsl(0 0% 4%)", paddingRight: 20, minWidth: 160 }}>
                    Advertisement
                  </th>
                  <th className="pb-3 text-left" style={{ fontFamily: "Arial, sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "hsl(0 0% 4%)", paddingRight: 20, minWidth: 200 }}>
                    Size
                  </th>
                  <th className="pb-3 text-right" style={{ fontFamily: "Arial, sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "hsl(0 0% 4%)", paddingRight: 16 }}>
                    Single
                  </th>
                  <th className="pb-3 text-right" style={{ fontFamily: "Arial, sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "hsl(0 0% 40%)", paddingRight: 16 }}>
                    2 Issues<br />
                    <span style={{ fontWeight: 400, fontSize: 9 }}>10% off</span>
                  </th>
                  <th className="pb-3 text-right" style={{ fontFamily: "Arial, sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "hsl(0 0% 40%)", paddingRight: 24 }}>
                    4 Issues<br />
                    <span style={{ fontWeight: 400, fontSize: 9 }}>20% off</span>
                  </th>
                  <th className="pb-3 text-right" style={{ fontFamily: "Arial, sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "hsl(182 40% 40%)", paddingRight: 12, background: "hsl(182 30% 96%)", paddingLeft: 12 }}>
                    Annual (6)<br />
                    <span style={{ fontWeight: 400, fontSize: 9 }}>Direct Debit</span>
                  </th>
                  <th className="pb-3 text-right" style={{ fontFamily: "Arial, sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "hsl(182 40% 40%)", paddingLeft: 12, background: "hsl(182 30% 96%)" }}>
                    Annual (6)<br />
                    <span style={{ fontWeight: 400, fontSize: 9 }}>Prepaid</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rateCard.map((row, i) => (
                  <tr key={row.ad} style={{ borderBottom: "1px solid hsl(0 0% 90%)", background: i % 2 === 0 ? "white" : "hsl(0 0% 98%)" }}>
                    <td className="py-3" style={{ fontFamily: "Arial, sans-serif", fontSize: 13, fontWeight: 600, color: "hsl(0 0% 4%)", paddingRight: 20 }}>
                      {row.ad}
                    </td>
                    <td className="py-3" style={{ fontFamily: "Arial, sans-serif", fontSize: 11, color: "hsl(0 0% 50%)", paddingRight: 20 }}>
                      {row.size}
                    </td>
                    <td className="py-3 text-right" style={{ fontFamily: "Arial, sans-serif", fontSize: 13, fontWeight: 700, color: "hsl(0 0% 4%)", paddingRight: 16 }}>
                      {fmt(row.single)}
                    </td>
                    <td className="py-3 text-right" style={{ fontFamily: "Arial, sans-serif", fontSize: 13, color: "hsl(0 0% 30%)", paddingRight: 16 }}>
                      {fmt(row.two)}
                    </td>
                    <td className="py-3 text-right" style={{ fontFamily: "Arial, sans-serif", fontSize: 13, color: "hsl(0 0% 30%)", paddingRight: 24 }}>
                      {fmt(row.four)}
                    </td>
                    <td className="py-3 text-right" style={{ fontFamily: "Arial, sans-serif", fontSize: 13, fontWeight: 700, color: "hsl(182 50% 35%)", paddingRight: 12, paddingLeft: 12, background: "hsl(182 30% 96%)" }}>
                      {fmt(row.annualDD)}
                    </td>
                    <td className="py-3 text-right" style={{ fontFamily: "Arial, sans-serif", fontSize: 13, fontWeight: 700, color: "hsl(182 50% 35%)", paddingLeft: 12, background: "hsl(182 30% 96%)" }}>
                      {fmt(row.annualPre)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile rate cards */}
          <div className="lg:hidden space-y-3">
            {rateCard.map(row => (
              <div key={row.ad} className="bg-white border border-border p-5">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div style={{ fontFamily: "Arial, sans-serif", fontSize: 13, fontWeight: 700, color: "hsl(0 0% 4%)" }}>{row.ad}</div>
                    <div style={{ fontFamily: "Arial, sans-serif", fontSize: 11, color: "hsl(0 0% 50%)", marginTop: 2 }}>{row.size}</div>
                  </div>
                  <div style={{ fontFamily: "Arial, sans-serif", fontSize: 18, fontWeight: 700, color: "hsl(0 0% 4%)" }}>{fmt(row.single)}</div>
                </div>
                <div className="flex gap-4 mt-3 pt-3 border-t border-border flex-wrap">
                  <div>
                    <div style={{ fontFamily: "Arial, sans-serif", fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "hsl(0 0% 60%)" }}>2 issues (−10%)</div>
                    <div style={{ fontFamily: "Arial, sans-serif", fontSize: 13, color: "hsl(0 0% 30%)" }}>{fmt(row.two)}</div>
                  </div>
                  <div>
                    <div style={{ fontFamily: "Arial, sans-serif", fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "hsl(0 0% 60%)" }}>4 issues (−20%)</div>
                    <div style={{ fontFamily: "Arial, sans-serif", fontSize: 13, color: "hsl(0 0% 30%)" }}>{fmt(row.four)}</div>
                  </div>
                  {row.annualDD !== null && (
                    <div>
                      <div style={{ fontFamily: "Arial, sans-serif", fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "hsl(182 50% 40%)" }}>Annual DD</div>
                      <div style={{ fontFamily: "Arial, sans-serif", fontSize: 13, fontWeight: 700, color: "hsl(182 50% 35%)" }}>{fmt(row.annualDD)}</div>
                    </div>
                  )}
                  {row.annualPre !== null && (
                    <div>
                      <div style={{ fontFamily: "Arial, sans-serif", fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "hsl(182 50% 40%)" }}>Annual Prepaid</div>
                      <div style={{ fontFamily: "Arial, sans-serif", fontSize: 13, fontWeight: 700, color: "hsl(182 50% 35%)" }}>{fmt(row.annualPre)}</div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Footnotes */}
          <div className="mt-6 pt-6 border-t border-border grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p style={{ fontFamily: "Arial, sans-serif", fontSize: 12, color: "hsl(0 0% 40%)", lineHeight: 1.6 }}>
                <strong style={{ color: "hsl(0 0% 20%)" }}>Advertorial</strong> — Client submitted/approved editorial charged at 10% premium on equivalent advertising space rate. Spaces available from quarter page column size.
              </p>
            </div>
            <div>
              <p style={{ fontFamily: "Arial, sans-serif", fontSize: 12, color: "hsl(0 0% 40%)", lineHeight: 1.6 }}>
                <strong style={{ color: "hsl(0 0% 20%)" }}>Artwork creation</strong> — If you don't have an advertising agency/designer we can help. Simply submit content by the editorial deadline (or sooner!) and we can artwork a design for you.
              </p>
            </div>
            <div className="md:col-span-2">
              <p style={{ fontFamily: "Arial, sans-serif", fontSize: 11, color: "hsl(0 0% 60%)", lineHeight: 1.6 }}>
                * Event attendance / coverage free for clients with booked campaigns &nbsp;|&nbsp; ** Only available on specific features &nbsp;|&nbsp; Media agency package discount 10% &nbsp;|&nbsp; Charity discount 40% &nbsp;|&nbsp; Strategic Partner rate 50%
              </p>
            </div>
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
            Download the full media pack for ad specifications and detailed readership data, or get in touch to discuss a campaign.
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
