import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Loader2, FileImage, Replace, Trash2, CheckCircle, AlertTriangle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface R2Analysis {
  totalArticles: number;
  totalUrls: number;
  categorized: {
    originals: string[];
    thumbnails: string[];
    medium: string[];
    large: string[];
    pdfs: string[];
    other: string[];
  };
  summary: {
    originals: number;
    variants: number;
    thumbnails: number;
    medium: number;
    large: number;
    pdfs: number;
    other: number;
  };
}

interface DimensionAnalysis {
  totalFiles: number;
  dimensionCounts: Array<{ suffix: string; count: number }>;
  files: Array<{ key: string; width: number; height: number; suffix: string }>;
  summary: {
    totalR2Files: number;
    filesWithDimensions: number;
    uniqueDimensions: number;
  };
}

export function ImageRationalization() {
  const { toast } = useToast();
  const [analysisData, setAnalysisData] = useState<R2Analysis | null>(null);
  const [dimensionData, setDimensionData] = useState<DimensionAnalysis | null>(null);

  const analyzeMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/admin/r2-usage-analysis");
      return response.json();
    },
    onSuccess: (data) => {
      setAnalysisData(data);
      toast({
        title: "Analysis Complete!",
        description: `Found ${data.totalUrls} R2 images across ${data.totalArticles} articles`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to analyze R2 usage",
        variant: "destructive",
      });
    },
  });

  const standardizeMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/admin/standardize-image-urls");
      return response.json();
    },
    onSuccess: (data) => {
      const breakdown = data.breakdown || {};
      const details = [
        breakdown.usedOriginal > 0 && `${breakdown.usedOriginal} original`,
        breakdown.usedLarge > 0 && `${breakdown.usedLarge} large`,
        breakdown.usedMedium > 0 && `${breakdown.usedMedium} medium`,
        breakdown.keptVariant > 0 && `${breakdown.keptVariant} kept as-is`
      ].filter(Boolean).join(', ');
      
      toast({
        title: "URLs Standardized!",
        description: `Updated ${data.articlesUpdated} articles, replaced ${data.urlsReplaced} URLs. Used: ${details || 'none'}`,
      });
      analyzeMutation.mutate();
      queryClient.invalidateQueries({ queryKey: ["/api/articles"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to standardize URLs",
        variant: "destructive",
      });
    },
  });

  const analyzeDimensionsMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/admin/analyze-dimension-suffixes");
      return response.json();
    },
    onSuccess: (data) => {
      setDimensionData(data);
      toast({
        title: "Analysis Complete!",
        description: `Found ${data.totalFiles} files with WordPress dimension suffixes`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to analyze dimensions",
        variant: "destructive",
      });
    },
  });

  const normalizeDimensionsMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/admin/normalize-dimension-filenames", { updateArticles: true });
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Normalization Complete!",
        description: `Updated ${data.articlesUpdated} articles, normalized ${data.urlsFound} URLs`,
      });
      analyzeDimensionsMutation.mutate();
      queryClient.invalidateQueries({ queryKey: ["/api/articles"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to normalize filenames",
        variant: "destructive",
      });
    },
  });

  const cleanupMutation = useMutation({
    mutationFn: async (variantTypes: string[]) => {
      const response = await apiRequest("POST", "/api/admin/cleanup-r2-variants", { variantTypes });
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Cleanup Complete!",
        description: `Deleted ${data.filesDeleted} variant files from R2 bucket`,
      });
      analyzeMutation.mutate();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to cleanup variants",
        variant: "destructive",
      });
    },
  });

  return (
    <div className="space-y-6">
      {/* Analysis Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileImage className="h-5 w-5" />
            R2 Image Usage Analysis
          </CardTitle>
          <CardDescription>
            Analyze which R2 images are used in articles and categorize by type
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button 
            onClick={() => analyzeMutation.mutate()} 
            disabled={analyzeMutation.isPending}
            data-testid="button-analyze-r2"
          >
            {analyzeMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <FileImage className="mr-2 h-4 w-4" />
            Analyze R2 Usage
          </Button>

          {analysisData && (
            <div className="space-y-4 mt-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="border rounded-lg p-4">
                  <p className="text-sm text-muted-foreground">Originals</p>
                  <p className="text-2xl font-bold">{analysisData.summary.originals}</p>
                </div>
                <div className="border rounded-lg p-4">
                  <p className="text-sm text-muted-foreground">Variants</p>
                  <p className="text-2xl font-bold">{analysisData.summary.variants}</p>
                </div>
                <div className="border rounded-lg p-4">
                  <p className="text-sm text-muted-foreground">PDFs</p>
                  <p className="text-2xl font-bold">{analysisData.summary.pdfs}</p>
                </div>
                <div className="border rounded-lg p-4">
                  <p className="text-sm text-muted-foreground">Total URLs</p>
                  <p className="text-2xl font-bold">{analysisData.totalUrls}</p>
                </div>
              </div>

              <div className="border rounded-lg p-4 space-y-2">
                <h3 className="font-semibold mb-3">Variant Breakdown</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm">Thumbnails (300px)</span>
                    <span className="text-sm font-medium">{analysisData.summary.thumbnails}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Medium (800px)</span>
                    <span className="text-sm font-medium">{analysisData.summary.medium}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Large (1200px)</span>
                    <span className="text-sm font-medium">{analysisData.summary.large}</span>
                  </div>
                </div>
              </div>

              {analysisData.summary.variants > 0 && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    You have {analysisData.summary.variants} variant images. Consider standardizing to originals to reduce storage.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Standardization Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Replace className="h-5 w-5" />
            Standardize Image URLs
          </CardTitle>
          <CardDescription>
            Replace all variant URLs with original/full-size images in article content
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              This will update all articles to use original images instead of thumbnails, medium, or large variants.
              This operation can take a few minutes for thousands of articles.
            </AlertDescription>
          </Alert>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button 
                disabled={standardizeMutation.isPending}
                data-testid="button-standardize-urls"
              >
                {standardizeMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Replace className="mr-2 h-4 w-4" />
                Standardize All URLs
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Standardize Image URLs?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will scan all {analysisData?.totalArticles || '2,823'} articles and replace variant image URLs 
                  (thumbnails, medium, large) with their original full-size versions. This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => standardizeMutation.mutate()}>
                  Standardize URLs
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>

      {/* WordPress Dimension Normalization Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileImage className="h-5 w-5" />
            WordPress Dimension Normalization
          </CardTitle>
          <CardDescription>
            Analyze and normalize WordPress dimension-suffixed filenames (e.g., -1500x1000, -1200x800)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button 
            onClick={() => analyzeDimensionsMutation.mutate()} 
            disabled={analyzeDimensionsMutation.isPending}
            data-testid="button-analyze-dimensions"
          >
            {analyzeDimensionsMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <FileImage className="mr-2 h-4 w-4" />
            Analyze Dimension Suffixes
          </Button>

          {dimensionData && (
            <div className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-muted rounded-lg">
                  <div className="text-2xl font-bold">{dimensionData.totalFiles}</div>
                  <div className="text-sm text-muted-foreground">Files with Dimensions</div>
                </div>
                <div className="p-4 bg-muted rounded-lg">
                  <div className="text-2xl font-bold">{dimensionData.summary.uniqueDimensions}</div>
                  <div className="text-sm text-muted-foreground">Unique Dimension Patterns</div>
                </div>
              </div>

              {dimensionData.dimensionCounts.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Most Common Dimensions:</h4>
                  <div className="space-y-1">
                    {dimensionData.dimensionCounts.slice(0, 5).map(({ suffix, count }) => (
                      <div key={suffix} className="flex justify-between text-sm">
                        <span className="font-mono">{suffix}</span>
                        <span className="text-muted-foreground">{count} files</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {dimensionData.totalFiles > 0 && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Found {dimensionData.totalFiles} WordPress files with dimension suffixes. 
                    Normalizing will strip these dimensions from URLs to use base filenames.
                  </AlertDescription>
                </Alert>
              )}

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button 
                    disabled={normalizeDimensionsMutation.isPending}
                    data-testid="button-normalize-dimensions"
                  >
                    {normalizeDimensionsMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    <Replace className="mr-2 h-4 w-4" />
                    Normalize Filenames
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Normalize WordPress Dimensions?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will scan all articles and remove dimension suffixes (like -1500x1000, -1200x800) from image URLs,
                      replacing them with base filenames. For example: "image-1500x1000.jpg" becomes "image.jpg". 
                      This cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => normalizeDimensionsMutation.mutate()}>
                      Normalize Filenames
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cleanup Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5" />
            Clean Up R2 Variants
          </CardTitle>
          <CardDescription>
            Delete unused variant files from R2 bucket (PDFs will be preserved)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Warning: Before cleaning up, make sure you've standardized URLs above. 
              This will permanently delete variant files from your R2 bucket. Original images and PDFs will be preserved.
            </AlertDescription>
          </Alert>

          <div className="space-y-3">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button 
                  variant="destructive" 
                  disabled={cleanupMutation.isPending}
                  data-testid="button-cleanup-all-variants"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete All Variants
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete All Image Variants?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will delete all thumbnail, medium, and large variant images from your R2 bucket. 
                    Original images and PDFs will be preserved. This action cannot be undone and may take several minutes.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={() => cleanupMutation.mutate(['thumbnail', 'medium', 'large'])}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Delete All Variants
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <div className="text-sm text-muted-foreground">
              Estimated space to free: ~{analysisData ? Math.round(analysisData.summary.variants * 0.3) : '?'} MB 
              (assuming ~300KB average per variant)
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
