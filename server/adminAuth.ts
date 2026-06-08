// Single-shared-password admin gate.
//
// - ADMIN_PASSWORD env var: the secret that unlocks /admin and admin
//   mutation routes. If unset, the server logs a warning on first mutation
//   and falls back to open mode (handy in dev, never the right state in prod).
// - ADMIN_COOKIE_SECRET env var: HMAC key used to sign the session cookie.
//   If unset, /api/admin/login returns 503.
//
// No external auth/session/jwt dependency — just node crypto and a signed
// cookie carrying its own expiry.
import type { Request, Response, NextFunction } from "express";
import crypto from "crypto";

const COOKIE_NAME = "gallery_admin";
const COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function getPassword(): string | null {
  return process.env.ADMIN_PASSWORD || null;
}

function getSecret(): string | null {
  return process.env.ADMIN_COOKIE_SECRET || null;
}

function sign(payload: string): string | null {
  const secret = getSecret();
  if (!secret) return null;
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

function timingSafeEqualStrings(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  try {
    return crypto.timingSafeEqual(ab, bb);
  } catch {
    return false;
  }
}

export function isAdminRequest(req: Request): boolean {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return false;
  const m = cookieHeader.match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]+)`));
  if (!m) return false;
  const token = decodeURIComponent(m[1]);
  const [expiryStr, hmac] = token.split(".");
  if (!expiryStr || !hmac) return false;
  const expiry = parseInt(expiryStr, 10);
  if (!Number.isFinite(expiry) || Date.now() > expiry) return false;
  const expected = sign(expiryStr);
  if (!expected) return false;
  return timingSafeEqualStrings(hmac, expected);
}

function setAdminCookie(res: Response) {
  const expiry = Date.now() + COOKIE_MAX_AGE_MS;
  const signed = sign(String(expiry));
  if (!signed) return;
  const token = `${expiry}.${signed}`;
  const parts = [
    `${COOKIE_NAME}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${Math.floor(COOKIE_MAX_AGE_MS / 1000)}`,
  ];
  if (process.env.NODE_ENV === "production") parts.push("Secure");
  res.setHeader("Set-Cookie", parts.join("; "));
}

function clearAdminCookie(res: Response) {
  const parts = [
    `${COOKIE_NAME}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0",
  ];
  if (process.env.NODE_ENV === "production") parts.push("Secure");
  res.setHeader("Set-Cookie", parts.join("; "));
}

export function adminLoginHandler(req: Request, res: Response) {
  const expected = getPassword();
  if (!expected) {
    return res.status(503).json({ error: "Admin login is not configured (ADMIN_PASSWORD unset)." });
  }
  if (!getSecret()) {
    return res.status(503).json({ error: "Admin login is not configured (ADMIN_COOKIE_SECRET unset)." });
  }
  const password = (req.body as { password?: unknown })?.password;
  if (typeof password !== "string" || password.length === 0) {
    return res.status(400).json({ error: "Password required" });
  }
  if (!timingSafeEqualStrings(password, expected)) {
    return res.status(401).json({ error: "Incorrect password" });
  }
  setAdminCookie(res);
  res.json({ isAdmin: true });
}

export function adminLogoutHandler(_req: Request, res: Response) {
  clearAdminCookie(res);
  res.json({ isAdmin: false });
}

export function adminMeHandler(req: Request, res: Response) {
  res.json({
    isAdmin: isAdminRequest(req),
    configured: !!getPassword() && !!getSecret(),
  });
}

// Routes that intentionally accept POST/PUT/PATCH/DELETE without admin auth.
// Anything not here AND under /api/ is gated.
const PUBLIC_MUTATION_PREFIXES = [
  "/api/admin/login",
  "/api/admin/logout",
  "/api/subscribers",
];

function isPublicMutation(path: string): boolean {
  return PUBLIC_MUTATION_PREFIXES.some((p) => path === p || path.startsWith(p + "/"));
}

let warnedOpen = false;

export function gateMutations(req: Request, res: Response, next: NextFunction) {
  if (!req.path.startsWith("/api/")) return next();
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") return next();
  if (isPublicMutation(req.path)) return next();
  if (!getPassword() || !getSecret()) {
    if (!warnedOpen) {
      console.warn(
        "[admin] ADMIN_PASSWORD / ADMIN_COOKIE_SECRET not set; admin mutations are unprotected.",
      );
      warnedOpen = true;
    }
    return next();
  }
  if (!isAdminRequest(req)) {
    return res.status(401).json({ error: "Admin login required" });
  }
  next();
}
