import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Facebook, Twitter, Instagram, Linkedin } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

export default function Footer() {
  const [email, setEmail] = useState("");
  const { toast } = useToast();

  const handleNewsletterSignup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    
    // TODO: Implement newsletter signup API
    toast({
      title: "Success!",
      description: "Thank you for subscribing to our newsletter.",
    });
    setEmail("");
  };

  return (
    <footer className="bg-primary text-primary-foreground py-12 border-t border-border/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          {/* About */}
          <div>
            <h3 className="text-xl font-bold font-serif mb-4" data-testid="footer-title">
              Modern Magazine
            </h3>
            <p className="text-sm opacity-90 mb-4">
              Your trusted source for in-depth journalism and compelling stories from around the world.
            </p>
            <div className="flex space-x-3">
              <a
                href="#"
                className="w-8 h-8 bg-primary-foreground/10 rounded-full flex items-center justify-center hover:bg-primary-foreground/20 transition-colors"
                data-testid="social-facebook-footer"
              >
                <Facebook className="w-4 h-4" />
              </a>
              <a
                href="#"
                className="w-8 h-8 bg-primary-foreground/10 rounded-full flex items-center justify-center hover:bg-primary-foreground/20 transition-colors"
                data-testid="social-twitter-footer"
              >
                <Twitter className="w-4 h-4" />
              </a>
              <a
                href="#"
                className="w-8 h-8 bg-primary-foreground/10 rounded-full flex items-center justify-center hover:bg-primary-foreground/20 transition-colors"
                data-testid="social-instagram-footer"
              >
                <Instagram className="w-4 h-4" />
              </a>
              <a
                href="#"
                className="w-8 h-8 bg-primary-foreground/10 rounded-full flex items-center justify-center hover:bg-primary-foreground/20 transition-colors"
                data-testid="social-linkedin-footer"
              >
                <Linkedin className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-semibold mb-4">Quick Links</h4>
            <ul className="space-y-2 text-sm opacity-90">
              <li><a href="#" className="hover:text-secondary transition-colors" data-testid="footer-about">About Us</a></li>
              <li><a href="#" className="hover:text-secondary transition-colors" data-testid="footer-contact">Contact</a></li>
              <li><a href="#" className="hover:text-secondary transition-colors" data-testid="footer-advertise">Advertise</a></li>
              <li><a href="#" className="hover:text-secondary transition-colors" data-testid="footer-careers">Careers</a></li>
              <li><a href="#" className="hover:text-secondary transition-colors" data-testid="footer-privacy">Privacy Policy</a></li>
            </ul>
          </div>

          {/* Categories */}
          <div>
            <h4 className="font-semibold mb-4">Categories</h4>
            <ul className="space-y-2 text-sm opacity-90">
              <li><a href="/category/politics" className="hover:text-secondary transition-colors" data-testid="footer-politics">Politics</a></li>
              <li><a href="/category/technology" className="hover:text-secondary transition-colors" data-testid="footer-technology">Technology</a></li>
              <li><a href="/category/business" className="hover:text-secondary transition-colors" data-testid="footer-business">Business</a></li>
              <li><a href="/category/culture" className="hover:text-secondary transition-colors" data-testid="footer-culture">Culture</a></li>
              <li><a href="/category/sports" className="hover:text-secondary transition-colors" data-testid="footer-sports">Sports</a></li>
            </ul>
          </div>

          {/* Newsletter */}
          <div>
            <h4 className="font-semibold mb-4">Newsletter</h4>
            <p className="text-sm opacity-90 mb-3">
              Subscribe to get our latest articles delivered to your inbox.
            </p>
            <form onSubmit={handleNewsletterSignup} className="space-y-2" data-testid="newsletter-form">
              <Input
                type="email"
                placeholder="Your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground placeholder:text-primary-foreground/60"
                required
                data-testid="newsletter-email"
              />
              <Button 
                type="submit" 
                className="w-full bg-secondary hover:bg-secondary/90 text-white"
                data-testid="newsletter-submit"
              >
                Subscribe
              </Button>
            </form>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-primary-foreground/20 flex flex-col md:flex-row justify-between items-center text-sm opacity-75">
          <p data-testid="footer-copyright">
            &copy; 2024 Modern Magazine. All rights reserved.
          </p>
          <div className="flex space-x-4 mt-4 md:mt-0">
            <a href="#" className="hover:text-secondary transition-colors" data-testid="footer-terms">Terms of Service</a>
            <a href="#" className="hover:text-secondary transition-colors" data-testid="footer-cookies">Cookie Policy</a>
            <a href="#" className="hover:text-secondary transition-colors" data-testid="footer-sitemap">Sitemap</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
