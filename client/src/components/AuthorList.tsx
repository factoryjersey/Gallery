import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { PlusCircle, Pencil, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Author {
  id: string;
  name: string;
  email: string;
  bio?: string;
  avatar?: string;
}

export default function AuthorList() {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAuthor, setEditingAuthor] = useState<Author | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    bio: "",
  });

  const { data: authorsData, isLoading } = useQuery<{ authors: Author[] }>({
    queryKey: ["/api/authors"],
  });

  const createMutation = useMutation({
    mutationFn: (data: { name: string; email: string; bio: string }) =>
      apiRequest("/api/authors", "POST", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/authors"] });
      toast({ title: "Author created successfully" });
      setIsDialogOpen(false);
      resetForm();
    },
    onError: () => {
      toast({ 
        title: "Failed to create author", 
        variant: "destructive" 
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { name: string; email: string; bio: string } }) =>
      apiRequest(`/api/authors/${id}`, "PUT", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/authors"] });
      toast({ title: "Author updated successfully" });
      setIsDialogOpen(false);
      resetForm();
    },
    onError: () => {
      toast({ 
        title: "Failed to update author", 
        variant: "destructive" 
      });
    },
  });

  const deleteAuthorMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/api/authors/${id}`, "DELETE", {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/authors"] });
      toast({ title: "Author deleted successfully" });
    },
    onError: () => {
      toast({ 
        title: "Failed to delete author", 
        variant: "destructive" 
      });
    },
  });

  const resetForm = () => {
    setFormData({ name: "", email: "", bio: "" });
    setEditingAuthor(null);
  };

  const handleEdit = (author: Author) => {
    setEditingAuthor(author);
    setFormData({
      name: author.name,
      email: author.email,
      bio: author.bio || "",
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email) {
      toast({ 
        title: "Please fill in required fields", 
        variant: "destructive" 
      });
      return;
    }
    
    if (editingAuthor) {
      updateMutation.mutate({ id: editingAuthor.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const authors = authorsData?.authors || [];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Authors</CardTitle>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => resetForm()} data-testid="button-add-author">
                <PlusCircle className="h-4 w-4 mr-2" />
                Add Author
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingAuthor ? "Edit Author" : "Add New Author"}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="name">Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Author name"
                    data-testid="input-author-name"
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="author@example.com"
                    data-testid="input-author-email"
                  />
                </div>
                <div>
                  <Label htmlFor="bio">Bio</Label>
                  <Textarea
                    id="bio"
                    value={formData.bio}
                    onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                    placeholder="Short bio about the author"
                    rows={3}
                    data-testid="input-author-bio"
                  />
                </div>
                <div className="flex justify-end space-x-2">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => {
                      setIsDialogOpen(false);
                      resetForm();
                    }}
                    data-testid="button-cancel"
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={createMutation.isPending || updateMutation.isPending}
                    data-testid="button-save-author"
                  >
                    {(createMutation.isPending || updateMutation.isPending) 
                      ? "Saving..." 
                      : editingAuthor 
                        ? "Update Author" 
                        : "Create Author"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-8">Loading authors...</div>
        ) : authors.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No authors found. Click "Add Author" to create one.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Bio</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {authors.map((author) => (
                <TableRow key={author.id} data-testid={`author-row-${author.id}`}>
                  <TableCell className="font-medium">{author.name}</TableCell>
                  <TableCell>{author.email}</TableCell>
                  <TableCell className="max-w-xs truncate">
                    {author.bio || <span className="text-muted-foreground italic">No bio</span>}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(author)}
                        data-testid={`button-edit-author-${author.id}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => {
                          if (confirm(`Delete author "${author.name}"?`)) {
                            deleteAuthorMutation.mutate(author.id);
                          }
                        }}
                        data-testid={`button-delete-author-${author.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
