import { Switch, Route, useLocation } from "wouter";
import { lazy, Suspense, useEffect } from "react";
import { initAnalytics, trackPageview, ANALYTICS_ENABLED } from "@/lib/analytics";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AdminProvider } from "@/contexts/AdminContext";
import Home from "@/pages/home";
import Article from "@/pages/article";
import Category from "@/pages/category";
import CurrentIssue from "@/pages/current-issue";
import Archive from "@/pages/archive";
import About from "@/pages/about";
import Authors from "@/pages/authors";
import AuthorPage from "@/pages/author";
import ContributorPage from "@/pages/contributor";
import MediaPack from "@/pages/media-pack";
import Privacy from "@/pages/privacy";
import Terms from "@/pages/terms";
import Cookies from "@/pages/cookies";
import Sitemap from "@/pages/sitemap";
import NotFound from "@/pages/not-found";
import SplashLayout from "@/components/SplashLayout";

// Code-split the admin bundle. TipTap, react-image-crop, the media
// library picker and a few hundred KB of editor dependencies only load
// when a visitor actually opens /admin — public-facing pages never pay
// for them. Keeps the initial JS payload (Lighthouse "Reduce unused
// JavaScript") down dramatically.
const Admin = lazy(() => import("@/pages/admin"));

function HomeRouteWithSplash() {
  return (
    <SplashLayout>
      <Home />
    </SplashLayout>
  );
}

/**
 * Boots gtag.js once (no-op if VITE_GA4_MEASUREMENT_ID isn't set) and
 * emits a GA4 page_view on every wouter location change. Lives inside
 * the QueryClient/Router providers so it can use the location hook;
 * has to mount once at the app root so we never miss the initial view.
 */
function AnalyticsBridge() {
  const [location] = useLocation();
  useEffect(() => {
    if (!ANALYTICS_ENABLED) return;
    initAnalytics();
  }, []);
  useEffect(() => {
    if (!ANALYTICS_ENABLED) return;
    // Defer one microtask so document.title (set by useDocumentMeta on
    // route change) lands before we read it.
    queueMicrotask(() => trackPageview(location));
  }, [location]);
  return null;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={HomeRouteWithSplash} />
      <Route path="/admin">
        {/* Suspense fallback is a quiet hairline so the editor route
            doesn't flash a loud spinner while the chunk downloads. */}
        <Suspense fallback={<div className="min-h-screen bg-background" />}>
          <Admin />
        </Suspense>
      </Route>
      <Route path="/article/:slug" component={Article} />
      <Route path="/category/:slug" component={Category} />
      <Route path="/current-issue" component={CurrentIssue} />
      <Route path="/archive" component={Archive} />
      <Route path="/about" component={About} />
      <Route path="/authors" component={Authors} />
      <Route path="/author/:slug" component={AuthorPage} />
      <Route path="/contributor/:slug" component={ContributorPage} />
      <Route path="/media-pack" component={MediaPack} />
      <Route path="/privacy" component={Privacy} />
      <Route path="/terms" component={Terms} />
      <Route path="/cookies" component={Cookies} />
      <Route path="/sitemap" component={Sitemap} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AdminProvider>
        <TooltipProvider>
          <Toaster />
          <AnalyticsBridge />
          <Router />
        </TooltipProvider>
      </AdminProvider>
    </QueryClientProvider>
  );
}

export default App;
