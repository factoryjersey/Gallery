import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Loader2, Upload, ExternalLink, Copy, Trash2, FileImage } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface Media {
  id: string;
  filename: string;
  objectPath: string;
  variants: {
    thumbnail?: string;
    medium?: string;
    large?: string;
    original?: string;
  } | null;
  createdAt: string;
}

export function MediaManager() {
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const { toast } = useToast();

  const { data: mediaData, isLoading } = useQuery<{ 
    media: Media[];
    total: number;
    page: number;
    totalPages: number;
  }>({
    queryKey: ["/api/media", page, search],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        ...(search && { search })
      });
      const response = await fetch(`/api/media?${params}`);
      return response.json();
    }
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast({
        title: "Error",
        description: "Please select a file first",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('image', selectedFile);

      const response = await fetch('/api/media/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const data = await response.json();
      
      toast({
        title: "Success",
        description: "Image uploaded successfully",
      });

      await queryClient.invalidateQueries({ queryKey: ["/api/media"] });
      setSelectedFile(null);
      
      // Reset file input
      const fileInput = document.getElementById('file-upload') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to upload image",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const copyToClipboard = (url: string) => {
    navigator.clipboard.writeText(url);
    toast({
      title: "Copied",
      description: "Image URL copied to clipboard",
    });
  };

  const getImageUrl = (media: Media) => {
    // If objectPath is a full URL (external CDN/R2), use it directly
    if (media.objectPath.startsWith('http')) {
      return media.objectPath;
    }
    
    // If variants exist and medium is a URL, use it
    if (media.variants?.medium && media.variants.medium.startsWith('http')) {
      return media.variants.medium;
    }
    
    // For storage bucket files, use variants or objectPath with /objects prefix
    if (media.variants?.medium) {
      return `/objects/${media.variants.medium}`;
    }
    return `/objects/${media.objectPath}`;
  };

  const indexR2Mutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/admin/index-r2-images");
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Success!",
        description: `Indexed ${data.indexed} images (${data.newlyIndexed} new)`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/media"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to index images",
        variant: "destructive",
      });
    },
  });

  const connectR2Mutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/media/connect-to-r2");
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Success!",
        description: `Updated ${data.imagesReplaced} images in ${data.updates.length} articles. Used ${data.variantsUsed} largest variants.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/media"] });
      queryClient.invalidateQueries({ queryKey: ["/api/articles"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to connect to R2",
        variant: "destructive",
      });
    },
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Upload New Image</CardTitle>
          <CardDescription>
            Upload images to your cloud storage. Images will be automatically optimized and converted to WebP format.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="file-upload">Select Image</Label>
            <Input
              id="file-upload"
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              data-testid="input-media-file"
            />
          </div>
          {selectedFile && (
            <p className="text-sm text-muted-foreground">
              Selected: {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
            </p>
          )}
          <Button 
            onClick={handleUpload} 
            disabled={!selectedFile || uploading}
            data-testid="button-upload-media"
          >
            {uploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <Upload className="mr-2 h-4 w-4" />
            Upload Image
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Index WordPress Images</CardTitle>
          <CardDescription>
            Scan all articles and index R2 images into the media library. This will find images from WordPress imports and make them searchable.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button 
            onClick={() => indexR2Mutation.mutate()}
            disabled={indexR2Mutation.isPending}
            data-testid="button-index-r2-images"
          >
            {indexR2Mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <FileImage className="mr-2 h-4 w-4" />
            {indexR2Mutation.isPending ? 'Indexing Images...' : 'Index Images from Posts'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Connect All Images to R2</CardTitle>
          <CardDescription>
            Replace all GCS paths with R2 URLs. If exact image not found, uses the largest available variant (e.g., Waste2-scaled.jpg instead of Waste2-scaled-150x150.jpg).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button 
            onClick={() => connectR2Mutation.mutate()}
            disabled={connectR2Mutation.isPending}
            variant="secondary"
            data-testid="button-connect-r2"
          >
            {connectR2Mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <ExternalLink className="mr-2 h-4 w-4" />
            {connectR2Mutation.isPending ? 'Connecting to R2...' : 'Connect to R2 Storage'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <CardTitle>Media Library</CardTitle>
              <CardDescription>
                {mediaData?.total ? `${mediaData.total} images` : 'View and manage all uploaded images'}
              </CardDescription>
            </div>
            <div className="w-full md:w-64">
              <Input
                type="search"
                placeholder="Search images..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1); // Reset to page 1 on new search
                }}
                data-testid="input-search-media"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : !mediaData?.media || mediaData.media.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              {search ? 'No images found matching your search' : 'No images uploaded yet'}
            </p>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {mediaData.media.map((item) => (
                <div key={item.id} className="border rounded-lg overflow-hidden group">
                  <div className="aspect-video bg-muted relative">
                    <img
                      src={getImageUrl(item)}
                      alt={item.filename}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="p-3 space-y-2">
                    <p className="text-sm font-medium truncate" title={item.filename}>
                      {item.filename}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(getImageUrl(item))}
                        data-testid={`button-copy-url-${item.id}`}
                      >
                        <Copy className="h-3 w-3 mr-1" />
                        Copy URL
                      </Button>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm" data-testid={`button-view-${item.id}`}>
                            <ExternalLink className="h-3 w-3 mr-1" />
                            View
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-4xl">
                          <DialogHeader>
                            <DialogTitle>{item.filename}</DialogTitle>
                            <DialogDescription>
                              Uploaded {new Date(item.createdAt).toLocaleDateString()}
                            </DialogDescription>
                          </DialogHeader>
                          <img
                            src={getImageUrl(item)}
                            alt={item.filename}
                            className="w-full rounded-lg"
                          />
                          <div className="space-y-2">
                            <p className="text-sm font-medium">Available Variants:</p>
                            <div className="flex flex-wrap gap-2">
                              {item.variants?.thumbnail && (
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  onClick={() => {
                                    const url = item.variants!.thumbnail!.startsWith('http') 
                                      ? item.variants!.thumbnail! 
                                      : `/objects/${item.variants!.thumbnail}`;
                                    copyToClipboard(url);
                                  }}
                                >
                                  Thumbnail
                                </Button>
                              )}
                              {item.variants?.medium && (
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  onClick={() => {
                                    const url = item.variants!.medium!.startsWith('http') 
                                      ? item.variants!.medium! 
                                      : `/objects/${item.variants!.medium}`;
                                    copyToClipboard(url);
                                  }}
                                >
                                  Medium
                                </Button>
                              )}
                              {item.variants?.large && (
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  onClick={() => {
                                    const url = item.variants!.large!.startsWith('http') 
                                      ? item.variants!.large! 
                                      : `/objects/${item.variants!.large}`;
                                    copyToClipboard(url);
                                  }}
                                >
                                  Large
                                </Button>
                              )}
                              {item.variants?.original && (
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  onClick={() => {
                                    const url = item.variants!.original!.startsWith('http') 
                                      ? item.variants!.original! 
                                      : `/objects/${item.variants!.original}`;
                                    copyToClipboard(url);
                                  }}
                                >
                                  Original
                                </Button>
                              )}
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {mediaData && mediaData.totalPages > 1 && (
              <div className="flex items-center justify-between pt-4 border-t">
                <div className="text-sm text-muted-foreground">
                  Page {mediaData.page} of {mediaData.totalPages}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(page - 1)}
                    disabled={page === 1}
                    data-testid="button-prev-page"
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(page + 1)}
                    disabled={page === mediaData.totalPages}
                    data-testid="button-next-page"
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
