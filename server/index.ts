import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { fixCategoryDescriptions } from "./dataMigrations";
import http from "http";

const app = express();

declare module 'http' {
  interface IncomingMessage {
    rawBody: unknown
  }
}
app.use(express.json({
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: false }));

/**
 * Baseline security + privacy response headers. Cheap to add, helps
 * Lighthouse "Best Practices" + the OWASP basics. We deliberately skip
 * Content-Security-Policy here — getting it tight without breaking
 * Tailwind inline styles, R2 image hosts, and Google Analytics is its
 * own piece of work, so leave it for a focused pass.
 */
app.use((_req, res, next) => {
  // HSTS — force HTTPS for a year, include subdomains. Safe behind
  // Railway's HTTPS termination; only a downgrade attack on the very
  // first visit is unprotected (preload would close that gap).
  res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  // Stop the browser sniffing MIME types on text/* responses.
  res.setHeader("X-Content-Type-Options", "nosniff");
  // Block this site from being embedded in iframes — defeats clickjacking.
  res.setHeader("X-Frame-Options", "DENY");
  // Leak less in the Referer header on cross-origin navigations.
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  // Lock down powerful APIs we don't use. Pre-empts surprise feature
  // requests if a third-party script ever slips in.
  res.setHeader(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  );
  next();
});

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Proxy /__mockup/ to the mockup sandbox dev server on port 23636
  app.use('/__mockup', (req: Request, res: Response) => {
    const target = `http://127.0.0.1:23636/__mockup${req.url}`;
    const proxyReq = http.request(target, { method: req.method, headers: req.headers }, (proxyRes) => {
      res.writeHead(proxyRes.statusCode || 200, proxyRes.headers);
      proxyRes.pipe(res);
    });
    proxyReq.on('error', () => res.status(502).send('Mockup sandbox not available'));
    req.pipe(proxyReq);
  });

  await fixCategoryDescriptions();
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    console.error(`[error] ${status}: ${message}`);
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
  }, () => {
    log(`serving on port ${port}`);
  });
})();
