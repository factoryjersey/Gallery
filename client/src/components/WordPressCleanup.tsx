import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { apiRequest } from "@/lib/queryClient";
import { Sparkles, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";

export function WordPressCleanup() {
  const [cleanupOptions, setCleanupOptions] = useState({
    removeWpClasses: true,
    removeInlineStyles: true,
    removeShortcodes: true,
    removeEmptyTags: true,
    normalizeWhitespace: true,
  });

  const cleanupMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/articles/cleanup-wordpress", cleanupOptions);
      return response.json();
    },
  });

  const handleCleanup = () => {
    if (confirm("This will clean WordPress formatting from all articles. This action cannot be undone. Continue?")) {
      cleanupMutation.mutate();
    }
  };

  const toggleOption = (option: keyof typeof cleanupOptions) => {
    setCleanupOptions(prev => ({
      ...prev,
      [option]: !prev[option]
    }));
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5" />
            WordPress Formatting Cleanup
          </CardTitle>
          <CardDescription>
            Remove WordPress-specific HTML classes, inline styles, shortcodes, and other formatting artifacts from all articles
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Cleanup Options */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm">Cleanup Options</h3>
            
            <div className="space-y-3">
              <div className="flex items-start space-x-3">
                <Checkbox
                  id="removeWpClasses"
                  checked={cleanupOptions.removeWpClasses}
                  onCheckedChange={() => toggleOption('removeWpClasses')}
                  data-testid="checkbox-wp-classes"
                />
                <div className="space-y-1">
                  <label
                    htmlFor="removeWpClasses"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                  >
                    Remove WordPress CSS Classes
                  </label>
                  <p className="text-sm text-muted-foreground">
                    Removes classes like wp-block-*, wp-*, align*, size-*, has-*, etc.
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <Checkbox
                  id="removeInlineStyles"
                  checked={cleanupOptions.removeInlineStyles}
                  onCheckedChange={() => toggleOption('removeInlineStyles')}
                  data-testid="checkbox-inline-styles"
                />
                <div className="space-y-1">
                  <label
                    htmlFor="removeInlineStyles"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                  >
                    Remove Inline Styles
                  </label>
                  <p className="text-sm text-muted-foreground">
                    Removes style attributes (font-family, font-size, color, etc.) except text-align
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <Checkbox
                  id="removeShortcodes"
                  checked={cleanupOptions.removeShortcodes}
                  onCheckedChange={() => toggleOption('removeShortcodes')}
                  data-testid="checkbox-shortcodes"
                />
                <div className="space-y-1">
                  <label
                    htmlFor="removeShortcodes"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                  >
                    Remove WordPress Shortcodes
                  </label>
                  <p className="text-sm text-muted-foreground">
                    Removes [shortcode]...[/shortcode] syntax
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <Checkbox
                  id="removeEmptyTags"
                  checked={cleanupOptions.removeEmptyTags}
                  onCheckedChange={() => toggleOption('removeEmptyTags')}
                  data-testid="checkbox-empty-tags"
                />
                <div className="space-y-1">
                  <label
                    htmlFor="removeEmptyTags"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                  >
                    Remove Empty HTML Tags
                  </label>
                  <p className="text-sm text-muted-foreground">
                    Removes empty &lt;p&gt;, &lt;span&gt;, &lt;div&gt; tags with no content
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <Checkbox
                  id="normalizeWhitespace"
                  checked={cleanupOptions.normalizeWhitespace}
                  onCheckedChange={() => toggleOption('normalizeWhitespace')}
                  data-testid="checkbox-whitespace"
                />
                <div className="space-y-1">
                  <label
                    htmlFor="normalizeWhitespace"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                  >
                    Normalize Whitespace
                  </label>
                  <p className="text-sm text-muted-foreground">
                    Cleans up excessive line breaks and whitespace
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Action Button */}
          <div className="pt-4 border-t">
            <Button
              onClick={handleCleanup}
              disabled={cleanupMutation.isPending}
              className="w-full"
              size="lg"
              data-testid="button-cleanup"
            >
              {cleanupMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Cleaning up articles...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Clean All Articles
                </>
              )}
            </Button>
          </div>

          {/* Results */}
          {cleanupMutation.isSuccess && (
            <Alert className="bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
              <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
              <AlertDescription className="text-green-800 dark:text-green-200">
                <div className="space-y-2">
                  <p className="font-semibold">Cleanup completed successfully!</p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="font-medium">Articles processed:</span>{" "}
                      <Badge variant="secondary">{cleanupMutation.data?.articlesProcessed || 0}</Badge>
                    </div>
                    <div>
                      <span className="font-medium">Articles updated:</span>{" "}
                      <Badge variant="secondary">{cleanupMutation.data?.articlesUpdated || 0}</Badge>
                    </div>
                    <div>
                      <span className="font-medium">Classes removed:</span>{" "}
                      <Badge variant="secondary">{cleanupMutation.data?.classesRemoved || 0}</Badge>
                    </div>
                    <div>
                      <span className="font-medium">Styles removed:</span>{" "}
                      <Badge variant="secondary">{cleanupMutation.data?.stylesRemoved || 0}</Badge>
                    </div>
                    <div>
                      <span className="font-medium">Shortcodes removed:</span>{" "}
                      <Badge variant="secondary">{cleanupMutation.data?.shortcodesRemoved || 0}</Badge>
                    </div>
                    <div>
                      <span className="font-medium">Empty tags removed:</span>{" "}
                      <Badge variant="secondary">{cleanupMutation.data?.emptyTagsRemoved || 0}</Badge>
                    </div>
                  </div>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {cleanupMutation.isError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {cleanupMutation.error instanceof Error 
                  ? cleanupMutation.error.message 
                  : "Failed to clean up articles"}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="bg-muted/50">
        <CardHeader>
          <CardTitle className="text-sm">What gets cleaned?</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <ul className="list-disc list-inside space-y-1">
            <li>WordPress block classes: wp-block-image, wp-block-paragraph, etc.</li>
            <li>Alignment classes: alignleft, alignright, aligncenter, alignnone</li>
            <li>Size classes: size-full, size-large, size-medium, size-thumbnail</li>
            <li>State classes: has-text-color, has-background, has-drop-cap</li>
            <li>Inline font styles: font-family, font-size, color, font-weight</li>
            <li>WordPress shortcodes: [caption]...[/caption], [gallery], etc.</li>
            <li>Empty HTML tags with no content or only whitespace</li>
            <li>Excessive line breaks and whitespace</li>
          </ul>
          <p className="pt-2 text-xs italic">
            Note: text-align styles are preserved as they represent intentional alignment choices.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
