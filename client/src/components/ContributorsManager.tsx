import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw, Trash2, Edit, Search, ChevronDown, ChevronUp, Users, Plus } from "lucide-react";
import type { IssueContributor } from "@shared/schema";

export function ContributorsManager() {
  const { toast } = useToast();
  const [selectedIssue, setSelectedIssue] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [editingContributor, setEditingContributor] = useState<IssueContributor | null>(null);
  const [expandedIssues, setExpandedIssues] = useState<Set<number>>(new Set());
  const [extracting, setExtracting] = useState(false);
  const [extractLog, setExtractLog] = useState<string[]>([]);

  const { data: issuedWithContributors = [] } = useQuery<number[]>({
    queryKey: ['/api/contributors/issues'],
  });

  const { data: contributors = [], isLoading, refetch } = useQuery<IssueContributor[]>({
    queryKey: ['/api/contributors', selectedIssue, search],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedIssue !== "all") params.set('issueNumber', selectedIssue);
      if (search) params.set('search', search);
      const res = await fetch(`/api/contributors?${params}`);
      return res.json();
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: Partial<IssueContributor> & { id: string }) =>
      apiRequest('PUT', `/api/contributors/${data.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/contributors'] });
      setEditingContributor(null);
      toast({ title: "Contributor updated" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest('DELETE', `/api/contributors/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/contributors'] });
      queryClient.invalidateQueries({ queryKey: ['/api/contributors/issues'] });
      toast({ title: "Contributor deleted" });
    },
  });

  const deleteIssueMutation = useMutation({
    mutationFn: (num: number) => apiRequest('DELETE', `/api/contributors/issue/${num}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/contributors'] });
      queryClient.invalidateQueries({ queryKey: ['/api/contributors/issues'] });
      toast({ title: "Issue contributors cleared" });
    },
  });

  // Group contributors by issue
  const byIssue = contributors.reduce<Record<number, IssueContributor[]>>((acc, c) => {
    if (!acc[c.issueNumber]) acc[c.issueNumber] = [];
    acc[c.issueNumber].push(c);
    return acc;
  }, {});

  const issueNumbers = Object.keys(byIssue).map(Number).sort((a, b) => b - a);

  const toggleIssue = (n: number) => {
    setExpandedIssues(prev => {
      const next = new Set(prev);
      next.has(n) ? next.delete(n) : next.add(n);
      return next;
    });
  };

  const handleExtract = async (issueNumber?: number) => {
    setExtracting(true);
    setExtractLog([]);
    try {
      const body = issueNumber ? { issueNumber } : {};
      const res = await fetch('/api/contributors/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.results) {
        const log = data.results.map((r: any) =>
          r.count > 0
            ? `✓ Issue #${r.issue}: ${r.count} contributors (p.${r.page})`
            : `✗ Issue #${r.issue}: ${r.error || 'none found'}`
        );
        setExtractLog(log);
        toast({ title: `Extracted ${data.total} contributors total` });
      } else {
        setExtractLog([data.error || 'Unknown error']);
        toast({ title: "Extraction failed", variant: "destructive" });
      }
      queryClient.invalidateQueries({ queryKey: ['/api/contributors'] });
      queryClient.invalidateQueries({ queryKey: ['/api/contributors/issues'] });
    } catch (e: any) {
      setExtractLog([e.message]);
      toast({ title: "Extraction failed", variant: "destructive" });
    } finally {
      setExtracting(false);
    }
  };

  const roleColor: Record<string, string> = {
    contributor: "bg-secondary/10 text-secondary border-secondary/30",
    editorial: "bg-blue-50 text-blue-700 border-blue-200",
    photography: "bg-purple-50 text-purple-700 border-purple-200",
    illustration: "bg-orange-50 text-orange-700 border-orange-200",
  };

  return (
    <div className="space-y-6">
      {/* Header controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Contributors
            <Badge variant="outline" className="ml-2">{contributors.length} records</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <Button
              onClick={() => handleExtract()}
              disabled={extracting}
              data-testid="button-extract-all"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${extracting ? 'animate-spin' : ''}`} />
              {extracting ? 'Extracting…' : 'Extract All PDFs'}
            </Button>
            <p className="text-sm text-muted-foreground self-center">
              Scans all {160} issue PDFs to find contributor pages. Takes a few minutes.
            </p>
          </div>

          {extractLog.length > 0 && (
            <div className="bg-muted rounded p-3 max-h-48 overflow-y-auto font-mono text-xs space-y-0.5">
              {extractLog.map((l, i) => (
                <div key={i} className={l.startsWith('✓') ? 'text-green-700' : 'text-red-600'}>{l}</div>
              ))}
            </div>
          )}

          {/* Filters */}
          <div className="flex gap-3 flex-wrap">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by name…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9"
                data-testid="input-contributor-search"
              />
            </div>
            <Select value={selectedIssue} onValueChange={setSelectedIssue}>
              <SelectTrigger className="w-48" data-testid="select-issue-filter">
                <SelectValue placeholder="All issues" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All issues</SelectItem>
                {issuedWithContributors.map(n => (
                  <SelectItem key={n} value={String(n)}>Issue #{n}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Contributors by issue */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading…</div>
      ) : issueNumbers.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Users className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p className="font-medium">No contributors yet</p>
            <p className="text-sm mt-1">Click "Extract All PDFs" to scan the magazine archive.</p>
          </CardContent>
        </Card>
      ) : (
        issueNumbers.map(issueNum => {
          const issueContribs = byIssue[issueNum];
          const isExpanded = expandedIssues.has(issueNum);
          const featured = issueContribs.filter(c => c.role === 'contributor');
          const credits = issueContribs.filter(c => c.role !== 'contributor');

          return (
            <Card key={issueNum} data-testid={`card-issue-${issueNum}`}>
              <CardHeader
                className="cursor-pointer hover:bg-muted/30 transition-colors py-4"
                onClick={() => toggleIssue(issueNum)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    <span className="font-semibold">Issue #{issueNum}</span>
                    <Badge variant="outline">{issueContribs.length}</Badge>
                    <div className="flex gap-1">
                      {featured.length > 0 && <Badge className="text-xs bg-secondary/10 text-secondary border-secondary/30">{featured.length} featured</Badge>}
                      {credits.length > 0 && <Badge variant="outline" className="text-xs">{credits.length} credits</Badge>}
                    </div>
                  </div>
                  <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleExtract(issueNum)}
                      disabled={extracting}
                      data-testid={`button-extract-${issueNum}`}
                    >
                      <RefreshCw className="w-3 h-3 mr-1" /> Re-extract
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="outline" className="text-destructive hover:text-destructive">
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Clear Issue #{issueNum} contributors?</AlertDialogTitle>
                          <AlertDialogDescription>This deletes all {issueContribs.length} contributor records for this issue.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteIssueMutation.mutate(issueNum)}>Delete all</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardHeader>

              {isExpanded && (
                <CardContent className="pt-0">
                  {/* Featured contributors with bios */}
                  {featured.length > 0 && (
                    <div className="mb-4">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Featured Contributors</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {featured.map(c => (
                          <div key={c.id} className="border rounded-lg p-3 space-y-1" data-testid={`contributor-${c.id}`}>
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="font-semibold text-sm">{c.name}</p>
                                {c.pageRef && <p className="text-xs text-muted-foreground">{c.pageRef}</p>}
                              </div>
                              <div className="flex gap-1 shrink-0">
                                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setEditingContributor(c)}>
                                  <Edit className="w-3 h-3" />
                                </Button>
                                <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => deleteMutation.mutate(c.id)}>
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </div>
                            </div>
                            {c.bio && <p className="text-xs text-muted-foreground line-clamp-3">{c.bio}</p>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Credit lists */}
                  {credits.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Credits</p>
                      <div className="flex flex-wrap gap-2">
                        {credits.map(c => (
                          <div key={c.id} className="flex items-center gap-1" data-testid={`credit-${c.id}`}>
                            <Badge
                              variant="outline"
                              className={`text-xs ${roleColor[c.role || ''] || ''}`}
                            >
                              {c.name}
                            </Badge>
                            <Button size="icon" variant="ghost" className="h-5 w-5 text-destructive" onClick={() => deleteMutation.mutate(c.id)}>
                              <Trash2 className="w-2.5 h-2.5" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              )}
            </Card>
          );
        })
      )}

      {/* Edit dialog */}
      {editingContributor && (
        <Dialog open onOpenChange={() => setEditingContributor(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Contributor</DialogTitle>
            </DialogHeader>
            <form
              onSubmit={e => {
                e.preventDefault();
                const fd = new FormData(e.target as HTMLFormElement);
                updateMutation.mutate({
                  id: editingContributor.id,
                  name: fd.get('name') as string,
                  bio: fd.get('bio') as string || null,
                  pageRef: fd.get('pageRef') as string || null,
                  role: fd.get('role') as string || null,
                  photoUrl: fd.get('photoUrl') as string || null,
                });
              }}
              className="space-y-4"
            >
              <div>
                <label className="text-sm font-medium">Name</label>
                <Input name="name" defaultValue={editingContributor.name} required data-testid="input-contributor-name" />
              </div>
              <div>
                <label className="text-sm font-medium">Role</label>
                <Select name="role" defaultValue={editingContributor.role || 'contributor'}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="contributor">Contributor</SelectItem>
                    <SelectItem value="editorial">Editorial</SelectItem>
                    <SelectItem value="photography">Photography</SelectItem>
                    <SelectItem value="illustration">Illustration</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Bio</label>
                <Textarea name="bio" defaultValue={editingContributor.bio || ''} rows={3} data-testid="input-contributor-bio" />
              </div>
              <div>
                <label className="text-sm font-medium">Page reference</label>
                <Input name="pageRef" defaultValue={editingContributor.pageRef || ''} placeholder="Pg. 42" data-testid="input-contributor-pageref" />
              </div>
              <div>
                <label className="text-sm font-medium">Photo URL</label>
                <Input name="photoUrl" defaultValue={editingContributor.photoUrl || ''} placeholder="https://…" data-testid="input-contributor-photo" />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditingContributor(null)}>Cancel</Button>
                <Button type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? 'Saving…' : 'Save'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
