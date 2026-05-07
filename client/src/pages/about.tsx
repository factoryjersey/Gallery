import Header from "@/components/Header";
import Footer from "@/components/Footer";

export default function About() {
  return (
    <div className="min-h-screen bg-background">
      <Header />

      <section className="bg-white border-b border-border py-10">
        <div className="max-w-[1296px] mx-auto px-6 text-center">
          <div
            className="mb-3"
            style={{ fontFamily: "Arial, sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "hsl(182 55% 56%)" }}
          >
            About Gallery
          </div>
          <h1 style={{ fontFamily: "Georgia, serif", fontSize: "clamp(28px, 6vw, 42px)", fontWeight: 400, letterSpacing: "-0.5px", color: "hsl(0 0% 4%)" }}>
            Who We Are
          </h1>
        </div>
      </section>

      <section className="py-16 bg-background">
        <div className="max-w-[720px] mx-auto px-6">
          <div
            className="space-y-6"
            style={{ fontFamily: "Georgia, serif", fontSize: 17, lineHeight: 1.75, color: "hsl(0 0% 15%)" }}
          >
            <p>
              Gallery was initially a three month project to prove to a skeptical ad exec that Jersey wanted a media that wasn't stuffy and stuck up. At that time, bad quality print media dominated and didn't seem to want to focus on anyone below retirement age. We wanted to splash the media with colour and content that wasn't afraid to be controversial, whilst using better production standards than any other local magazine.
            </p>
            <p>
              Our longevity is a testament to everyone that's contributed to and been involved in the magazine over the last 18 years. When we established Gallery, our goal was simply to offer a better, more engaging local print platform than other media and provide a magazine that included attractive content in a quality format that didn't bore us like a business magazine.
            </p>
            <p>
              Fast forward 18 years and in spite of our digitally-dominated media landscape, Gallery still champions the power of print to convey a message in a way digital doesn't quite grasp. Our high impact spreads that feature local people have the page-appeal to trigger attention.
            </p>
            <p>
              Our focus on local people and events ensures our content is interesting to the reader. We attribute the appeal of Gallery to the fact that our content is what ensures that we're picked up where other magazines aren't. Now published bimonthly, Gallery offers a long reach and exposure for our advertisers but it also means our content is never more than 60 days old for our readers.
            </p>
            <p>
              Whether taking time off a screen with a coffee or simply for the love of a tactile page in between your finger and thumb, pick up a Gallery from anywhere here and see who you know in this edition.
            </p>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
