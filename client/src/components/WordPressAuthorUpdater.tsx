import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Upload, CheckCircle, AlertCircle, Users } from "lucide-react";

interface UpdateResults {
  totalPosts: number;
  authorsCreated: number;
  articlesUpdated: number;
  articlesNotFound: number;
  errors: string[];
}

export default function WordPressAuthorUpdater() {
  const [file, setFile] = useState<File | null>(null);
  const [updateResults, setUpdateResults] = useState<UpdateResults | null>(null);

  const updateMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/admin/wordpress-update-authors", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`${response.status}: ${text}`);
      }

      return await response.json();
    },
    onSuccess: (data: any) => {
      setUpdateResults(data.results);
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setUpdateResults(null);
    }
  };

  const handleUpdate = () => {
    if (file) {
      updateMutation.mutate(file);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Update Authors from WordPress XML
        </CardTitle>
        <CardDescription>
          This tool updates only the author assignments for existing articles without modifying content or images.
          Safe to use after updating image paths.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Important:</strong> This will only update author information. Your article content, 
            images, and other data will remain unchanged. Perfect for fixing author assignments after a migration.
          </AlertDescription>
        </Alert>

        <div className="space-y-4">
          <div>
            <label
              htmlFor="wp-file-upload"
              className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-accent/50 transition-colors"
            >
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <Upload className="w-10 h-10 mb-2 text-muted-foreground" />
                <p className="mb-2 text-sm text-muted-foreground">
                  <span className="font-semibold">Click to upload</span> or drag and drop
                </p>
                <p className="text-xs text-muted-foreground">WordPress XML export file</p>
              </div>
              <input
                id="wp-file-upload"
                type="file"
                className="hidden"
                accept=".xml"
                onChange={handleFileChange}
                data-testid="input-wp-xml-file"
              />
            </label>
            {file && (
              <p className="mt-2 text-sm text-muted-foreground" data-testid="text-selected-file">
                Selected: {file.name}
              </p>
            )}
          </div>

          <Button
            onClick={handleUpdate}
            disabled={!file || updateMutation.isPending}
            className="w-full"
            data-testid="button-update-authors"
          >
            {updateMutation.isPending ? "Updating Authors..." : "Update Authors Only"}
          </Button>

          {updateMutation.isPending && (
            <div className="space-y-2">
              <Progress value={undefined} className="w-full" />
              <p className="text-sm text-center text-muted-foreground">
                Processing WordPress XML file...
              </p>
            </div>
          )}

          {updateResults && (
            <div className="space-y-4 mt-6">
              <Alert variant={updateResults.errors.length > 0 ? "destructive" : "default"}>
                {updateResults.errors.length === 0 ? (
                  <CheckCircle className="h-4 w-4" />
                ) : (
                  <AlertCircle className="h-4 w-4" />
                )}
                <AlertDescription>
                  <strong>Update Complete</strong>
                  <div className="mt-2 space-y-1 text-sm">
                    <p data-testid="result-total-posts">Total posts processed: {updateResults.totalPosts}</p>
                    <p data-testid="result-authors-created">Authors created: {updateResults.authorsCreated}</p>
                    <p data-testid="result-articles-updated" className="text-green-600 font-semibold">
                      Articles updated: {updateResults.articlesUpdated}
                    </p>
                    <p data-testid="result-articles-not-found">Articles not found: {updateResults.articlesNotFound}</p>
                  </div>
                </AlertDescription>
              </Alert>

              {updateResults.errors.length > 0 && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Errors encountered:</strong>
                    <ul className="mt-2 list-disc list-inside text-sm">
                      {updateResults.errors.slice(0, 5).map((error, i) => (
                        <li key={i} className="text-xs">{error}</li>
                      ))}
                    </ul>
                    {updateResults.errors.length > 5 && (
                      <p className="mt-2 text-xs">...and {updateResults.errors.length - 5} more errors</p>
                    )}
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
        </div>

        <div className="mt-6 p-4 bg-muted rounded-lg">
          <h4 className="font-semibold text-sm mb-2">How it works:</h4>
          <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
            <li>Reads WordPress post IDs and author names from the XML</li>
            <li>Creates author accounts for any new authors found</li>
            <li>Finds existing articles by their WordPress post ID</li>
            <li>Updates only the author field - content and images stay the same</li>
          </ol>
        </div>
      </CardContent>
    </Card>
  );
}
