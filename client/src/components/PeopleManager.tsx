import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Users, Mail, Camera, FileText, Trash2, Pencil, Save, X, Plus } from "lucide-react";

type Person = {
  id: string;
  name: string;
  email: string | null;
  bio: string | null;
  avatar: string | null;
  photoUrl: string | null;
  defaultRole: string | null;
};

type AuthorsResp = { authors: Person[] };

export default function PeopleManager() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [q, setQ] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<Person>>({});
  const [showNew, setShowNew] = useState(false);

  const authorsQ = useQuery<AuthorsResp>({ queryKey: ["/api/authors"] });

  const filtered = useMemo(() => {
    const all = authorsQ.data?.authors || [];
    if (!q.trim()) return all;
    const needle = q.toLowerCase();
    return all.filter(
      (p) =>
        p.name.toLowerCase().includes(needle) ||
        (p.email || "").toLowerCase().includes(needle) ||
        (p.defaultRole || "").toLowerCase().includes(needle) ||
        (p.bio || "").toLowerCase().includes(needle),
    );
  }, [authorsQ.data, q]);

  const save = useMutation({
    mutationFn: async (body: Partial<Person> & { id?: string }) => {
      const isNew = !body.id;
      const r = await fetch(isNew ? "/api/authors" : `/api/authors/${body.id}`, {
        method: isNew ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error((await r.json()).error || "Save failed");
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "Saved" });
      setEditingId(null);
      setShowNew(false);
      setDraft({});
      qc.invalidateQueries({ queryKey: ["/api/authors"] });
    },
    onError: (e: Error) => toast({ title: "Save failed", description: e.message, variant: "destructive" }),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/authors/${id}`, { method: "DELETE" });
      if (!r.ok) throw new Error((await r.json()).error || "Delete failed");
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "Deleted" });
      qc.invalidateQueries({ queryKey: ["/api/authors"] });
    },
    onError: (e: Error) => toast({ title: "Delete failed", description: e.message, variant: "destructive" }),
  });

  const startEdit = (p: Person) => {
    setEditingId(p.id);
    setDraft({ ...p });
    setShowNew(false);
  };

  const cancel = () => {
    setEditingId(null);
    setShowNew(false);
    setDraft({});
  };

  const photoFor = (p: Person) => p.photoUrl || p.avatar || null;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" /> People
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Unified list of article authors and issue contributors. {filtered.length}{" "}
                {filtered.length === 1 ? "person" : "people"}
                {q ? ` matching "${q}"` : ""}.
              </p>
            </div>
            <Button size="sm" onClick={() => { setShowNew(true); setEditingId(null); setDraft({ name: "" }); }}>
              <Plus className="h-4 w-4 mr-2" /> Add person
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Input
            placeholder="Search by name, email, role, bio…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            data-testid="people-search"
          />
        </CardContent>
      </Card>

      {showNew && (
        <Card className="border-primary">
          <CardHeader>
            <CardTitle className="text-base">New person</CardTitle>
          </CardHeader>
          <CardContent>
            <PersonForm
              draft={draft}
              setDraft={setDraft}
              onSave={() => save.mutate(draft)}
              onCancel={cancel}
              busy={save.isPending}
            />
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {authorsQ.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {filtered.map((p) => {
          const editing = editingId === p.id;
          return (
            <Card key={p.id} className={editing ? "border-primary" : ""}>
              <CardContent className="pt-4">
                {editing ? (
                  <PersonForm
                    draft={draft}
                    setDraft={setDraft}
                    onSave={() => save.mutate({ ...draft, id: p.id })}
                    onCancel={cancel}
                    busy={save.isPending}
                  />
                ) : (
                  <div className="flex items-start gap-3">
                    <div className="shrink-0">
                      {photoFor(p) ? (
                        <img src={photoFor(p)!} alt={p.name} className="w-14 h-14 object-cover rounded" />
                      ) : (
                        <div className="w-14 h-14 bg-muted flex items-center justify-center text-muted-foreground rounded">
                          {p.name.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{p.name}</div>
                      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mt-1">
                        {p.email && (<span className="inline-flex items-center gap-1"><Mail className="h-3 w-3" />{p.email}</span>)}
                        {p.defaultRole && (<span className="inline-flex items-center gap-1"><Camera className="h-3 w-3" />{p.defaultRole}</span>)}
                      </div>
                      {p.bio && (
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{p.bio}</p>
                      )}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button size="sm" variant="ghost" onClick={() => startEdit(p)} data-testid={`edit-person-${p.id}`}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          if (confirm(`Delete "${p.name}"? Articles by this person will lose their byline.`)) del.mutate(p.id);
                        }}
                        data-testid={`delete-person-${p.id}`}
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
        {filtered.length === 0 && !authorsQ.isLoading && (
          <p className="text-sm text-muted-foreground p-4 text-center">No people match.</p>
        )}
      </div>
    </div>
  );
}

function PersonForm({
  draft,
  setDraft,
  onSave,
  onCancel,
  busy,
}: {
  draft: Partial<Person>;
  setDraft: (d: Partial<Person>) => void;
  onSave: () => void;
  onCancel: () => void;
  busy: boolean;
}) {
  return (
    <div className="space-y-3">
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-muted-foreground">Name *</label>
          <Input value={draft.name || ""} onChange={(e) => setDraft({ ...draft, name: e.target.value })} required />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Email (optional)</label>
          <Input
            type="email"
            value={draft.email || ""}
            onChange={(e) => setDraft({ ...draft, email: e.target.value || null })}
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Default role (e.g. Photographer)</label>
          <Input
            value={draft.defaultRole || ""}
            onChange={(e) => setDraft({ ...draft, defaultRole: e.target.value || null })}
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Photo URL</label>
          <Input
            value={draft.photoUrl || draft.avatar || ""}
            onChange={(e) => setDraft({ ...draft, photoUrl: e.target.value || null })}
          />
        </div>
      </div>
      <div>
        <label className="text-xs text-muted-foreground">Bio</label>
        <textarea
          rows={3}
          value={draft.bio || ""}
          onChange={(e) => setDraft({ ...draft, bio: e.target.value || null })}
          className="w-full border border-input rounded px-3 py-2 text-sm"
        />
      </div>
      <div className="flex gap-2 justify-end">
        <Button size="sm" variant="ghost" onClick={onCancel} disabled={busy}>
          <X className="h-4 w-4 mr-1" /> Cancel
        </Button>
        <Button size="sm" onClick={onSave} disabled={busy || !draft.name}>
          <Save className="h-4 w-4 mr-1" /> Save
        </Button>
      </div>
    </div>
  );
}
