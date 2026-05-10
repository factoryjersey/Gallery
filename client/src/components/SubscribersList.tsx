import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Mail } from "lucide-react";

type Subscriber = {
  id: string;
  email: string;
  name: string | null;
  source: string | null;
  subscribedAt: string;
  unsubscribedAt: string | null;
};

export default function SubscribersList() {
  const [activeOnly, setActiveOnly] = useState(true);
  const { data, isLoading } = useQuery<{ subscribers: Subscriber[]; total: number }>({
    queryKey: [`/api/admin/subscribers?activeOnly=${activeOnly}`],
  });

  const rows = data?.subscribers ?? [];

  const exportCsv = () => {
    const header = ["email", "name", "source", "subscribed_at", "unsubscribed_at"].join(",");
    const lines = rows.map((r) =>
      [r.email, r.name ?? "", r.source ?? "", r.subscribedAt, r.unsubscribedAt ?? ""]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(","),
    );
    const blob = new Blob([[header, ...lines].join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `gallery-subscribers-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Subscribers
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            {data?.total ?? 0} total · captured from newsletter forms in the footer and sidebar
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={activeOnly ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveOnly((v) => !v)}
            data-testid="toggle-active-subs"
          >
            {activeOnly ? "Active only" : "Including unsubscribed"}
          </Button>
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={rows.length === 0} data-testid="export-subs-csv">
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No subscribers yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="subs-table">
              <thead className="border-b border-border">
                <tr className="text-left text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">Email</th>
                  <th className="py-2 pr-4 font-medium">Name</th>
                  <th className="py-2 pr-4 font-medium">Source</th>
                  <th className="py-2 pr-4 font-medium">Subscribed</th>
                  <th className="py-2 pr-4 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-border last:border-0">
                    <td className="py-2 pr-4 font-mono">{r.email}</td>
                    <td className="py-2 pr-4">{r.name ?? "—"}</td>
                    <td className="py-2 pr-4 text-muted-foreground">{r.source ?? "—"}</td>
                    <td className="py-2 pr-4 text-muted-foreground">
                      {new Date(r.subscribedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                    </td>
                    <td className="py-2 pr-4">
                      {r.unsubscribedAt ? (
                        <span className="text-red-600">Unsubscribed</span>
                      ) : (
                        <span className="text-green-600">Active</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
