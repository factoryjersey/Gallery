import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Loader2 } from "lucide-react";

export function CategoryHierarchyUpdater() {
  const [hierarchyData, setHierarchyData] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const { toast } = useToast();

  const handleUpdate = async () => {
    if (!hierarchyData.trim()) {
      toast({
        title: "Error",
        description: "Please paste the category hierarchy data",
        variant: "destructive",
      });
      return;
    }

    setIsUpdating(true);
    try {
      const response = await apiRequest("POST", "/api/categories/update-hierarchy", {
        hierarchyData,
      });

      toast({
        title: "Success",
        description: response.message || "Category hierarchy updated successfully",
      });

      await queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      setHierarchyData("");
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update category hierarchy",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Update Category Hierarchy</CardTitle>
        <CardDescription>
          Paste the category structure from WordPress admin to set up parent-child relationships.
          The format should include dashes (—) to indicate nesting level.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Textarea
          value={hierarchyData}
          onChange={(e) => setHierarchyData(e.target.value)}
          placeholder="Paste category hierarchy here..."
          className="min-h-[200px] font-mono text-sm"
          data-testid="textarea-hierarchy"
        />
        <Button 
          onClick={handleUpdate} 
          disabled={isUpdating || !hierarchyData.trim()}
          data-testid="button-update-hierarchy"
        >
          {isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Update Hierarchy
        </Button>
      </CardContent>
    </Card>
  );
}
