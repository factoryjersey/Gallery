import { useState } from 'react';
import { Upload, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

interface OptimizedImageUploaderProps {
  onUploadComplete?: (media: any) => void;
  alt?: string;
}

export default function OptimizedImageUploader({ onUploadComplete, alt = '' }: OptimizedImageUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadedImage, setUploadedImage] = useState<any>(null);
  const { toast } = useToast();

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Invalid file type',
        description: 'Please select an image file',
        variant: 'destructive',
      });
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: 'File too large',
        description: 'Please select an image smaller than 10MB',
        variant: 'destructive',
      });
      return;
    }

    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('image', file);
      formData.append('alt', alt);

      const response = await fetch('/api/media/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const data = await response.json();
      setUploadedImage(data.media);
      
      toast({
        title: 'Image uploaded successfully',
        description: 'WebP and responsive variants generated',
      });

      onUploadComplete?.(data.media);
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: 'Upload failed',
        description: 'Failed to upload and process image',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4" data-testid="optimized-image-uploader">
      <div className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg p-6">
        <input
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          disabled={uploading}
          className="hidden"
          id="optimized-image-upload"
          data-testid="image-upload-input"
        />
        
        <label
          htmlFor="optimized-image-upload"
          className="cursor-pointer flex flex-col items-center justify-center"
        >
          {uploading ? (
            <div className="text-center" data-testid="upload-progress">
              <Loader2 className="h-12 w-12 animate-spin text-blue-500 mx-auto mb-2" />
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Processing image...
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                Generating WebP and responsive variants
              </p>
            </div>
          ) : uploadedImage ? (
            <div className="text-center" data-testid="upload-success">
              <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-2" />
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Image uploaded successfully
              </p>
              <Button variant="outline" size="sm" className="mt-2" data-testid="upload-another">
                Upload another
              </Button>
            </div>
          ) : (
            <div className="text-center" data-testid="upload-prompt">
              <Upload className="h-12 w-12 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Click to upload image
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                Auto-generates WebP and responsive sizes
              </p>
            </div>
          )}
        </label>
      </div>

      {uploadedImage && (
        <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4" data-testid="upload-details">
          <h4 className="text-sm font-semibold mb-2">Generated Variants:</h4>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="font-medium">Thumbnail:</span> {uploadedImage.urls?.thumbnail && '✓'}
            </div>
            <div>
              <span className="font-medium">Medium:</span> {uploadedImage.urls?.medium && '✓'}
            </div>
            <div>
              <span className="font-medium">Large:</span> {uploadedImage.urls?.large && '✓'}
            </div>
            <div>
              <span className="font-medium">WebP:</span> {uploadedImage.urls?.webp && '✓'}
            </div>
          </div>
          
          {uploadedImage.urls?.webp && (
            <div className="mt-3">
              <img
                src={uploadedImage.urls.thumbnail}
                alt={uploadedImage.alt || 'Uploaded image'}
                className="max-w-full h-auto rounded"
                data-testid="uploaded-preview"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
