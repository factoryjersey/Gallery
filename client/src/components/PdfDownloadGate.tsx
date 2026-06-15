import { useState, useEffect } from "react";
import { X, Download } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { trackEvent } from "@/lib/analytics";

interface Props {
  /** PDF URL to open when the user gets through the gate. null/empty
   *  means the modal is closed. */
  pdfUrl: string | null;
  /** Suggested filename for the download (e.g. "gallery-208.pdf"). */
  filename?: string;
  /** Where the gate was triggered from — passed to /api/subscribers as
   *  the source field so we can see which surface drove the signup. */
  source: string;
  /** Called when the modal should close. */
  onClose: () => void;
}

// Local storage flag — set once the visitor has either subscribed OR
// explicitly dismissed the gate, so they're not nagged on every PDF
// click. Keyed (not nuclear) so we can rotate the prompt copy later
// if we want a fresh ask.
const SUPPRESS_KEY = "gallery-pdf-gate-cleared-v1";

function hasCleared() {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(SUPPRESS_KEY) === "true";
  } catch {
    return false;
  }
}

function markCleared() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SUPPRESS_KEY, "true");
  } catch {
    // Private browsing / storage disabled → silently skip; we'll just
    // re-ask next time.
  }
}

/**
 * Open the PDF in a fresh tab, prefering the download attribute so it
 * lands as a sensible filename rather than the R2 object key. We use a
 * dynamic anchor click so the suggested filename is honoured by the
 * download, then immediately clean it up.
 */
function startDownload(url: string, filename?: string) {
  const a = document.createElement("a");
  a.href = url;
  if (filename) a.download = filename;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/**
 * Newsletter-gated PDF download. Modal mirrors the sidebar's "Stay
 * Informed" block — same copy, same accent submit button, same teal
 * section label. Two actions:
 *
 *   1. Subscribe → POST /api/subscribers, then open the PDF.
 *   2. Skip ("Just download") → don't subscribe, but still open the
 *      PDF. We don't want to *block* downloads, just nudge.
 *
 * Either path marks the gate as cleared in localStorage so repeat
 * downloads in the same browser go straight through. Triggered
 * dismissals via the X button do *not* clear the flag — that's a "not
 * now" rather than "asked and answered".
 */
export default function PdfDownloadGate({ pdfUrl, filename, source, onClose }: Props) {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  // Fast path: if we've already shown this once (and the visitor either
  // subscribed or skipped), just trigger the download straight away
  // when pdfUrl becomes set, without rendering the modal. Means the
  // gate is a one-time nudge, not a persistent toll.
  useEffect(() => {
    if (!pdfUrl) return;
    if (hasCleared()) {
      startDownload(pdfUrl, filename);
      trackEvent("pdf_download", { source, gated: false, issue: filename });
      onClose();
    }
  }, [pdfUrl, filename, source, onClose]);

  if (!pdfUrl || hasCleared()) return null;

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || submitting) return;
    setSubmitting(true);
    try {
      const r = await fetch("/api/subscribers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, source: `pdf-gate:${source}` }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.error || "Subscribe failed");
      }
      toast({ title: "Subscribed!", description: "Thanks — your download is starting." });
      trackEvent("newsletter_signup", { source: `pdf-gate:${source}` });
      trackEvent("pdf_download", { source, gated: true, issue: filename });
      markCleared();
      startDownload(pdfUrl, filename);
      onClose();
    } catch (err: any) {
      toast({
        title: "Hmm…",
        description: err.message || "Try again in a sec.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSkip = () => {
    trackEvent("pdf_download", { source, gated: false, issue: filename });
    markCleared();
    startDownload(pdfUrl, filename);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4"
      data-testid="pdf-download-gate"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pdf-gate-title"
    >
      <div className="bg-foreground text-white max-w-md w-full p-7 relative">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-3 right-3 text-white/60 hover:text-white transition-colors"
          data-testid="pdf-gate-close"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="mb-4">
          <span
            id="pdf-gate-title"
            style={{
              fontFamily: "Arial, sans-serif",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              borderBottom: "3px solid hsl(52 97% 56%)",
              paddingBottom: 6,
              display: "inline-block",
            }}
          >
            Stay Informed
          </span>
        </div>
        <p
          className="mb-5 opacity-90"
          style={{ fontFamily: "Georgia, serif", fontSize: 16, lineHeight: 1.5 }}
        >
          Pop your email in to get this issue and the latest from Gallery, delivered now
          and again. No spam — just the magazine.
        </p>
        <form onSubmit={handleSubscribe} className="space-y-3" data-testid="pdf-gate-form">
          <Input
            type="email"
            placeholder="Your email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-none bg-white/10 border-white/20 text-white placeholder:text-white/50 focus-visible:ring-0 focus-visible:border-accent"
            required
            autoFocus
            data-testid="pdf-gate-email"
          />
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 bg-accent text-foreground transition-opacity hover:opacity-90 disabled:opacity-60 inline-flex items-center justify-center gap-2"
            style={{
              fontFamily: "Arial, sans-serif",
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
            }}
            data-testid="pdf-gate-submit"
          >
            <Download className="h-3.5 w-3.5" />
            {submitting ? "Subscribing…" : "Subscribe & Download"}
          </button>
        </form>
        <button
          type="button"
          onClick={handleSkip}
          className="mt-3 w-full text-center text-xs underline text-white/60 hover:text-white transition-colors"
          style={{ fontFamily: "Arial, sans-serif", letterSpacing: "0.06em" }}
          data-testid="pdf-gate-skip"
        >
          No thanks — just download the PDF
        </button>
      </div>
    </div>
  );
}
