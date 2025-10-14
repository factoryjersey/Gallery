import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Loader2, Upload, ExternalLink, Copy, Trash2 } from "lucide-react";
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
  const { toast } = useToast();

  const { data: mediaData, isLoading } = useQuery<{ media: Media[] }>({
    queryKey: ["/api/media"],
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
    if (media.variants?.medium) {
      return `/objects/${media.variants.medium}`;
    }
    return `/objects/${media.objectPath}`;
  };

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
          <CardTitle>Media Library</CardTitle>
          <CardDescription>
            View and manage all uploaded images
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : !mediaData?.media || mediaData.media.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No images uploaded yet</p>
          ) : (
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
                                <Button variant="outline" size="sm" onClick={() => copyToClipboard(`/objects/${item.variants.thumbnail}`)}>
                                  Thumbnail
                                </Button>
                              )}
                              {item.variants?.medium && (
                                <Button variant="outline" size="sm" onClick={() => copyToClipboard(`/objects/${item.variants.medium}`)}>
                                  Medium
                                </Button>
                              )}
                              {item.variants?.large && (
                                <Button variant="outline" size="sm" onClick={() => copyToClipboard(`/objects/${item.variants.large}`)}>
                                  Large
                                </Button>
                              )}
                              {item.variants?.original && (
                                <Button variant="outline" size="sm" onClick={() => copyToClipboard(`/objects/${item.variants.original}`)}>
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}
