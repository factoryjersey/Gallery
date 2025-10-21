import { useState, useRef, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Save, 
  Eye, 
  Send, 
  Image as ImageIcon, 
  X,
  Bold,
  Italic,
  Link as LinkIcon,
  List,
  Heading
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

const articleSchema = z.object({
  title: z.string().min(1, "Title is required"),
  slug: z.string().min(1, "Slug is required"),
  excerpt: z.string().optional(),
  content: z.string().min(1, "Content is required"),
  categoryId: z.string().min(1, "Category is required"),
  authorId: z.string().min(1, "Author is required"),
  status: z.enum(["draft", "published"]),
  featuredImage: z.string().optional(),
  metaTitle: z.string().optional(),
  metaDescription: z.string().optional(),
  readTime: z.number().min(1).default(5),
});

type ArticleFormData = z.infer<typeof articleSchema>;

interface ArticleEditorProps {
  articleId?: string;
  onClose?: () => void;
}

export default function ArticleEditor({ articleId, onClose }: ArticleEditorProps) {
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState("");
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<ArticleFormData>({
    resolver: zodResolver(articleSchema),
    defaultValues: {
      status: "draft",
      readTime: 5,
    },
  });

  // Load article data when editing
  const { data: articleData } = useQuery<{ article: any }>({
    queryKey: [`/api/articles/${articleId}`],
    enabled: !!articleId,
  });

  const { data: categoriesData } = useQuery<{ categories: any[] }>({
    queryKey: ["/api/categories"],
  });

  const { data: authorsData } = useQuery<{ authors: any[] }>({
    queryKey: ["/api/authors"],
  });

  const { data: tagsData } = useQuery<{ tags: any[] }>({
    queryKey: ["/api/tags"],
  });

  // Populate form when editing
  useEffect(() => {
    if (articleData?.article) {
      const article = articleData.article;
      form.reset({
        title: article.title,
        slug: article.slug,
        excerpt: article.excerpt || "",
        content: article.content,
        categoryId: article.categoryId,
        authorId: article.authorId,
        status: article.status,
        featuredImage: article.featuredImage || "",
        metaTitle: article.metaTitle || "",
        metaDescription: article.metaDescription || "",
        readTime: article.readTime,
      });
      setSelectedTags(article.tags?.map((t: any) => t.id) || []);
    }
  }, [articleData, form]);

  const createArticleMutation = useMutation({
    mutationFn: async (data: ArticleFormData & { tags?: string[] }) => {
      const response = await apiRequest("POST", "/api/articles", data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success!",
        description: "Article created successfully.",
      });
      // Invalidate all article queries by matching keys that start with /api/articles
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === 'string' && key.startsWith('/api/articles');
        }
      });
      form.reset();
      setSelectedTags([]);
      onClose?.();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create article",
        variant: "destructive",
      });
    },
  });

  const updateArticleMutation = useMutation({
    mutationFn: async (data: ArticleFormData & { tags?: string[] }) => {
      const response = await apiRequest("PATCH", `/api/articles/${articleId}`, data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success!",
        description: "Article updated successfully.",
      });
      // Invalidate all article queries by matching keys that start with /api/articles
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === 'string' && key.startsWith('/api/articles');
        }
      });
      onClose?.();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update article",
        variant: "destructive",
      });
    },
  });

  const createMediaMutation = useMutation({
    mutationFn: async (mediaData: any) => {
      const response = await apiRequest("POST", "/api/media", mediaData);
      return response.json();
    },
  });

  const categories = categoriesData?.categories || [];
  const authors = authorsData?.authors || [];
  const tags = tagsData?.tags || [];

  const generateSlug = (title: string) => {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const title = e.target.value;
    form.setValue("title", title);
    
    if (!form.getValues("slug")) {
      form.setValue("slug", generateSlug(title));
    }
    
    // Calculate read time based on content
    const content = form.getValues("content") || "";
    const wordCount = content.split(/\s+/).length;
    const readTime = Math.max(1, Math.ceil(wordCount / 200));
    form.setValue("readTime", readTime);
  };

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const content = e.target.value;
    form.setValue("content", content);
    
    // Update read time
    const wordCount = content.split(/\s+/).length;
    const readTime = Math.max(1, Math.ceil(wordCount / 200));
    form.setValue("readTime", readTime);
  };

  const insertTextAtCursor = (text: string) => {
    const textarea = contentRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentContent = form.getValues("content") || "";
    
    const newContent = currentContent.substring(0, start) + text + currentContent.substring(end);
    form.setValue("content", newContent);
    
    // Update read time
    const wordCount = newContent.split(/\s+/).length;
    const readTime = Math.max(1, Math.ceil(wordCount / 200));
    form.setValue("readTime", readTime);
  };

  const addTag = () => {
    if (newTag.trim() && !selectedTags.includes(newTag.trim())) {
      setSelectedTags([...selectedTags, newTag.trim()]);
      setNewTag("");
    }
  };

  const removeTag = (tagToRemove: string) => {
    setSelectedTags(selectedTags.filter(tag => tag !== tagToRemove));
  };

  const handleImageUpload = async (file: File) => {
    let uploadSucceeded = false;
    try {
      const formData = new FormData();
      formData.append('image', file);
      
      const response = await fetch("/api/media/upload", {
        method: "POST",
        body: formData,
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("Upload failed:", errorText);
        throw new Error("Upload failed");
      }
      
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const responseText = await response.text();
        console.error("Expected JSON, got:", responseText.substring(0, 200));
        throw new Error("Invalid response format");
      }
      
      const data = await response.json();
      // Try multiple paths to get the image URL
      const imageUrl = data.media?.urls?.original || 
                       data.media?.variants?.original || 
                       data.media?.objectPath;
      
      if (!imageUrl) {
        console.error("No image URL in response:", data);
        throw new Error("No image URL returned");
      }
      
      console.log("Setting featured image:", imageUrl);
      
      // Set as featured image
      form.setValue("featuredImage", imageUrl);
      uploadSucceeded = true;
      
      toast({
        title: "Image uploaded",
        description: "Featured image has been uploaded successfully.",
      });
    } catch (error) {
      console.error("Upload error:", error);
      // Only show error toast if upload actually failed
      if (!uploadSucceeded) {
        toast({
          title: "Upload failed",
          description: error instanceof Error ? error.message : "Failed to upload image. Please try again.",
          variant: "destructive",
        });
      }
    }
  };

  const onSubmit = (data: ArticleFormData) => {
    if (articleId) {
      updateArticleMutation.mutate({
        ...data,
        tags: selectedTags,
      });
    } else {
      createArticleMutation.mutate({
        ...data,
        tags: selectedTags,
      });
    }
  };

  const handleSaveAsDraft = () => {
    form.setValue("status", "draft");
    form.handleSubmit(onSubmit)();
  };

  const handlePublish = () => {
    form.setValue("status", "published");
    form.handleSubmit(onSubmit)();
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Create New Article</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Basic Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="title">Article Title</Label>
                <Input
                  id="title"
                  placeholder="Enter article title..."
                  {...form.register("title")}
                  onChange={handleTitleChange}
                  data-testid="article-title-input"
                />
                {form.formState.errors.title && (
                  <p className="text-sm text-destructive">{form.formState.errors.title.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="slug">URL Slug</Label>
                <Input
                  id="slug"
                  placeholder="article-url-slug"
                  {...form.register("slug")}
                  data-testid="article-slug-input"
                />
                {form.formState.errors.slug && (
                  <p className="text-sm text-destructive">{form.formState.errors.slug.message}</p>
                )}
              </div>
            </div>

            {/* Category and Author */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select onValueChange={(value) => form.setValue("categoryId", value)} data-testid="article-category-select">
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.formState.errors.categoryId && (
                  <p className="text-sm text-destructive">{form.formState.errors.categoryId.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Author</Label>
                <Select onValueChange={(value) => form.setValue("authorId", value)} data-testid="article-author-select">
                  <SelectTrigger>
                    <SelectValue placeholder="Select author" />
                  </SelectTrigger>
                  <SelectContent>
                    {authors.map((author) => (
                      <SelectItem key={author.id} value={author.id}>
                        {author.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.formState.errors.authorId && (
                  <p className="text-sm text-destructive">{form.formState.errors.authorId.message}</p>
                )}
              </div>
            </div>

            {/* Tags */}
            <div className="space-y-2">
              <Label>Tags</Label>
              <div className="flex gap-2 mb-2">
                <Input
                  placeholder="Add tag"
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), addTag())}
                  data-testid="tag-input"
                />
                <Button type="button" onClick={addTag} size="sm" data-testid="add-tag-button">
                  Add
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {selectedTags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="flex items-center gap-1" data-testid={`tag-${tag}`}>
                    {tag}
                    <X className="h-3 w-3 cursor-pointer" onClick={() => removeTag(tag)} />
                  </Badge>
                ))}
              </div>
            </div>

            {/* Featured Image */}
            <div className="space-y-2">
              <Label>Featured Image</Label>
              <div className="flex gap-4 items-start">
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      handleImageUpload(file);
                    }
                  }}
                  data-testid="featured-image-input"
                />
                {form.watch("featuredImage") && (
                  <div className="text-sm text-muted-foreground">
                    ✓ Featured image uploaded
                  </div>
                )}
              </div>
            </div>

            {/* Content Editor */}
            <div className="space-y-2">
              <Label>Content</Label>
              <div className="border border-input rounded-lg overflow-hidden">
                {/* Toolbar */}
                <div className="bg-muted border-b border-border px-3 py-2 flex items-center space-x-2 flex-wrap">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => insertTextAtCursor("**Bold Text**")}
                    data-testid="toolbar-bold"
                  >
                    <Bold className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => insertTextAtCursor("*Italic Text*")}
                    data-testid="toolbar-italic"
                  >
                    <Italic className="h-4 w-4" />
                  </Button>
                  <Separator orientation="vertical" className="h-6" />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => insertTextAtCursor("# Heading\n")}
                    data-testid="toolbar-heading"
                  >
                    <Heading className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => insertTextAtCursor("[Link Text](URL)")}
                    data-testid="toolbar-link"
                  >
                    <LinkIcon className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => insertTextAtCursor("- List item\n")}
                    data-testid="toolbar-list"
                  >
                    <List className="h-4 w-4" />
                  </Button>
                </div>
                
                <Textarea
                  ref={contentRef}
                  placeholder="Start writing your article..."
                  className="min-h-[300px] border-0 focus-visible:ring-0"
                  value={form.watch("content") || ""}
                  onChange={handleContentChange}
                  data-testid="article-content-textarea"
                />
              </div>
              {form.formState.errors.content && (
                <p className="text-sm text-destructive">{form.formState.errors.content.message}</p>
              )}
            </div>

            {/* Excerpt */}
            <div className="space-y-2">
              <Label htmlFor="excerpt">Excerpt (Optional)</Label>
              <Textarea
                id="excerpt"
                placeholder="Brief summary of the article..."
                rows={3}
                {...form.register("excerpt")}
                data-testid="article-excerpt-textarea"
              />
            </div>

            {/* SEO Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">SEO Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="metaTitle">Meta Title</Label>
                  <Input
                    id="metaTitle"
                    placeholder="SEO-optimized title"
                    {...form.register("metaTitle")}
                    data-testid="meta-title-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="metaDescription">Meta Description</Label>
                  <Textarea
                    id="metaDescription"
                    placeholder="Description for search engines..."
                    rows={2}
                    {...form.register("metaDescription")}
                    data-testid="meta-description-textarea"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <div className="flex items-center justify-between pt-4 border-t border-border">
              <div className="flex items-center space-x-3">
                <Button type="button" variant="outline" data-testid="preview-button">
                  <Eye className="h-4 w-4 mr-2" />
                  Preview
                </Button>
                <span className="text-sm text-muted-foreground">
                  Read time: {form.watch("readTime")} min
                </span>
              </div>
              <div className="flex items-center space-x-3">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={handleSaveAsDraft}
                  disabled={createArticleMutation.isPending}
                  data-testid="save-draft-button"
                >
                  <Save className="h-4 w-4 mr-2" />
                  Save Draft
                </Button>
                <Button 
                  type="button" 
                  onClick={handlePublish}
                  disabled={createArticleMutation.isPending}
                  data-testid="publish-button"
                >
                  <Send className="h-4 w-4 mr-2" />
                  {createArticleMutation.isPending ? "Publishing..." : "Publish Article"}
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
