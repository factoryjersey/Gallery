import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Loader2, Download, Image as ImageIcon } from "lucide-react";

interface ImageAnalysisData {
  totalArticles: number;
  totalImagesUsed: number;
  usedImageUrls: string[];
  usedPaths: string[];
  pathsByYear: Record<string, string[]>;
  summary: {
    totalImages: number;
    byYear: Record<string, number>;
  };
}

export function ImageAnalysis() {
  const { data, isLoading, error } = useQuery<ImageAnalysisData>({
    queryKey: ['/api/admin/image-analysis'],
  });

  const downloadReport = () => {
    if (!data) return;

    const report = {
      generatedAt: new Date().toISOString(),
      summary: data.summary,
      totalArticles: data.totalArticles,
      totalImagesUsed: data.totalImagesUsed,
      usedImagePaths: data.usedPaths,
      usedImageUrls: data.usedImageUrls,
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `image-usage-report-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          Failed to load image analysis. Please try again.
        </AlertDescription>
      </Alert>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Image Usage Analysis</h2>
          <p className="text-muted-foreground">
            Analyze which images are used across all articles
          </p>
        </div>
        <Button onClick={downloadReport} data-testid="button-download-report">
          <Download className="mr-2 h-4 w-4" />
          Download Report
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Articles Analyzed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold" data-testid="text-total-articles">
              {data.totalArticles.toLocaleString()}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Unique Images Used
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold" data-testid="text-total-images">
              {data.totalImagesUsed.toLocaleString()}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Years Covered
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold" data-testid="text-years-covered">
              {Object.keys(data.summary.byYear).length}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5" />
            Images by Year
          </CardTitle>
          <CardDescription>
            Distribution of images across different years
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Object.entries(data.summary.byYear)
              .sort(([a], [b]) => b.localeCompare(a))
              .map(([year, count]) => (
                <div key={year} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="font-medium w-20" data-testid={`text-year-${year}`}>
                      {year}
                    </span>
                    <div className="h-2 bg-muted rounded-full w-64">
                      <div
                        className="h-2 bg-primary rounded-full transition-all"
                        style={{
                          width: `${(count / data.totalImagesUsed) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                  <span className="text-muted-foreground" data-testid={`text-count-${year}`}>
                    {count.toLocaleString()} images
                  </span>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>How to Use This Report</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-sm text-muted-foreground">
            <h4 className="font-semibold text-foreground mb-2">Step 1: Download the Report</h4>
            <p>
              Click "Download Report" to get a JSON file with all image paths currently used in your articles.
            </p>
          </div>
          
          <div className="text-sm text-muted-foreground">
            <h4 className="font-semibold text-foreground mb-2">Step 2: Compare with R2 Bucket</h4>
            <p>
              List all files in your R2 bucket at <code className="bg-muted px-1 py-0.5 rounded">
                https://pub-3b96f5fc8ba0456f9ffd861fc06e5e97.r2.dev
              </code>
            </p>
          </div>

          <div className="text-sm text-muted-foreground">
            <h4 className="font-semibold text-foreground mb-2">Step 3: Identify Unused Images</h4>
            <p>
              Compare the report's <code className="bg-muted px-1 py-0.5 rounded">usedImagePaths</code> array with your R2 file list. 
              Any files in R2 that are NOT in the report can be safely removed.
            </p>
          </div>

          <Alert>
            <AlertDescription>
              <strong>Pro Tip:</strong> The report includes both full URLs and relative paths. 
              Use the <code className="bg-muted px-1 py-0.5 rounded">usedPaths</code> array to match against your R2 directory structure.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
}
