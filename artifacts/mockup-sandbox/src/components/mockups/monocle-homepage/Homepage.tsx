import React from "react";
import { Search, Facebook, Twitter, Instagram } from "lucide-react";

export function Homepage() {
  return (
    <div className="min-h-screen bg-[#ffffff] text-[#000000]" style={{ fontFamily: 'Georgia, serif' }}>
      {/* Top bar */}
      <div className="border-t border-[#000000] py-2 px-4">
        <div className="max-w-[1296px] mx-auto flex justify-between items-center" style={{ fontFamily: 'Arial, sans-serif', fontSize: '13px' }}>
          <div>Tuesday, 6 May 2026</div>
          <div className="flex gap-4 items-center">
            <Facebook size={14} />
            <Twitter size={14} />
            <Instagram size={14} />
          </div>
        </div>
      </div>

      {/* Masthead/Nav */}
      <div className="border-b border-[#d9d9d9] py-6 px-4">
        <div className="max-w-[1296px] mx-auto flex justify-between items-center">
          <div className="text-[28px] font-bold tracking-tight">Gallery</div>
          
          <nav className="hidden md:flex gap-8" style={{ fontFamily: 'Arial, sans-serif', fontSize: '14px', fontWeight: 400 }}>
            {['Home', 'Active/Wellness', 'Advice', 'Culture', 'Fashion', 'People'].map((item) => (
              <a key={item} href="#" className="hover:underline decoration-1 underline-offset-4">{item}</a>
            ))}
          </nav>

          <div className="flex items-center gap-4">
            <button aria-label="Search">
              <Search size={20} />
            </button>
            <button className="bg-[#ffc500] text-[#000000] px-6 py-2 uppercase tracking-wide" style={{ fontFamily: 'Arial, sans-serif', fontWeight: 'bold', fontSize: '13px', borderRadius: 0 }}>
              Subscribe
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-[1296px] mx-auto px-4">
        {/* Hero section */}
        <div className="flex flex-col lg:flex-row gap-12 py-12">
          <div className="flex-1 flex flex-col justify-center">
            <div className="inline-block border border-[#d9d9d9] px-3 py-1 mb-6 self-start uppercase tracking-wider" style={{ fontFamily: 'Arial, sans-serif', fontSize: '13px' }}>
              Feature
            </div>
            <h1 className="text-[40px] leading-tight mb-6" style={{ letterSpacing: '-0.8px' }}>
              The Quiet Revolution in Jersey's Coastal Architecture
            </h1>
            <p className="text-[16px] leading-[1.5] mb-8 text-[#000000]">
              From restored tidal pools to brutalist concrete homes that weather the Atlantic storms, a new generation of architects is rethinking what it means to build on the edge of the world. We explore the island's most radical new structures.
            </p>
            <div className="text-[#6e6e6e]" style={{ fontFamily: 'Arial, sans-serif', fontSize: '13px' }}>
              By Sarah Mitchell — 4 May 2026
            </div>
          </div>
          
          <div className="flex-1">
            <div className="bg-[#e7e7e7] w-full aspect-[4/5] flex items-center justify-center">
              <span className="text-[#6e6e6e] tracking-widest uppercase" style={{ fontFamily: 'Arial, sans-serif', fontSize: '13px' }}>Cover Story</span>
            </div>
          </div>
        </div>

        {/* Divider */}
        <hr className="border-t border-[#000000] my-2" />

        {/* Issue highlights grid */}
        <div className="py-10">
          <h2 className="text-[24px] mb-8" style={{ letterSpacing: '-0.48px' }}>Latest Stories</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Card 1 */}
            <div className="flex flex-col gap-4">
              <div className="bg-[#e7e7e7] w-full aspect-[3/2] flex items-center justify-center rounded-[8px]">
                <span className="text-[#6e6e6e] tracking-widest uppercase" style={{ fontFamily: 'Arial, sans-serif', fontSize: '13px' }}>Culture</span>
              </div>
              <div>
                <div className="text-[#6e6e6e] uppercase tracking-wider mb-2" style={{ fontFamily: 'Arial, sans-serif', fontSize: '12px' }}>Culture</div>
                <h3 className="text-[20px] font-bold leading-tight mb-2" style={{ letterSpacing: '-0.48px' }}>
                  The Return of the Long Lunch
                </h3>
                <div className="text-[#6e6e6e]" style={{ fontFamily: 'Arial, sans-serif', fontSize: '13px' }}>
                  By Tom Edwards — 3 May 2026
                </div>
              </div>
            </div>

            {/* Card 2 */}
            <div className="flex flex-col gap-4">
              <div className="bg-[#e7e7e7] w-full aspect-[3/2] flex items-center justify-center rounded-[8px]">
                <span className="text-[#6e6e6e] tracking-widest uppercase" style={{ fontFamily: 'Arial, sans-serif', fontSize: '13px' }}>Fashion</span>
              </div>
              <div>
                <div className="text-[#6e6e6e] uppercase tracking-wider mb-2" style={{ fontFamily: 'Arial, sans-serif', fontSize: '12px' }}>Fashion</div>
                <h3 className="text-[20px] font-bold leading-tight mb-2" style={{ letterSpacing: '-0.48px' }}>
                  Autumn Essentials: The Heavy Wool Overcoat
                </h3>
                <div className="text-[#6e6e6e]" style={{ fontFamily: 'Arial, sans-serif', fontSize: '13px' }}>
                  By Elena Rossi — 2 May 2026
                </div>
              </div>
            </div>

            {/* Card 3 */}
            <div className="flex flex-col gap-4">
              <div className="bg-[#e7e7e7] w-full aspect-[3/2] flex items-center justify-center rounded-[8px]">
                <span className="text-[#6e6e6e] tracking-widest uppercase" style={{ fontFamily: 'Arial, sans-serif', fontSize: '13px' }}>People</span>
              </div>
              <div>
                <div className="text-[#6e6e6e] uppercase tracking-wider mb-2" style={{ fontFamily: 'Arial, sans-serif', fontSize: '12px' }}>People</div>
                <h3 className="text-[20px] font-bold leading-tight mb-2" style={{ letterSpacing: '-0.48px' }}>
                  A Conversation with Ceramist David Hock
                </h3>
                <div className="text-[#6e6e6e]" style={{ fontFamily: 'Arial, sans-serif', fontSize: '13px' }}>
                  By Marcus Chen — 1 May 2026
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Feature band */}
      <div className="bg-[#fdfcf3] py-16 px-4 mt-8">
        <div className="max-w-[1296px] mx-auto grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
          <div>
            <div className="text-[#000000] uppercase tracking-wider mb-6" style={{ fontFamily: 'Arial, sans-serif', fontSize: '13px', fontWeight: 'bold' }}>Editor's Pick</div>
            <blockquote className="text-[24px] italic leading-relaxed" style={{ letterSpacing: '-0.48px' }}>
              "True luxury isn't about excess. It's about having the time to appreciate something that was made with intention and care. That's what we've lost, and that's exactly what we need to get back."
            </blockquote>
          </div>
          
          <div className="bg-white p-6 rounded-[8px] border border-[#d9d9d9]">
            <div className="bg-[#64d5ff] text-[#000000] inline-block px-3 py-1 mb-4 uppercase tracking-wider" style={{ fontFamily: 'Arial, sans-serif', fontSize: '12px', fontWeight: 'bold' }}>
              Advice
            </div>
            <h3 className="text-[24px] font-bold leading-tight mb-4" style={{ letterSpacing: '-0.48px' }}>
              How to Build a Wardrobe That Outlasts Trends
            </h3>
            <p className="text-[16px] leading-[1.5] mb-6 text-[#000000]">
              We sit down with master tailors and slow-fashion advocates to define the foundational pieces every modern professional needs.
            </p>
            <div className="text-[#6e6e6e]" style={{ fontFamily: 'Arial, sans-serif', fontSize: '13px' }}>
              Read the full guide →
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-[#000000] py-12 px-4">
        <div className="max-w-[1296px] mx-auto flex flex-col md:flex-row justify-between items-center gap-6" style={{ fontFamily: 'Arial, sans-serif', fontSize: '13px' }}>
          <div className="flex items-center gap-4">
            <span className="text-[20px] font-bold" style={{ fontFamily: 'Georgia, serif' }}>Gallery</span>
            <span className="text-[#6e6e6e]">The global briefing on culture and design.</span>
          </div>
          
          <div className="flex gap-6 text-[#6e6e6e]">
            <a href="#" className="hover:text-[#000000]">About Us</a>
            <a href="#" className="hover:text-[#000000]">Contact</a>
            <a href="#" className="hover:text-[#000000]">Privacy Policy</a>
            <a href="#" className="hover:text-[#000000]">Terms of Service</a>
          </div>
          
          <div className="text-[#6e6e6e]">
            © 2026 Gallery Magazine. All rights reserved.
          </div>
        </div>
      </div>

    </div>
  );
}
