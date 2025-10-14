import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Loader2, Database, HardDrive, Trash2, CheckCircle, AlertTriangle } from "lucide-react";
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

interface StorageAnalysis {
  totalFiles: number;
  totalSize: number;
  byType: {
    original: { count: number; size: number };
    thumbnail: { count: number; size: number };
    medium: { count: number; size: number };
    large: { count: number; size: number };
  };
  indexed: number;
  unindexed: number;
}

export function MediaIndexing() {
  const { toast } = useToast();
  const [indexingStats, setIndexingStats] = useState<any>(null);

  const { data: analysisData, isLoading: isAnalyzing, refetch: refetchAnalysis } = useQuery<{ analysis: StorageAnalysis }>({
    queryKey: ["/api/media/storage-analysis"],
  });

  const indexBucketMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/media/index-bucket");
      return response.json();
    },
    onSuccess: (data) => {
      setIndexingStats(data.stats);
      toast({
        title: "Indexing Complete!",
        description: `Indexed ${data.stats.indexed} images, skipped ${data.stats.skipped}`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/media"] });
      refetchAnalysis();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to index bucket",
        variant: "destructive",
      });
    },
  });

  const cleanupVariantsMutation = useMutation({
    mutationFn: async (variantType: string) => {
      const response = await apiRequest("POST", "/api/media/cleanup-variants", { variantType });
      return response.json();
    },
    onSuccess: (data, variantType) => {
      toast({
        title: "Cleanup Complete!",
        description: `Deleted ${data.deleted} ${variantType} images`,
      });
      refetchAnalysis();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to cleanup variants",
        variant: "destructive",
      });
    },
  });

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <div className="space-y-6">
      {/* Indexing Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Index R2/GCS Images
          </CardTitle>
          <CardDescription>
            Scan your cloud storage bucket and add unindexed images to the media library
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {indexingStats && (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                Last indexing: Scanned {indexingStats.total} files, indexed {indexingStats.indexed} new images, 
                skipped {indexingStats.skipped}, errors: {indexingStats.errors}
              </AlertDescription>
            </Alert>
          )}
          
          <Button 
            onClick={() => indexBucketMutation.mutate()} 
            disabled={indexBucketMutation.isPending}
            data-testid="button-index-bucket"
          >
            {indexBucketMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <Database className="mr-2 h-4 w-4" />
            Index All Images
          </Button>
        </CardContent>
      </Card>

      {/* Storage Analysis */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HardDrive className="h-5 w-5" />
            Storage Analysis
          </CardTitle>
          <CardDescription>
            View storage usage breakdown by image variant type
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isAnalyzing ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : analysisData ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="border rounded-lg p-4">
                  <p className="text-sm text-muted-foreground">Total Files</p>
                  <p className="text-2xl font-bold">{analysisData.analysis.totalFiles}</p>
                </div>
                <div className="border rounded-lg p-4">
                  <p className="text-sm text-muted-foreground">Total Size</p>
                  <p className="text-2xl font-bold">{formatBytes(analysisData.analysis.totalSize)}</p>
                </div>
                <div className="border rounded-lg p-4">
                  <p className="text-sm text-muted-foreground">Indexed in Library</p>
                  <p className="text-2xl font-bold">{analysisData.analysis.indexed}</p>
                </div>
                <div className="border rounded-lg p-4">
                  <p className="text-sm text-muted-foreground">Unindexed</p>
                  <p className="text-2xl font-bold">{analysisData.analysis.unindexed}</p>
                </div>
              </div>

              {analysisData.analysis.unindexed > 0 && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    You have {analysisData.analysis.unindexed} unindexed images. Click "Index All Images" above to add them to the media library.
                  </AlertDescription>
                </Alert>
              )}

              <div className="border rounded-lg p-4 space-y-3">
                <h3 className="font-semibold">Storage by Variant Type</h3>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Original Images</span>
                    <span className="text-sm font-medium">
                      {analysisData.analysis.byType.original.count} files ({formatBytes(analysisData.analysis.byType.original.size)})
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Thumbnails (300px)</span>
                    <span className="text-sm font-medium">
                      {analysisData.analysis.byType.thumbnail.count} files ({formatBytes(analysisData.analysis.byType.thumbnail.size)})
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Medium (800px)</span>
                    <span className="text-sm font-medium">
                      {analysisData.analysis.byType.medium.count} files ({formatBytes(analysisData.analysis.byType.medium.size)})
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Large (1200px)</span>
                    <span className="text-sm font-medium">
                      {analysisData.analysis.byType.large.count} files ({formatBytes(analysisData.analysis.byType.large.size)})
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">No analysis data available</p>
          )}
        </CardContent>
      </Card>

      {/* Cleanup Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5" />
            Cleanup Image Variants
          </CardTitle>
          <CardDescription>
            Delete specific image variant sizes to free up storage space
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert className="mb-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Warning: This will permanently delete the selected variant files from cloud storage. 
              Original images will not be affected.
            </AlertDescription>
          </Alert>

          <div className="space-y-3">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" disabled={cleanupVariantsMutation.isPending} data-testid="button-delete-thumbnails">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete All Thumbnails
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete All Thumbnail Variants?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will delete all thumbnail (300px) images from cloud storage. 
                    This action cannot be undone. Original images will remain intact.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => cleanupVariantsMutation.mutate('thumbnail')}>
                    Delete Thumbnails
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" disabled={cleanupVariantsMutation.isPending} data-testid="button-delete-medium">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete All Medium Variants
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete All Medium Variants?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will delete all medium (800px) images from cloud storage. 
                    This action cannot be undone. Original images will remain intact.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => cleanupVariantsMutation.mutate('medium')}>
                    Delete Medium Variants
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" disabled={cleanupVariantsMutation.isPending} data-testid="button-delete-large">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete All Large Variants
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete All Large Variants?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will delete all large (1200px) images from cloud storage. 
                    This action cannot be undone. Original images will remain intact.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => cleanupVariantsMutation.mutate('large')}>
                    Delete Large Variants
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
