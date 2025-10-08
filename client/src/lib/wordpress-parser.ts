export interface WordPressPost {
  id: number;
  title: string;
  content: string;
  excerpt: string;
  slug: string;
  status: 'publish' | 'draft' | 'private';
  publishDate: Date;
  author: string;
  categories: string[];
  tags: string[];
  featuredImage?: string;
  customFields: Record<string, any>;
}

export interface WordPressCategory {
  id: number;
  name: string;
  slug: string;
  description: string;
  parent?: string;
}

export interface WordPressTag {
  id: number;
  name: string;
  slug: string;
  description: string;
}

export interface WordPressAuthor {
  id: number;
  username: string;
  email: string;
  displayName: string;
  firstName?: string;
  lastName?: string;
}

export interface ParsedWordPressData {
  posts: WordPressPost[];
  categories: WordPressCategory[];
  tags: WordPressTag[];
  authors: WordPressAuthor[];
  errors: string[];
}

export class WordPressParser {
  private xmlDoc: Document;
  private errors: string[] = [];

  constructor(xmlContent: string) {
    const parser = new DOMParser();
    this.xmlDoc = parser.parseFromString(xmlContent, 'application/xml');
    
    // Check for parse errors
    const parseError = this.xmlDoc.querySelector('parsererror');
    if (parseError) {
      throw new Error('Invalid XML format');
    }
  }

  private getTextContent(element: Element | null, tagName: string): string {
    if (!element) return '';
    const node = element.querySelector(tagName);
    return node?.textContent || '';
  }

  private getAttributeValue(element: Element | null, tagName: string, attribute: string): string {
    if (!element) return '';
    const node = element.querySelector(tagName);
    return node?.getAttribute(attribute) || '';
  }

  private parseCategories(): WordPressCategory[] {
    const categories: WordPressCategory[] = [];
    const categoryNodes = this.xmlDoc.querySelectorAll('wp\\:category, category');

    categoryNodes.forEach((node, index) => {
      try {
        const category: WordPressCategory = {
          id: parseInt(this.getTextContent(node, 'wp:term_id') || '0'),
          name: this.getTextContent(node, 'wp:cat_name'),
          slug: this.getTextContent(node, 'wp:category_nicename'),
          description: this.getTextContent(node, 'wp:category_description'),
          parent: this.getTextContent(node, 'wp:category_parent') || undefined,
        };

        if (category.name) {
          categories.push(category);
        }
      } catch (error) {
        this.errors.push(`Error parsing category ${index + 1}: ${error.message}`);
      }
    });

    return categories;
  }

  private parseTags(): WordPressTag[] {
    const tags: WordPressTag[] = [];
    const tagNodes = this.xmlDoc.querySelectorAll('wp\\:tag, tag');

    tagNodes.forEach((node, index) => {
      try {
        const tag: WordPressTag = {
          id: parseInt(this.getTextContent(node, 'wp:term_id') || '0'),
          name: this.getTextContent(node, 'wp:tag_name'),
          slug: this.getTextContent(node, 'wp:tag_slug'),
          description: this.getTextContent(node, 'wp:tag_description'),
        };

        if (tag.name) {
          tags.push(tag);
        }
      } catch (error) {
        this.errors.push(`Error parsing tag ${index + 1}: ${error.message}`);
      }
    });

    return tags;
  }

  private parseAuthors(): WordPressAuthor[] {
    const authors: WordPressAuthor[] = [];
    const authorNodes = this.xmlDoc.querySelectorAll('wp\\:author, author');

    authorNodes.forEach((node, index) => {
      try {
        const author: WordPressAuthor = {
          id: parseInt(this.getTextContent(node, 'wp:author_id') || '0'),
          username: this.getTextContent(node, 'wp:author_login'),
          email: this.getTextContent(node, 'wp:author_email'),
          displayName: this.getTextContent(node, 'wp:author_display_name'),
          firstName: this.getTextContent(node, 'wp:author_first_name') || undefined,
          lastName: this.getTextContent(node, 'wp:author_last_name') || undefined,
        };

        if (author.username) {
          authors.push(author);
        }
      } catch (error) {
        this.errors.push(`Error parsing author ${index + 1}: ${error.message}`);
      }
    });

    return authors;
  }

  private parsePosts(): WordPressPost[] {
    const posts: WordPressPost[] = [];
    const itemNodes = this.xmlDoc.querySelectorAll('item');

    itemNodes.forEach((node, index) => {
      try {
        const postType = this.getTextContent(node, 'wp:post_type');
        
        // Only process posts, not pages or other post types
        if (postType !== 'post') return;

        const post: WordPressPost = {
          id: parseInt(this.getTextContent(node, 'wp:post_id') || '0'),
          title: this.getTextContent(node, 'title'),
          content: this.getTextContent(node, 'content:encoded'),
          excerpt: this.getTextContent(node, 'excerpt:encoded'),
          slug: this.getTextContent(node, 'wp:post_name'),
          status: this.getTextContent(node, 'wp:status') as 'publish' | 'draft' | 'private',
          publishDate: new Date(this.getTextContent(node, 'pubDate') || Date.now()),
          author: this.getTextContent(node, 'dc:creator'),
          categories: [],
          tags: [],
          customFields: {},
        };

        // Parse categories
        const categoryNodes = node.querySelectorAll('category[domain="category"]');
        categoryNodes.forEach(catNode => {
          const catName = catNode.textContent?.trim();
          if (catName) {
            post.categories.push(catName);
          }
        });

        // Parse tags
        const tagNodes = node.querySelectorAll('category[domain="post_tag"]');
        tagNodes.forEach(tagNode => {
          const tagName = tagNode.textContent?.trim();
          if (tagName) {
            post.tags.push(tagName);
          }
        });

        // Parse custom fields
        const customFieldNodes = node.querySelectorAll('wp\\:postmeta, postmeta');
        customFieldNodes.forEach(fieldNode => {
          const key = this.getTextContent(fieldNode, 'wp:meta_key');
          const value = this.getTextContent(fieldNode, 'wp:meta_value');
          if (key && value) {
            post.customFields[key] = value;
            
            // Check for featured image
            if (key === '_thumbnail_id') {
              post.featuredImage = value;
            }
          }
        });

        if (post.title) {
          posts.push(post);
        }
      } catch (error) {
        this.errors.push(`Error parsing post ${index + 1}: ${error.message}`);
      }
    });

    return posts;
  }

  public parse(): ParsedWordPressData {
    this.errors = []; // Reset errors

    try {
      const posts = this.parsePosts();
      const categories = this.parseCategories();
      const tags = this.parseTags();
      const authors = this.parseAuthors();

      return {
        posts,
        categories,
        tags,
        authors,
        errors: this.errors,
      };
    } catch (error) {
      throw new Error(`Failed to parse WordPress XML: ${error.message}`);
    }
  }

  public static validateXML(xmlContent: string): boolean {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(xmlContent, 'application/xml');
      
      // Check for parse errors
      const parseError = doc.querySelector('parsererror');
      if (parseError) return false;

      // Check if it's a WordPress export file
      const rss = doc.querySelector('rss');
      const channel = doc.querySelector('channel');
      const generator = doc.querySelector('generator');
      
      return !!(rss && channel && generator?.textContent?.includes('wordpress'));
    } catch {
      return false;
    }
  }

  public static estimateImportSize(xmlContent: string): {
    posts: number;
    categories: number;
    tags: number;
    authors: number;
  } {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(xmlContent, 'application/xml');

      const posts = doc.querySelectorAll('item').length;
      const categories = doc.querySelectorAll('wp\\:category, category').length;
      const tags = doc.querySelectorAll('wp\\:tag, tag').length;
      const authors = doc.querySelectorAll('wp\\:author, author').length;

      return { posts, categories, tags, authors };
    } catch {
      return { posts: 0, categories: 0, tags: 0, authors: 0 };
    }
  }
}

// Utility functions for content processing
export const cleanWordPressContent = (content: string): string => {
  return content
    // Remove WordPress shortcodes
    .replace(/\[.*?\]/g, '')
    // Clean up HTML
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    // Convert WordPress image captions
    .replace(/\[caption[^\]]*\](.*?)\[\/caption\]/g, '$1')
    // Clean up extra whitespace
    .replace(/\n\s*\n/g, '\n\n')
    .trim();
};

export const generateSlug = (title: string): string => {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/[\s_-]+/g, '-') // Replace spaces and underscores with hyphens
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
};

export const calculateReadTime = (content: string): number => {
  const plainText = content.replace(/<[^>]*>/g, ''); // Strip HTML
  const wordCount = plainText.split(/\s+/).length;
  return Math.max(1, Math.ceil(wordCount / 200)); // Assume 200 words per minute
};
