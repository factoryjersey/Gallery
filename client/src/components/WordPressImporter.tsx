import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { 
  Upload, 
  FileText, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Download,
  Code
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface ImportResult {
  success: boolean;
  message: string;
  results: {
    articles: number;
    categories: number;
    tags: number;
    authors: number;
    errors: string[];
  };
}

export default function WordPressImporter() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const importMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('xmlFile', file);
      
      const response = await fetch('/api/import/wordpress', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error(`Import failed: ${response.statusText}`);
      }
      
      return response.json();
    },
    onSuccess: (result: ImportResult) => {
      setImportResult(result);
      queryClient.invalidateQueries({ queryKey: ["/api/articles"] });
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      
      toast({
        title: "Import Completed",
        description: `Successfully imported ${result.results.articles} articles`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Import Failed",
        description: error.message || "Failed to import WordPress content",
        variant: "destructive",
      });
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === "text/xml") {
      setSelectedFile(file);
      setImportResult(null);
    } else {
      toast({
        title: "Invalid File",
        description: "Please select a valid XML file",
        variant: "destructive",
      });
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    
    const files = e.dataTransfer.files;
    const file = files[0];
    
    if (file && file.type === "text/xml") {
      setSelectedFile(file);
      setImportResult(null);
    } else {
      toast({
        title: "Invalid File",
        description: "Please select a valid XML file",
        variant: "destructive",
      });
    }
  };

  const handleImport = () => {
    if (selectedFile) {
      importMutation.mutate(selectedFile);
    }
  };

  const resetImporter = () => {
    setSelectedFile(null);
    setImportResult(null);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2" data-testid="importer-title">
            <Code className="h-6 w-6 text-blue-600" />
            WordPress Content Import
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Instructions */}
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Export your WordPress content as XML from your WordPress admin dashboard 
              (Tools → Export → All content) and upload the file here to import articles, 
              categories, and authors.
            </AlertDescription>
          </Alert>

          {/* File Upload Area */}
          {!selectedFile && !importResult && (
            <div 
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
                dragOver 
                  ? "border-primary bg-primary/5" 
                  : "border-border hover:border-primary hover:bg-muted/50"
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => document.getElementById('xml-file-input')?.click()}
              data-testid="file-drop-zone"
            >
              <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">Upload WordPress XML File</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Drag and drop your XML file here, or click to browse
              </p>
              <p className="text-xs text-muted-foreground">
                Supports WordPress export XML files (WXR format)
              </p>
              
              <Input
                id="xml-file-input"
                type="file"
                accept=".xml"
                onChange={handleFileSelect}
                className="hidden"
                data-testid="xml-file-input"
              />
            </div>
          )}

          {/* Selected File */}
          {selectedFile && !importResult && (
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileText className="h-8 w-8 text-primary" />
                  <div>
                    <p className="font-medium" data-testid="selected-file-name">
                      {selectedFile.name}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    onClick={resetImporter}
                    data-testid="cancel-import"
                  >
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleImport}
                    disabled={importMutation.isPending}
                    data-testid="start-import"
                  >
                    {importMutation.isPending ? "Importing..." : "Start Import"}
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {/* Progress */}
          {importMutation.isPending && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Importing content...</span>
                <span className="text-sm text-muted-foreground">Please wait</span>
              </div>
              <Progress value={undefined} className="h-2" data-testid="import-progress" />
            </div>
          )}

          {/* Import Results */}
          {importResult && (
            <div className="space-y-4" data-testid="import-results">
              <Alert className={importResult.success ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}>
                {importResult.success ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-600" />
                )}
                <AlertDescription className={importResult.success ? "text-green-800" : "text-red-800"}>
                  {importResult.message}
                </AlertDescription>
              </Alert>

              {importResult.success && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card className="p-4 text-center">
                    <div className="text-2xl font-bold text-primary" data-testid="imported-articles-count">
                      {importResult.results.articles}
                    </div>
                    <div className="text-sm text-muted-foreground">Articles</div>
                  </Card>
                  <Card className="p-4 text-center">
                    <div className="text-2xl font-bold text-primary" data-testid="imported-categories-count">
                      {importResult.results.categories}
                    </div>
                    <div className="text-sm text-muted-foreground">Categories</div>
                  </Card>
                  <Card className="p-4 text-center">
                    <div className="text-2xl font-bold text-primary" data-testid="imported-tags-count">
                      {importResult.results.tags}
                    </div>
                    <div className="text-sm text-muted-foreground">Tags</div>
                  </Card>
                  <Card className="p-4 text-center">
                    <div className="text-2xl font-bold text-primary" data-testid="imported-authors-count">
                      {importResult.results.authors}
                    </div>
                    <div className="text-sm text-muted-foreground">Authors</div>
                  </Card>
                </div>
              )}

              {importResult.results.errors.length > 0 && (
                <Card className="p-4">
                  <h4 className="font-semibold mb-2 text-orange-800">Import Warnings:</h4>
                  <div className="space-y-1" data-testid="import-errors">
                    {importResult.results.errors.slice(0, 5).map((error, index) => (
                      <p key={index} className="text-sm text-orange-700">
                        • {error}
                      </p>
                    ))}
                    {importResult.results.errors.length > 5 && (
                      <p className="text-sm text-muted-foreground">
                        ... and {importResult.results.errors.length - 5} more warnings
                      </p>
                    )}
                  </div>
                </Card>
              )}

              <div className="flex justify-center">
                <Button onClick={resetImporter} data-testid="import-another">
                  Import Another File
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Help Section */}
      <Card>
        <CardHeader>
          <CardTitle>How to Export from WordPress</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="list-decimal list-inside space-y-2 text-sm">
            <li>Login to your WordPress admin dashboard</li>
            <li>Go to <Badge variant="outline">Tools → Export</Badge></li>
            <li>Select <Badge variant="outline">All content</Badge> to export everything</li>
            <li>Click <Badge variant="outline">Download Export File</Badge></li>
            <li>Upload the downloaded XML file using the form above</li>
          </ol>
          
          <Alert className="mt-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Note:</strong> Images and media files will not be imported. You'll need to 
              re-upload them manually or use the media library after import.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
}
