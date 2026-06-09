import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, X, Search } from "lucide-react";

export interface CreditEntry {
  contributorId: string;
  name: string;
  slug: string;
  role: string;
}

interface Contributor {
  id: string;
  name: string;
  slug: string;
}

interface Props {
  /** Pre-existing credits — typically loaded from /api/articles/:id/contributors. */
  value: CreditEntry[];
  onChange: (next: CreditEntry[]) => void;
  /** Roles this picker manages. Each gets its own row. */
  roles?: { key: string; label: string }[];
}

const DEFAULT_ROLES = [
  { key: "photographer", label: "Photography" },
  { key: "illustrator", label: "Illustration" },
];

/**
 * Pick one or more contributors per role for an article. Contributors come
 * from the global contributors table — typing a new name creates a row,
 * typing an existing one matches it case-insensitively. Chips show the
 * currently-assigned credits per role; click × to remove.
 */
export default function ContributorsPicker({
  value,
  onChange,
  roles = DEFAULT_ROLES,
}: Props) {
  const [search, setSearch] = useState("");
  const [openRole, setOpenRole] = useState<string | null>(null);

  const { data } = useQuery<{ contributors: Contributor[] }>({
    queryKey: [`/api/contributors${search ? `?search=${encodeURIComponent(search)}` : ""}`],
    enabled: openRole !== null,
  });

  const createMutation = useMutation({
    mutationFn: async ({ name, defaultRole }: { name: string; defaultRole: string }) => {
      const res = await apiRequest("POST", "/api/contributors", { name, defaultRole });
      const json = await res.json();
      return json.contributor as Contributor;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contributors"] });
    },
  });

  const credits = (role: string) => value.filter((c) => c.role === role);

  function removeCredit(role: string, id: string) {
    onChange(value.filter((c) => !(c.role === role && c.contributorId === id)));
  }

  async function addExisting(role: string, c: Contributor) {
    // Prevent dupes
    if (value.some((e) => e.role === role && e.contributorId === c.id)) {
      setOpenRole(null);
      setSearch("");
      return;
    }
    onChange([...value, { contributorId: c.id, name: c.name, slug: c.slug, role }]);
    setOpenRole(null);
    setSearch("");
  }

  async function createAndAdd(role: string) {
    if (!search.trim()) return;
    const created = await createMutation.mutateAsync({ name: search, defaultRole: role });
    await addExisting(role, created);
  }

  const filtered = data?.contributors ?? [];
  const exactMatch = filtered.some(
    (c) => c.name.toLowerCase() === search.trim().toLowerCase(),
  );

  return (
    <div className="space-y-3">
      {roles.map((r) => {
        const list = credits(r.key);
        const isOpen = openRole === r.key;
        return (
          <div key={r.key} className="space-y-1">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {r.label}
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              {list.length === 0 && !isOpen && (
                <span className="text-sm text-muted-foreground italic">No {r.label.toLowerCase()} credit set.</span>
              )}
              {list.map((c) => (
                <span
                  key={c.contributorId}
                  className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 bg-accent border border-border text-sm"
                  data-testid={`credit-chip-${r.key}-${c.slug}`}
                >
                  {c.name}
                  <button
                    type="button"
                    onClick={() => removeCredit(r.key, c.contributorId)}
                    className="hover:bg-destructive hover:text-destructive-foreground rounded-sm p-0.5"
                    title="Remove credit"
                    data-testid={`credit-remove-${r.key}-${c.slug}`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
              {!isOpen && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => { setOpenRole(r.key); setSearch(""); }}
                  data-testid={`credit-add-${r.key}`}
                >
                  <Plus className="w-3 h-3 mr-1" />
                  Add
                </Button>
              )}
            </div>

            {isOpen && (
              <div className="border border-border rounded p-2 bg-background space-y-2 mt-1">
                <div className="flex items-center gap-2">
                  <Search className="w-4 h-4 text-muted-foreground" />
                  <Input
                    autoFocus
                    placeholder={`Find or add ${r.label.toLowerCase()}…`}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="h-8"
                    data-testid={`credit-search-${r.key}`}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8"
                    onClick={() => { setOpenRole(null); setSearch(""); }}
                  >
                    Cancel
                  </Button>
                </div>
                <div className="max-h-56 overflow-y-auto space-y-1">
                  {filtered.slice(0, 10).map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => addExisting(r.key, c)}
                      className="w-full text-left px-2 py-1.5 text-sm hover:bg-accent rounded"
                      data-testid={`credit-option-${r.key}-${c.slug}`}
                    >
                      {c.name}
                      <span className="text-xs text-muted-foreground ml-2">/contributor/{c.slug}</span>
                    </button>
                  ))}
                  {search.trim().length > 0 && !exactMatch && (
                    <button
                      type="button"
                      onClick={() => createAndAdd(r.key)}
                      disabled={createMutation.isPending}
                      className="w-full text-left px-2 py-1.5 text-sm border-t border-border hover:bg-accent rounded mt-1 text-secondary"
                      data-testid={`credit-create-${r.key}`}
                    >
                      <Plus className="w-3 h-3 inline mr-1" />
                      Create "{search.trim()}"
                    </button>
                  )}
                  {filtered.length === 0 && search.trim().length === 0 && (
                    <p className="text-xs text-muted-foreground p-2">Start typing to search existing contributors or create a new one.</p>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
