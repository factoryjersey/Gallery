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
  Heading,
  ArrowUp,
  ArrowDown,
  Upload as UploadIcon,
  Trash2,
  Sparkles,
  Loader2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import AuthorPicker from "@/components/AuthorPicker";
import ContributorsPicker, { type CreditEntry } from "@/components/ContributorsPicker";
import TipTapEditor from "@/components/TipTapEditor";
import { apiRequest } from "@/lib/queryClient";

const articleSchema = z.object({
  title: z.string().min(1, "Title is required"),
  slug: z.string().min(1, "Slug is required"),
  excerpt: z.string().optional(),
  content: z.string().min(1, "Content is required"),
  categoryId: z.string().min(1, "Category is required"),
  authorId: z.string().min(1, "Author is required"),
  photographer: z.string().optional(),
  illustrator: z.string().optional(),
  status: z.enum(["draft", "published"]),
  contentType: z.enum(["article", "cartoon", "gallery"]).default("article"),
  featuredImage: z.string().optional(),
  splashImage: z.string().optional(),
  galleryImages: z.array(z.object({ url: z.string(), caption: z.string().optional() })).optional(),
  metaTitle: z.string().optional(),
  metaDescription: z.string().optional(),
  readTime: z.number().min(1).default(5),
  // Print edition this article appeared in. References issues.number — kept
  // as a nullable integer rather than an FK so the import can attach the
  // number even when the issue row doesn't exist yet.
  issueNumber: z.number().int().nullable().optional(),
  homepageHighlight: z.boolean().optional(),
});

type ArticleFormData = z.infer<typeof articleSchema>;

interface ArticleEditorProps {
  articleId?: string;
  onClose?: () => void;
}

export default function ArticleEditor({ articleId, onClose }: ArticleEditorProps) {
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState("");
  const [credits, setCredits] = useState<CreditEntry[]>([]);
  // True once the user types something into the slug field themselves —
  // we stop auto-generating from the title at that point so we don't
  // overwrite a deliberate slug choice.
  const [slugTouched, setSlugTouched] = useState(false);
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  // Tracks the in-flight AI excerpt request so the button can show a
  // spinner and double-click is debounced.
  const [generatingExcerpt, setGeneratingExcerpt] = useState(false);

  const form = useForm<ArticleFormData>({
    resolver: zodResolver(articleSchema),
    defaultValues: {
      status: "draft",
      contentType: "article",
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

  const { data: creditSuggestions } = useQuery<{ photographers: string[]; illustrators: string[] }>({
    queryKey: ["/api/articles/credit-suggestions"],
  });

  const { data: issuesData } = useQuery<{
    issues: Array<{ id: string; number: number; title: string | null; displayLabel: string | null }>;
  }>({
    queryKey: ["/api/issues"],
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
        photographer: article.photographer || "",
        illustrator: article.illustrator || "",
        status: article.status,
        contentType: article.contentType || "article",
        featuredImage: article.featuredImage || "",
        splashImage: article.splashImage || "",
        galleryImages: Array.isArray(article.galleryImages) ? article.galleryImages : [],
        metaTitle: article.metaTitle || "",
        metaDescription: article.metaDescription || "",
        readTime: article.readTime,
        issueNumber: typeof article.issueNumber === "number" ? article.issueNumber : null,
        homepageHighlight: !!article.homepageHighlight,
      });
      setSelectedTags(article.tags?.map((t: any) => t.id) || []);
      // The article already has a slug, so treat the field as touched —
      // editing the title shouldn't overwrite the existing URL.
      setSlugTouched(true);
    }
  }, [articleData, form]);

  // Load existing contributor credits when editing an article
  const { data: creditsData } = useQuery<{
    credits: Array<{ id: string; name: string; slug: string; role: string }>;
  }>({
    queryKey: [`/api/articles/${articleId}/contributors`],
    enabled: !!articleId,
  });
  useEffect(() => {
    if (creditsData?.credits) {
      setCredits(
        creditsData.credits.map((c) => ({
          contributorId: c.id,
          name: c.name,
          slug: c.slug,
          role: c.role,
        })),
      );
    }
  }, [creditsData]);

  // After an article is saved (create or update), persist its credits to
  // the contributors join. Runs once we know the article id.
  async function persistCredits(savedArticleId: string) {
    try {
      await apiRequest("PUT", `/api/articles/${savedArticleId}/contributors`, {
        credits: credits.map((c, i) => ({
          contributorId: c.contributorId,
          role: c.role,
          displayOrder: i,
        })),
      });
    } catch (err) {
      console.error("Failed to save credits:", err);
      toast({
        title: "Credits not saved",
        description: err instanceof Error ? err.message : "Could not save photographer/illustrator credits.",
        variant: "destructive",
      });
    }
  }

  const createArticleMutation = useMutation({
    mutationFn: async (data: ArticleFormData & { tags?: string[] }) => {
      const response = await apiRequest("POST", "/api/articles", data);
      return response.json();
    },
    onSuccess: async (data) => {
      if (data?.article?.id) await persistCredits(data.article.id);
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
      const response = await apiRequest("PUT", `/api/articles/${articleId}`, data);
      return response.json();
    },
    onSuccess: async () => {
      if (articleId) await persistCredits(articleId);
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

  const deleteArticleMutation = useMutation({
    mutationFn: async () => {
      if (!articleId) throw new Error("No article id");
      const res = await apiRequest("DELETE", `/api/articles/${articleId}`);
      return res;
    },
    onSuccess: () => {
      toast({ title: "Article deleted" });
      queryClient.invalidateQueries({
        predicate: (q) => typeof q.queryKey[0] === "string" && (q.queryKey[0] as string).startsWith("/api/articles"),
      });
      onClose?.();
    },
    onError: (err: any) => {
      toast({
        title: "Delete failed",
        description: err?.message || "Could not delete article.",
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

    // Auto-populate the slug from the title as long as the user hasn't
    // manually edited it yet. Previously this only fired when the slug
    // was empty, which meant the slug stopped tracking after the first
    // keystroke; now it follows the full title until the user takes
    // control of the slug field.
    if (!slugTouched) {
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
    
    // For gallery type, don't compute read time from image-heavy HTML
    if (form.getValues("contentType") === "gallery") {
      form.setValue("readTime", 1);
      return;
    }
    const wordCount = content.replace(/<[^>]*>/g, " ").split(/\s+/).filter(Boolean).length;
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

  const handleImageUpload = async (file: File, target: "featuredImage" | "splashImage" = "featuredImage") => {
    let uploadSucceeded = false;
    try {
      const formData = new FormData();
      formData.append('image', file);

      const response = await fetch("/api/media/upload", {
        method: "POST",
        body: formData,
        credentials: "include",
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
      const imageUrl = data.media?.urls?.original ||
                       data.media?.variants?.original ||
                       data.media?.objectPath;

      if (!imageUrl) {
        console.error("No image URL in response:", data);
        throw new Error("No image URL returned");
      }

      form.setValue(target, imageUrl);
      uploadSucceeded = true;

      toast({
        title: "Image uploaded",
        description:
          target === "splashImage"
            ? "Splash image has been uploaded successfully."
            : "Featured image has been uploaded successfully.",
      });
    } catch (error) {
      console.error("Upload error:", error);
      if (!uploadSucceeded) {
        toast({
          title: "Upload failed",
          description: error instanceof Error ? error.message : "Failed to upload image. Please try again.",
          variant: "destructive",
        });
      }
    }
  };

  const handleGalleryUpload = async (files: FileList | File[]) => {
    const list = Array.from(files);
    if (list.length === 0) return;
    const uploaded: { url: string }[] = [];
    for (const file of list) {
      try {
        const formData = new FormData();
        formData.append("image", file);
        const response = await fetch("/api/media/upload", { method: "POST", body: formData, credentials: "include" });
        if (!response.ok) throw new Error("Upload failed");
        const data = await response.json();
        const url =
          data.media?.urls?.original || data.media?.variants?.original || data.media?.objectPath;
        if (url) uploaded.push({ url });
      } catch (err) {
        console.error("Gallery upload failed for", file.name, err);
      }
    }
    if (uploaded.length === 0) {
      toast({ title: "Upload failed", description: "No images uploaded.", variant: "destructive" });
      return;
    }
    const existing = form.getValues("galleryImages") || [];
    form.setValue("galleryImages", [...existing, ...uploaded], { shouldDirty: true });
    toast({
      title: `Added ${uploaded.length} image${uploaded.length === 1 ? "" : "s"} to gallery`,
    });
  };

  const moveGalleryImage = (from: number, to: number) => {
    const current = form.getValues("galleryImages") || [];
    if (to < 0 || to >= current.length) return;
    const next = [...current];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    form.setValue("galleryImages", next, { shouldDirty: true });
  };

  const removeGalleryImage = (i: number) => {
    const current = form.getValues("galleryImages") || [];
    form.setValue("galleryImages", current.filter((_, idx) => idx !== i), { shouldDirty: true });
  };

  const updateGalleryCaption = (i: number, caption: string) => {
    const current = form.getValues("galleryImages") || [];
    const next = current.map((img, idx) => (idx === i ? { ...img, caption } : img));
    form.setValue("galleryImages", next, { shouldDirty: true });
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

  // AI excerpt drafting — calls the server's Claude Haiku endpoint with
  // the current title + content and drops the result into the Excerpt
  // textarea. Editor still tweaks before save, so this is best-effort
  // rather than authoritative.
  const handleGenerateExcerpt = async () => {
    const title = form.getValues("title")?.trim();
    const content = form.getValues("content")?.trim();
    if (!title) {
      toast({
        title: "Add a title first",
        description: "The model needs a headline to write around.",
        variant: "destructive",
      });
      return;
    }
    if (!content || content.replace(/<[^>]+>/g, "").trim().length < 80) {
      toast({
        title: "Not enough body copy yet",
        description: "Write a paragraph or two and try again.",
        variant: "destructive",
      });
      return;
    }
    setGeneratingExcerpt(true);
    try {
      const res = await apiRequest("POST", "/api/admin/generate-excerpt", {
        title,
        content,
      });
      const data = await res.json();
      if (!data?.excerpt) throw new Error(data?.error || "No excerpt returned");
      form.setValue("excerpt", data.excerpt, { shouldDirty: true });
      toast({
        title: "Excerpt drafted",
        description: "Edit as needed before saving.",
      });
    } catch (error: any) {
      toast({
        title: "Couldn't draft an excerpt",
        description: error?.message || "Try again in a moment.",
        variant: "destructive",
      });
    } finally {
      setGeneratingExcerpt(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Create New Article</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            // Stop Enter from auto-submitting the whole article from any
            // text input — only Save Draft / Publish should trigger a save.
            // Textareas keep their normal Enter-for-newline behaviour.
            onKeyDown={(e) => {
              const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
              if (e.key === "Enter" && tag === "input") {
                e.preventDefault();
              }
            }}
            className="space-y-6"
          >
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
                  {...form.register("slug", {
                    onChange: () => setSlugTouched(true),
                  })}
                  data-testid="article-slug-input"
                />
                {form.formState.errors.slug && (
                  <p className="text-sm text-destructive">{form.formState.errors.slug.message}</p>
                )}
              </div>
            </div>

            {/* Content Type */}
            <div className="space-y-2">
              <Label>Content Type</Label>
              <Select
                value={form.watch("contentType")}
                onValueChange={(value) => form.setValue("contentType", value as "article" | "cartoon" | "gallery")}
                data-testid="content-type-select"
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select content type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="article">Article</SelectItem>
                  <SelectItem value="gallery">Gallery (Paparazzi / Photo grid)</SelectItem>
                  <SelectItem value="cartoon">Cartoon</SelectItem>
                </SelectContent>
              </Select>
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
                <AuthorPicker
                  value={form.watch("authorId")}
                  onChange={(id) => form.setValue("authorId", id, { shouldValidate: true })}
                />
                {form.formState.errors.authorId && (
                  <p className="text-sm text-destructive">{form.formState.errors.authorId.message}</p>
                )}
              </div>
            </div>

            {/* Print edition this article appeared in. Optional — many
                online-only articles don't have one. */}
            <div className="space-y-2">
              <Label htmlFor="issue-number">Issue (print edition, optional)</Label>
              <Select
                value={form.watch("issueNumber") == null ? "none" : String(form.watch("issueNumber"))}
                onValueChange={(v) =>
                  form.setValue("issueNumber", v === "none" ? null : Number(v), {
                    shouldDirty: true,
                  })
                }
              >
                <SelectTrigger id="issue-number" className="w-full max-w-sm" data-testid="article-issue-select">
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None — online only</SelectItem>
                  {(issuesData?.issues ?? [])
                    .slice()
                    .sort((a, b) => b.number - a.number)
                    .map((iss) => (
                      <SelectItem key={iss.id} value={String(iss.number)}>
                        Gallery #{iss.number}
                        {iss.displayLabel ? ` — ${iss.displayLabel}` : iss.title ? ` — ${iss.title}` : ""}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>

              {/* Promote to the homepage Latest Highlights hero band (only
                  effective for the latest issue; older issues' flagged
                  articles fall back to category sections). */}
              <label className="flex items-center gap-2 mt-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={!!form.watch("homepageHighlight")}
                  onChange={(e) =>
                    form.setValue("homepageHighlight", e.target.checked, { shouldDirty: true })
                  }
                  className="h-4 w-4"
                  data-testid="article-homepage-highlight"
                />
                <span className="text-sm">
                  Show in homepage <strong>Latest Highlights</strong> hero
                  <span className="text-muted-foreground ml-1">
                    (only used when this article is in the current issue)
                  </span>
                </span>
              </label>
            </div>

            {/* Credits — managed via the contributors table so each
                photographer / illustrator is a proper person with a
                profile page. */}
            <div className="space-y-2">
              <Label>Credits</Label>
              <ContributorsPicker
                value={credits}
                onChange={setCredits}
              />
            </div>

            {/* Tags */}
            <div className="space-y-2">
              <Label>Tags</Label>
              <div className="flex gap-2 mb-2">
                <Input
                  placeholder="Add tag"
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      // Prevent the form's default Enter-to-submit from firing
                      // — previously this would trigger the article mutation
                      // with whatever status was set, sometimes auto-publishing
                      // a draft.
                      e.preventDefault();
                      e.stopPropagation();
                      addTag();
                    }
                  }}
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
                      handleImageUpload(file, "featuredImage");
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

            {/* Splash Image — optional, higher-res for the homepage intro */}
            <div className="space-y-2">
              <Label>Splash Image (optional)</Label>
              <p className="text-xs text-muted-foreground -mt-1">
                Upload a higher-resolution image (ideally ≥ 1920×1080, portrait or
                landscape) used when this article appears in the homepage splash
                intro. Falls back to the featured image if not set.
              </p>
              <div className="flex gap-4 items-start">
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      handleImageUpload(file, "splashImage");
                    }
                  }}
                  data-testid="splash-image-input"
                />
                {form.watch("splashImage") ? (
                  <div className="flex items-center gap-2">
                    <img
                      src={form.watch("splashImage")}
                      alt="Splash preview"
                      className="h-10 w-16 object-cover border border-border"
                    />
                    <button
                      type="button"
                      className="text-xs underline text-muted-foreground hover:text-foreground"
                      onClick={() => form.setValue("splashImage", "")}
                      data-testid="splash-image-clear"
                    >
                      Clear
                    </button>
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground self-center">
                    Not set — splash will use the featured image
                  </div>
                )}
              </div>
            </div>

            {/* Image Gallery — sliding carousel rendered on the article page */}
            <div className="space-y-2">
              <Label>Image Gallery (optional)</Label>
              <p className="text-xs text-muted-foreground -mt-1">
                Upload one or more images to attach a sliding gallery to this article.
                Drag-and-drop reorder via the arrow buttons. Captions are optional.
              </p>

              <div className="flex gap-4 items-start">
                <Input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      handleGalleryUpload(e.target.files);
                      e.target.value = "";
                    }
                  }}
                  data-testid="gallery-image-input"
                />
                <span className="text-xs text-muted-foreground self-center whitespace-nowrap">
                  {(form.watch("galleryImages")?.length ?? 0)} image
                  {(form.watch("galleryImages")?.length ?? 0) === 1 ? "" : "s"}
                </span>
              </div>

              {(form.watch("galleryImages")?.length ?? 0) > 0 && (
                <div className="space-y-2 mt-2">
                  {(form.watch("galleryImages") || []).map((img, i, arr) => (
                    <div
                      key={`${img.url}-${i}`}
                      className="flex gap-3 items-start p-2 border border-border rounded"
                      data-testid={`gallery-item-${i}`}
                    >
                      <img
                        src={img.url}
                        alt={img.caption || `Gallery image ${i + 1}`}
                        className="h-16 w-24 object-cover border border-border shrink-0"
                      />
                      <div className="flex-1 min-w-0 space-y-1">
                        <Input
                          placeholder="Caption (optional)"
                          value={img.caption || ""}
                          onChange={(e) => updateGalleryCaption(i, e.target.value)}
                          className="text-sm"
                          data-testid={`gallery-caption-${i}`}
                        />
                        <div className="text-xs text-muted-foreground truncate" title={img.url}>
                          {img.url}
                        </div>
                      </div>
                      <div className="flex flex-col gap-1 shrink-0">
                        <button
                          type="button"
                          className="p-1 hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed"
                          onClick={() => moveGalleryImage(i, i - 1)}
                          disabled={i === 0}
                          title="Move up"
                          data-testid={`gallery-up-${i}`}
                        >
                          <ArrowUp className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          className="p-1 hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed"
                          onClick={() => moveGalleryImage(i, i + 1)}
                          disabled={i === arr.length - 1}
                          title="Move down"
                          data-testid={`gallery-down-${i}`}
                        >
                          <ArrowDown className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          className="p-1 hover:bg-destructive hover:text-destructive-foreground"
                          onClick={() => removeGalleryImage(i)}
                          title="Remove"
                          data-testid={`gallery-remove-${i}`}
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Content Editor — TipTap WYSIWYG. HTML output drops straight
                into the existing articles.content column; old WordPress
                imports parse cleanly because TipTap reads <h2>, <img>,
                <blockquote>, etc. natively. */}
            <div className="space-y-2">
              <Label>Content</Label>
              <TipTapEditor
                value={form.watch("content") || ""}
                onChange={(html) => form.setValue("content", html, { shouldDirty: true })}
                placeholder="Start writing your article — use the toolbar to add headings, lists, links, or insert an image at the cursor."
                onUpload={async (file) => {
                  const formData = new FormData();
                  formData.append("image", file);
                  try {
                    const res = await fetch("/api/media/upload", { method: "POST", body: formData, credentials: "include" });
                    if (!res.ok) throw new Error(`Upload failed: ${res.status} ${res.statusText}`);
                    const data = await res.json();
                    return (
                      data.media?.urls?.original ||
                      data.media?.variants?.original ||
                      data.media?.objectPath ||
                      null
                    );
                  } catch (err) {
                    toast({
                      title: "Image upload failed",
                      description: err instanceof Error ? err.message : "Unknown error",
                      variant: "destructive",
                    });
                    return null;
                  }
                }}
              />
              {form.formState.errors.content && (
                <p className="text-sm text-destructive">{form.formState.errors.content.message}</p>
              )}
            </div>

            {/* Excerpt — has a "Draft with AI" button that calls Claude
                Haiku via /api/admin/generate-excerpt. Output drops into
                this field; the editor still edits before save. */}
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="excerpt">Excerpt (Optional)</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleGenerateExcerpt}
                  disabled={generatingExcerpt}
                  className="h-7 gap-1.5 text-xs"
                  data-testid="article-excerpt-generate"
                  title="Draft an excerpt from the title + body using Claude Haiku"
                >
                  {generatingExcerpt ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5" />
                  )}
                  {generatingExcerpt ? "Drafting…" : "Draft with AI"}
                </Button>
              </div>
              <Textarea
                id="excerpt"
                placeholder="Brief summary of the article — or click 'Draft with AI' to generate one from the body."
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
                <Button
                  type="button"
                  variant="outline"
                  disabled={!form.watch("slug")}
                  title={
                    form.watch("slug")
                      ? "Open this article in a new tab"
                      : "Save the article first so it has a URL to preview"
                  }
                  onClick={() => {
                    const slug = form.getValues("slug");
                    if (slug) window.open(`/article/${slug}`, "_blank", "noopener,noreferrer");
                  }}
                  data-testid="preview-button"
                >
                  <Eye className="h-4 w-4 mr-2" />
                  Preview
                </Button>
                {articleId && (
                  <Button
                    type="button"
                    variant="ghost"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    disabled={deleteArticleMutation.isPending}
                    onClick={() => {
                      if (
                        window.confirm(
                          "Delete this article permanently? This cannot be undone.",
                        )
                      ) {
                        deleteArticleMutation.mutate();
                      }
                    }}
                    data-testid="delete-article-button"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    {deleteArticleMutation.isPending ? "Deleting…" : "Delete"}
                  </Button>
                )}
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
