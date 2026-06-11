import { Switch, Route } from "wouter";
import { lazy, Suspense } from "react";
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
          <Router />
        </TooltipProvider>
      </AdminProvider>
    </QueryClientProvider>
  );
}

export default App;
