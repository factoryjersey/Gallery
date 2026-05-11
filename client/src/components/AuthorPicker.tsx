import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { Input } from "@/components/ui/input";

type Person = { id: string; name: string; email?: string | null; defaultRole?: string | null };

interface Props {
  value: string | null | undefined;
  onChange: (id: string) => void;
  placeholder?: string;
  className?: string;
}

export default function AuthorPicker({ value, onChange, placeholder = "Select author…", className }: Props) {
  const { data } = useQuery<{ authors: Person[] }>({ queryKey: ["/api/authors"] });
  const all = data?.authors || [];
  const selected = useMemo(() => all.find((p) => p.id === value) || null, [all, value]);

  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [highlight, setHighlight] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return all.slice(0, 50);
    return all
      .filter(
        (p) =>
          p.name.toLowerCase().includes(needle) ||
          (p.email || "").toLowerCase().includes(needle) ||
          (p.defaultRole || "").toLowerCase().includes(needle),
      )
      .slice(0, 50);
  }, [all, q]);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  useEffect(() => {
    setHighlight(0);
  }, [q, open]);

  const choose = (p: Person) => {
    onChange(p.id);
    setOpen(false);
    setQ("");
  };

  return (
    <div ref={wrapRef} className={`relative ${className || ""}`} data-testid="author-picker">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between border border-input bg-background rounded px-3 py-2 text-sm text-left hover:border-foreground"
        data-testid="author-picker-trigger"
      >
        <span className={selected ? "" : "text-muted-foreground"}>{selected ? selected.name : placeholder}</span>
        <ChevronsUpDown className="h-4 w-4 text-muted-foreground" />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full bg-card border border-border rounded shadow-lg overflow-hidden">
          <div className="p-2 border-b border-border flex items-center gap-2">
            <Input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by name, email, role…"
              className="flex-1"
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setHighlight((h) => Math.min(h + 1, filtered.length - 1));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setHighlight((h) => Math.max(h - 1, 0));
                } else if (e.key === "Enter") {
                  e.preventDefault();
                  if (filtered[highlight]) choose(filtered[highlight]);
                } else if (e.key === "Escape") {
                  setOpen(false);
                }
              }}
              data-testid="author-picker-input"
            />
            {q && (
              <button type="button" onClick={() => setQ("")} className="text-muted-foreground hover:text-foreground" aria-label="Clear">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className="max-h-72 overflow-y-auto">
            {filtered.length === 0 && (
              <p className="text-sm text-muted-foreground p-3">No people match.</p>
            )}
            {filtered.map((p, i) => (
              <button
                key={p.id}
                type="button"
                onClick={() => choose(p)}
                onMouseEnter={() => setHighlight(i)}
                className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between ${
                  i === highlight ? "bg-accent" : "hover:bg-accent/50"
                }`}
                data-testid={`author-picker-option-${p.id}`}
              >
                <span className="truncate">
                  {p.name}
                  {p.defaultRole && (
                    <span className="text-muted-foreground ml-2 text-xs">{p.defaultRole}</span>
                  )}
                </span>
                {p.id === value && <Check className="h-4 w-4 text-secondary" />}
              </button>
            ))}
          </div>
          <div className="px-3 py-2 text-xs text-muted-foreground border-t border-border bg-muted/30">
            Showing {filtered.length} of {all.length}. Manage in the People tab.
          </div>
        </div>
      )}
    </div>
  );
}
