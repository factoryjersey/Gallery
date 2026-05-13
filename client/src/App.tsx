import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AdminProvider } from "@/contexts/AdminContext";
import Home from "@/pages/home";
import Admin from "@/pages/admin";
import Article from "@/pages/article";
import Category from "@/pages/category";
import CurrentIssue from "@/pages/current-issue";
import Archive from "@/pages/archive";
import About from "@/pages/about";
import Authors from "@/pages/authors";
import AuthorPage from "@/pages/author";
import MediaPack from "@/pages/media-pack";
import Privacy from "@/pages/privacy";
import Terms from "@/pages/terms";
import Cookies from "@/pages/cookies";
import Sitemap from "@/pages/sitemap";
import NotFound from "@/pages/not-found";
import Splash from "@/components/Splash";

function HomeRouteWithSplash() {
  return (
    <>
      <Splash />
      <Home />
    </>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={HomeRouteWithSplash} />
      <Route path="/admin" component={Admin} />
      <Route path="/article/:slug" component={Article} />
      <Route path="/category/:slug" component={Category} />
      <Route path="/current-issue" component={CurrentIssue} />
      <Route path="/archive" component={Archive} />
      <Route path="/about" component={About} />
      <Route path="/authors" component={Authors} />
      <Route path="/author/:slug" component={AuthorPage} />
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
