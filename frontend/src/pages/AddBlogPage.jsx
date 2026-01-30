import React, { useState, useEffect, Suspense, lazy } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { blogService } from '../services/blogs';
import ErrorBoundary from '../components/ErrorBoundary';
import { 
  Save, 
  Tag, 
  FolderOpen, 
  Image as ImageIcon,
  X,
  Check,
  AlertCircle,
  Loader2,
  Edit,
  Trash2,
  Plus,
  FileText,
  Calendar,
  Eye,
  EyeOff
} from 'lucide-react';

// Lazy load BlockNote editor with error handling
let BlockNoteEditor;
try {
  BlockNoteEditor = lazy(() => import('../components/BlockNoteEditor.jsx'));
} catch (err) {
  console.error('Failed to lazy load BlockNote editor:', err);
  BlockNoteEditor = null;
}

const AddBlogPage = () => {
  const navigate = useNavigate();
  
  const [title, setTitle] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [status, setStatus] = useState('draft');
  const [categories, setCategories] = useState([]);
  const [tags, setTags] = useState('');
  const [categoryInput, setCategoryInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [wordCount, setWordCount] = useState(0);
  const [useBlockEditor, setUseBlockEditor] = useState(false); // Start with false to ensure page renders
  const [content, setContent] = useState('');
  const [blockEditorError, setBlockEditorError] = useState(false);
  const [blockNoteAvailable, setBlockNoteAvailable] = useState(false);
  const [featuredImage, setFeaturedImage] = useState(null);
  const [featuredImagePreview, setFeaturedImagePreview] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewContent, setPreviewContent] = useState('');
  const editorRef = React.useRef(null);
  const fileInputRef = React.useRef(null);
  const lastHTMLContentRef = React.useRef(null); // Store last HTML content from BlockNote
  
  // Admin functionality states
  const [allBlogs, setAllBlogs] = useState([]);
  const [loadingBlogs, setLoadingBlogs] = useState(false);
  const [editingBlogId, setEditingBlogId] = useState(null);
  const [showBlogList, setShowBlogList] = useState(true);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  // Check if BlockNote is available after component mounts
  useEffect(() => {
    if (BlockNoteEditor) {
      setBlockNoteAvailable(true);
      // Optionally auto-enable block editor after a delay
      // setUseBlockEditor(true);
    }
  }, []);

  // Fetch all blogs for admin view
  useEffect(() => {
    fetchAllBlogs();
  }, []);

  const fetchAllBlogs = async () => {
    try {
      setLoadingBlogs(true);
      const response = await blogService.getAllBlogs({ limit: 100 });
      setAllBlogs(response.blogs || []);
    } catch (err) {
      console.error('Error fetching blogs:', err);
    } finally {
      setLoadingBlogs(false);
    }
  };

  const handleWordCountChange = (count) => {
    setWordCount(count);
  };

  const handleContentChange = async (blocks) => {
    // Content changed in BlockNote editor
    // Extract plain text and update content state (same as text editor)
    if (blocks && Array.isArray(blocks)) {
      let plainText = '';
      const extractText = (blockArray) => {
        if (!blockArray || !Array.isArray(blockArray)) return;
        blockArray.forEach(block => {
          if (block.content) {
            if (typeof block.content === 'string') {
              plainText += block.content + '\n';
            } else if (Array.isArray(block.content)) {
              block.content.forEach(item => {
                if (typeof item === 'string') {
                  plainText += item;
                } else if (item && typeof item === 'object' && item.text) {
                  plainText += item.text;
                }
              });
              plainText += '\n';
            }
          }
          if (block.children && Array.isArray(block.children)) {
            extractText(block.children);
          }
        });
      };
      extractText(blocks);
      setContent(plainText.trim());
      
      // Also update stored HTML content for editor switching
      if (editorRef.current && editorRef.current.getContent) {
        try {
          const htmlContent = await editorRef.current.getContent();
          if (htmlContent) {
            lastHTMLContentRef.current = htmlContent;
          }
        } catch (err) {
          console.error('Error updating HTML content ref:', err);
        }
      }
    }
  };

  const handleEditorSwitch = async () => {
    const switchingToBlockEditor = !useBlockEditor;
    
    if (switchingToBlockEditor) {
      // Switching from text editor to BlockNote editor
      // Get current text content and load it into BlockNote
      const textContent = content || '';
      
      // First, check if we have stored HTML content from previous BlockNote session
      let htmlContent = lastHTMLContentRef.current;
      
      if (!htmlContent && textContent.trim()) {
        // No stored HTML, check if content is already HTML (contains HTML tags other than <br />)
        const blockNoteTags = /<(?!br\s*\/?>)[a-z][\s\S]*>/i;
        const isHTML = blockNoteTags.test(textContent);
        
        if (isHTML) {
          // Content is already HTML, use it directly
          htmlContent = textContent;
        } else {
          // Convert plain text to HTML (simple conversion)
          htmlContent = textContent.split('\n').map(line => {
            if (line.trim()) {
              return `<p>${line.trim()}</p>`;
            }
            return '';
          }).filter(p => p).join('');
          
          // If no paragraphs created, create empty paragraph
          if (!htmlContent) {
            htmlContent = '<p></p>';
          }
        }
      } else if (!htmlContent) {
        // No content at all
        htmlContent = '<p></p>';
      }
      
      // Enable block editor first
      setUseBlockEditor(true);
      setBlockEditorError(false);
      
      // Wait for editor to mount, then load content
      const loadContent = async () => {
        let attempts = 0;
        const maxAttempts = 20; // Try for up to 2 seconds
        
        const tryLoad = async () => {
          if (editorRef.current && editorRef.current.loadHTML) {
            const success = await editorRef.current.loadHTML(htmlContent);
            if (success) {
              return true;
            }
          }
          return false;
        };
        
        // Try immediately
        if (await tryLoad()) {
          return;
        }
        
        // Retry with interval
        const interval = setInterval(async () => {
          attempts++;
          if (await tryLoad() || attempts >= maxAttempts) {
            clearInterval(interval);
            if (attempts >= maxAttempts) {
              console.warn('Failed to load content into BlockNote after multiple attempts');
            }
          }
        }, 100);
      };
      
      setTimeout(loadContent, 150);
    } else {
      // Switching from BlockNote editor to text editor
      // Extract content from BlockNote before switching
      if (editorRef.current && editorRef.current.getContent) {
        try {
          // Get HTML content from BlockNote
          const htmlContent = await editorRef.current.getContent();
          
          // Store HTML content for when switching back
          lastHTMLContentRef.current = htmlContent;
          
          if (htmlContent && htmlContent.trim()) {
            // Convert HTML to plain text for text editor
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = htmlContent;
            const plainText = tempDiv.textContent || tempDiv.innerText || '';
            setContent(plainText);
          } else {
            setContent('');
          }
        } catch (err) {
          console.error('Error extracting content from BlockNote:', err);
          // If extraction fails, try to get plain text from blocks
          if (editorRef.current && editorRef.current.getEditor) {
            const editor = editorRef.current.getEditor();
            if (editor && editor.document) {
              let plainText = '';
              const extractText = (blocks) => {
                if (!blocks || !Array.isArray(blocks)) return;
                blocks.forEach(block => {
                  if (block.content) {
                    if (typeof block.content === 'string') {
                      plainText += block.content + '\n';
                    } else if (Array.isArray(block.content)) {
                      block.content.forEach(item => {
                        if (typeof item === 'string') {
                          plainText += item;
                        } else if (item && typeof item === 'object' && item.text) {
                          plainText += item.text;
                        }
                      });
                      plainText += '\n';
                    }
                  }
                  if (block.children && Array.isArray(block.children)) {
                    extractText(block.children);
                  }
                });
              };
              extractText(editor.document);
              setContent(plainText.trim());
              // Try to get HTML as fallback
              try {
                const htmlContent = await editor.blocksToHTMLLossy(editor.document);
                lastHTMLContentRef.current = htmlContent;
              } catch (htmlErr) {
                console.error('Error getting HTML from blocks:', htmlErr);
              }
            }
          }
        }
      }
      
      // Switch to text editor
      setUseBlockEditor(false);
      setBlockEditorError(false);
    }
  };


  const handleAddCategory = () => {
    if (categoryInput.trim() && !categories.includes(categoryInput.trim())) {
      setCategories([...categories, categoryInput.trim()]);
      setCategoryInput('');
    }
  };

  const handleRemoveCategory = (category) => {
    setCategories(categories.filter(c => c !== category));
  };

  const handleSave = async (saveStatus = null) => {
    if (!title.trim()) {
      setError('Please enter a title');
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      // Convert content to HTML - preserve formatting for block editor
      let finalContent = content;
      
      // For block editor, ALWAYS get content from BlockNote editor (not from content state)
      if (useBlockEditor) {
        if (editorRef.current && editorRef.current.getContent) {
          try {
            // Use BlockNote's HTML conversion to preserve all formatting
            const htmlContent = await editorRef.current.getContent();
            if (htmlContent && htmlContent.trim()) {
              finalContent = htmlContent;
            } else {
              // If BlockNote returns empty, try to get blocks directly
              const editor = editorRef.current.getEditor();
              if (editor && editor.document) {
                try {
                  const blocks = editor.document;
                  if (blocks && blocks.length > 0) {
                    finalContent = await editor.blocksToHTMLLossy(blocks);
                  } else {
                    throw new Error('Editor document is empty');
                  }
                } catch (blockErr) {
                  console.error('Error converting blocks to HTML:', blockErr);
                  // Fallback: use content state if available, otherwise empty
                  finalContent = content || '';
                  if (!finalContent) {
                    throw new Error('No content available from BlockNote editor');
                  }
                }
              } else {
                throw new Error('BlockNote editor not available');
              }
            }
          } catch (err) {
            console.error('Error getting content from BlockNote editor:', err);
            // Last resort fallback: try to get plain text from editor
            try {
              const editor = editorRef.current.getEditor();
              if (editor && editor.document) {
                // Extract plain text from blocks as fallback
                let plainText = '';
                const extractText = (blocks) => {
                  if (!blocks || !Array.isArray(blocks)) return;
                  blocks.forEach(block => {
                    if (block.content) {
                      if (typeof block.content === 'string') {
                        plainText += block.content + '\n';
                      } else if (Array.isArray(block.content)) {
                        block.content.forEach(item => {
                          if (typeof item === 'string') {
                            plainText += item;
                          } else if (item && typeof item === 'object' && item.text) {
                            plainText += item.text;
                          }
                        });
                        plainText += '\n';
                      }
                    }
                    if (block.children && Array.isArray(block.children)) {
                      extractText(block.children);
                    }
                  });
                };
                extractText(editor.document);
                finalContent = plainText.trim() || content || '';
              } else {
                finalContent = content || '';
              }
            } catch (fallbackErr) {
              console.error('Error in fallback content extraction:', fallbackErr);
              finalContent = content || '';
            }
            
            if (!finalContent) {
              throw new Error('Unable to retrieve content from editor. Please try again.');
            }
          }
        } else {
          // Editor ref not ready - use content state as fallback
          console.warn('BlockNote editor ref not available, using content state');
          finalContent = content || '';
          if (!finalContent) {
            throw new Error('Editor not ready. Please wait a moment and try again.');
          }
        }
      } else {
        // Text editor: convert plain text to HTML
        finalContent = content ? content.replace(/\n/g, '<br />') : '';
      }

      // Validate that we have content
      if (!finalContent || !finalContent.trim()) {
        setError('Please add some content to your blog post before saving.');
        setSaving(false);
        return;
      }

      // Map 'publish' to 'published' for backend compatibility
      const blogStatus = saveStatus === 'publish' ? 'published' : (saveStatus || status);
      
      const blogData = {
        title: title.trim(),
        content: finalContent,
        excerpt: excerpt.trim(),
        status: blogStatus,
        categories: categories,
        tags: tags.split(',').map(t => t.trim()).filter(t => t),
        word_count: wordCount,
        reading_time: Math.ceil(wordCount / 200),
        featured_image: featuredImagePreview || null
      };

      console.log('Saving blog with data:', { ...blogData, content: '[content hidden]' });
      
      let response;
      if (editingBlogId) {
        // Update existing blog
        response = await blogService.updateBlogPublic(editingBlogId, blogData);
      } else {
        // Create new blog
        response = await blogService.createBlog(blogData);
      }
      
      console.log('Blog save response:', response);
      if (response.blog) {
        console.log('Blog saved successfully with status:', response.blog.status);
        setSuccess(true);
        // Reset form if creating new blog
        if (!editingBlogId) {
          setTitle('');
          setContent('');
          setExcerpt('');
          setCategories([]);
          setTags('');
          setFeaturedImage(null);
          setFeaturedImagePreview(null);
          setStatus('draft');
          if (editorRef.current && editorRef.current.getEditor) {
            const editor = editorRef.current.getEditor();
            if (editor) {
              editor.replaceBlocks(editor.document, []);
            }
          }
        }
        // Refresh blog list
        await fetchAllBlogs();
        setTimeout(() => {
          if (saveStatus === 'publish') {
            // Navigate to blog page - it will auto-refresh
            navigate('/blog');
            window.location.reload();
          } else {
            setSuccess(false);
            if (editingBlogId) {
              setEditingBlogId(null); // Exit edit mode
            }
          }
        }, 1500);
      }
    } catch (err) {
      console.error('Error saving blog:', err);
      setError(err.message || 'Failed to save blog. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = () => {
    handleSave('publish');
  };

  const handleEditBlog = async (blogId) => {
    try {
      setLoadingBlogs(true);
      const blog = allBlogs.find(b => b.id === blogId);
      if (!blog) return;
      
      setEditingBlogId(blog.id);
      setTitle(blog.title || '');
      setExcerpt(blog.excerpt || '');
      setStatus(blog.status || 'draft');
      setCategories(blog.categories || []);
      setTags((blog.tags || []).join(', '));
      setFeaturedImagePreview(blog.featured_image || blog.metadata?.featured_image || null);
      setWordCount(blog.word_count || 0);
      
      // Check if content is HTML (from BlockNote editor)
      // BlockNote generates HTML with tags like <p>, <strong>, <em>, <img>, <h1>, etc.
      // Plain text editor only uses <br /> tags, so we check for BlockNote-specific tags
      const blockNoteTags = /<(p|strong|em|h[1-6]|img|ul|ol|li|blockquote|a|code|pre|div)/i;
      const isHTML = blog.content && blockNoteTags.test(blog.content);
      
      // Clear stored HTML content ref when loading a new blog
      lastHTMLContentRef.current = null;
      
      if (isHTML) {
        // Content is HTML - enable block editor and load it there
        setUseBlockEditor(true);
        setContent(''); // Clear text content state to avoid showing HTML in text editor
        
        // Store HTML content to load after editor mounts
        const htmlContent = blog.content;
        lastHTMLContentRef.current = htmlContent; // Store for editor switching
        
        // Wait for editor to mount, then load content
        const loadContent = async () => {
          let attempts = 0;
          const maxAttempts = 20; // Try for up to 2 seconds (20 * 100ms)
          
          const tryLoad = async () => {
            if (editorRef.current && editorRef.current.loadHTML) {
              const success = await editorRef.current.loadHTML(htmlContent);
              if (success) {
                return true;
              }
            }
            return false;
          };
          
          // Try immediately
          if (await tryLoad()) {
            return;
          }
          
          // Retry with interval
          const interval = setInterval(async () => {
            attempts++;
            if (await tryLoad() || attempts >= maxAttempts) {
              clearInterval(interval);
              if (attempts >= maxAttempts) {
                // Fallback: extract plain text from HTML
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = htmlContent;
                const plainText = tempDiv.textContent || tempDiv.innerText || '';
                setContent(plainText);
                setUseBlockEditor(false); // Fallback to text editor
                console.warn('Failed to load HTML into BlockNote editor, using text editor');
              }
            }
          }, 100);
        };
        
        // Start loading after a short delay to ensure editor is mounted
        setTimeout(loadContent, 150);
      } else {
        // Content is plain text - use text editor
        setUseBlockEditor(false);
        setContent(blog.content || '');
      }
      
      setShowBlogList(false);
      // Scroll to editor
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      console.error('Error loading blog:', err);
      setError('Failed to load blog for editing');
    } finally {
      setLoadingBlogs(false);
    }
  };

  const handleDeleteBlog = async (blogId) => {
    if (!deleteConfirmId || deleteConfirmId !== blogId) {
      setDeleteConfirmId(blogId);
      return;
    }

    try {
      setLoadingBlogs(true);
      await blogService.deleteBlogPublic(blogId);
      await fetchAllBlogs();
      setDeleteConfirmId(null);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
    } catch (err) {
      console.error('Error deleting blog:', err);
      setError('Failed to delete blog');
      setDeleteConfirmId(null);
    } finally {
      setLoadingBlogs(false);
    }
  };

  const handleNewBlog = () => {
    setEditingBlogId(null);
    setTitle('');
    setContent('');
    setExcerpt('');
    setCategories([]);
    setTags('');
    setFeaturedImage(null);
    setFeaturedImagePreview(null);
    setStatus('draft');
    setWordCount(0);
    lastHTMLContentRef.current = null; // Clear stored HTML content
    if (editorRef.current && editorRef.current.getEditor) {
      const editor = editorRef.current.getEditor();
      if (editor) {
        editor.replaceBlocks(editor.document, []);
      }
    }
    setShowBlogList(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleFeaturedImageSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setError('Please select a valid image file (JPEG, PNG, GIF, or WebP)');
      return;
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      setError('File size must be less than 5MB');
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setFeaturedImagePreview(e.target.result);
    };
    reader.readAsDataURL(file);
    setFeaturedImage(file);
  };

  const handleUploadFeaturedImage = async () => {
    if (!featuredImage) {
      setError('Please select an image first');
      return;
    }

    setUploadingImage(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', featuredImage);

      const token = await blogService.getAuthToken();
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      
      const response = await fetch(`${API_URL}/api/media/upload-image`, {
        method: 'POST',
        headers: {
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: formData
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Upload failed' }));
        throw new Error(error.detail || 'Failed to upload image');
      }

      const result = await response.json();
      if (result.success && result.image_url) {
        setFeaturedImagePreview(result.image_url);
        setFeaturedImage(null); // Clear file object, keep preview URL
        setSuccess(true);
        setTimeout(() => setSuccess(false), 2000);
      } else {
        throw new Error('Upload failed - no image URL returned');
      }
    } catch (err) {
      console.error('Error uploading featured image:', err);
      setError(err.message || 'Failed to upload image. Please try again.');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleRemoveFeaturedImage = () => {
    setFeaturedImage(null);
    setFeaturedImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handlePreview = async () => {
    // Get content from editor - preserve formatting for block editor
    let htmlContent = content;
    if (useBlockEditor && editorRef.current) {
      try {
        // Use BlockNote's HTML conversion to preserve all formatting (bold, italic, images, etc.)
        const blockNoteHtml = await editorRef.current.getContent();
        if (blockNoteHtml) {
          htmlContent = blockNoteHtml;
        } else {
          // Fallback to plain text if HTML conversion fails
          htmlContent = content.replace(/\n/g, '<br />');
        }
      } catch (err) {
        console.error('Error getting content for preview:', err);
        htmlContent = content.replace(/\n/g, '<br />');
      }
    } else {
      // Text editor: convert plain text to HTML
      htmlContent = content.replace(/\n/g, '<br />');
    }
    setPreviewContent(htmlContent);
    setShowPreview(true);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  return (
    <div className="min-h-screen bg-gray-50" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif' }}>
      {/* Blog Management Section */}
      {showBlogList && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Blog Management</h1>
                <p className="text-sm text-gray-500 mt-1">Manage all your blog posts (published and draft)</p>
              </div>
              <button
                onClick={handleNewBlog}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-4 h-4 mr-2" />
                New Blog
              </button>
            </div>

            {loadingBlogs ? (
              <div className="p-12 text-center">
                <Loader2 className="w-8 h-8 animate-spin text-gray-400 mx-auto" />
                <p className="text-gray-500 mt-2">Loading blogs...</p>
              </div>
            ) : allBlogs.length === 0 ? (
              <div className="p-12 text-center">
                <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No blogs found. Create your first blog!</p>
                <button
                  onClick={handleNewBlog}
                  className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                >
                  Create Blog
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Categories</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {allBlogs.map((blog) => (
                      <tr key={blog.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            {blog.featured_image || blog.metadata?.featured_image ? (
                              <img 
                                src={blog.featured_image || blog.metadata?.featured_image} 
                                alt={blog.title}
                                className="w-12 h-12 object-cover rounded mr-3"
                              />
                            ) : (
                              <div className="w-12 h-12 bg-gray-200 rounded mr-3 flex items-center justify-center">
                                <FileText className="w-6 h-6 text-gray-400" />
                              </div>
                            )}
                            <div>
                              <div className="text-sm font-medium text-gray-900 line-clamp-1">{blog.title || 'Untitled'}</div>
                              {blog.excerpt && (
                                <div className="text-xs text-gray-500 line-clamp-1 mt-1">{blog.excerpt}</div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            blog.status === 'published' 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {blog.status === 'published' ? (
                              <Eye className="w-3 h-3 mr-1" />
                            ) : (
                              <EyeOff className="w-3 h-3 mr-1" />
                            )}
                            {blog.status || 'draft'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <div className="flex items-center">
                            <Calendar className="w-4 h-4 mr-1" />
                            {formatDate(blog.created_at)}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-wrap gap-1">
                            {(blog.categories || []).slice(0, 2).map((cat, idx) => (
                              <span key={idx} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                {cat}
                              </span>
                            ))}
                            {(blog.categories || []).length > 2 && (
                              <span className="text-xs text-gray-500">+{(blog.categories || []).length - 2}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleEditBlog(blog.id)}
                              className="text-blue-600 hover:text-blue-900 p-1.5 rounded hover:bg-blue-50 transition-colors"
                              title="Edit"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteBlog(blog.id)}
                              className={`p-1.5 rounded transition-colors ${
                                deleteConfirmId === blog.id
                                  ? 'text-red-700 bg-red-100 hover:bg-red-200'
                                  : 'text-red-600 hover:text-red-900 hover:bg-red-50'
                              }`}
                              title={deleteConfirmId === blog.id ? 'Click again to confirm' : 'Delete'}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Editor Section */}
      {!showBlogList && (
        <>
          {/* WordPress-style Header */}
          <div className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex items-center justify-between h-14">
                <div className="flex items-center space-x-4">
                  <button
                    onClick={() => {
                      setShowBlogList(true);
                      setEditingBlogId(null);
                    }}
                    className="text-blue-600 hover:text-blue-700 text-sm"
                  >
                    ← Back to Blog List
                  </button>
                  <h1 className="text-base font-semibold text-gray-900">
                    {editingBlogId ? 'Edit Post' : 'Add New Post'}
                  </h1>
                  {editingBlogId && (
                    <span className="text-xs text-gray-500">({title || 'Untitled'})</span>
                  )}
                </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => handleSave()}
                disabled={saving || !title.trim()}
                className="flex items-center px-3 py-1.5 text-sm font-normal text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-1.5" />
                )}
                Save Draft
              </button>
              <button
                onClick={handlePreview}
                className="flex items-center px-3 py-1.5 text-sm font-normal text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors"
              >
                Preview
              </button>
              <button
                onClick={handlePublish}
                disabled={saving || !title.trim()}
                className="flex items-center px-3 py-1.5 text-sm font-normal text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                ) : (
                  <Check className="w-4 h-4 mr-1.5" />
                )}
                Publish
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Main Editor Area */}
          <div className="flex-1">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              {/* Title Input */}
              <div className="p-6 border-b border-gray-200">
                <input
                  type="text"
                  placeholder="Add title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full text-3xl font-semibold text-gray-900 placeholder-gray-400 border-none outline-none focus:ring-0 bg-transparent"
                  style={{ lineHeight: '1.2' }}
                />
              </div>

              {/* Content Editor */}
              <div className="p-6">
                <div className="min-h-[500px] w-full">
                  {useBlockEditor && BlockNoteEditor && !blockEditorError ? (
                    <ErrorBoundary>
                      <Suspense fallback={
                        <div className="flex items-center justify-center h-64">
                          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
                          <span className="ml-2 text-gray-600">Loading editor...</span>
                        </div>
                      }>
                        <BlockNoteEditor 
                          ref={editorRef}
                          onWordCountChange={handleWordCountChange}
                          onContentChange={handleContentChange}
                        />
                      </Suspense>
                    </ErrorBoundary>
                  ) : (
                    <textarea
                      placeholder="Start writing your blog post here..."
                      value={content}
                      onChange={(e) => {
                        setContent(e.target.value);
                        const words = e.target.value.trim().split(/\s+/).filter(word => word.length > 0);
                        setWordCount(words.length);
                      }}
                      className="w-full min-h-[500px] text-base text-gray-900 placeholder-gray-400 border border-gray-300 rounded-md p-4 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                      style={{ lineHeight: '1.8' }}
                    />
                  )}
                  {blockNoteAvailable && (
                    <div className="mt-2 text-right">
                      <button
                        onClick={handleEditorSwitch}
                        className="text-xs text-blue-600 hover:text-blue-700 underline"
                      >
                        {useBlockEditor ? 'Switch to text editor' : 'Switch to block editor (WordPress-style)'}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Excerpt */}
              <div className="p-6 border-t border-gray-200">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Excerpt
                </label>
                <textarea
                  placeholder="Write an excerpt (optional)"
                  value={excerpt}
                  onChange={(e) => setExcerpt(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 text-sm text-gray-900 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="mt-1 text-xs text-gray-500">
                  A short excerpt from your post.
                </p>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="w-full lg:w-80 space-y-6">
            {/* Publish Box */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="p-4 border-b border-gray-200">
                <h3 className="text-sm font-semibold text-gray-900">Publish</h3>
              </div>
              <div className="p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Status:</span>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="text-sm border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="draft">Draft</option>
                    <option value="publish">Published</option>
                  </select>
                </div>
                <div className="flex items-center justify-between text-sm pt-2 border-t border-gray-200">
                  <span className="text-gray-600">Word count:</span>
                  <span className="font-medium text-gray-900">{wordCount.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Reading time:</span>
                  <span className="font-medium text-gray-900">
                    {Math.ceil(wordCount / 200)} min
                  </span>
                </div>
              </div>
            </div>

            {/* Categories */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="p-4 border-b border-gray-200">
                <h3 className="text-sm font-semibold text-gray-900 flex items-center">
                  <FolderOpen className="w-4 h-4 mr-2" />
                  Categories
                </h3>
              </div>
              <div className="p-4">
                <div className="space-y-3">
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      placeholder="Add new category"
                      value={categoryInput}
                      onChange={(e) => setCategoryInput(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddCategory();
                        }
                      }}
                      className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      onClick={handleAddCategory}
                      className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                    >
                      Add
                    </button>
                  </div>
                  {categories.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {categories.map((category, index) => (
                        <span
                          key={index}
                          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                        >
                          {category}
                          <button
                            onClick={() => handleRemoveCategory(category)}
                            className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full hover:bg-blue-200"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Tags */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="p-4 border-b border-gray-200">
                <h3 className="text-sm font-semibold text-gray-900 flex items-center">
                  <Tag className="w-4 h-4 mr-2" />
                  Tags
                </h3>
              </div>
              <div className="p-4">
                <input
                  type="text"
                  placeholder="Add tags (comma separated)"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="mt-2 text-xs text-gray-500">
                  Separate tags with commas
                </p>
              </div>
            </div>

            {/* Featured Image */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="p-4 border-b border-gray-200">
                <h3 className="text-sm font-semibold text-gray-900 flex items-center">
                  <ImageIcon className="w-4 h-4 mr-2" />
                  Featured Image
                </h3>
              </div>
              <div className="p-4">
                {featuredImagePreview ? (
                  <div className="space-y-3">
                    <div className="relative rounded-lg overflow-hidden border border-gray-200">
                      <img 
                        src={featuredImagePreview} 
                        alt="Featured" 
                        className="w-full h-48 object-cover"
                      />
                    </div>
                    <button
                      onClick={handleRemoveFeaturedImage}
                      className="w-full px-3 py-2 text-sm text-red-600 border border-red-300 rounded hover:bg-red-50 transition-colors"
                    >
                      Remove Image
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                      onChange={handleFeaturedImageSelect}
                      className="hidden"
                      id="featured-image-input"
                    />
                    <label
                      htmlFor="featured-image-input"
                      className="block border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-gray-400 transition-colors cursor-pointer"
                    >
                      <ImageIcon className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                      <p className="text-sm text-gray-500 mb-1">Set featured image</p>
                      <p className="text-xs text-gray-400">Click to upload</p>
                    </label>
                    {featuredImage && (
                      <button
                        onClick={handleUploadFeaturedImage}
                        disabled={uploadingImage}
                        className="w-full px-3 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
                      >
                        {uploadingImage ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Uploading...
                          </>
                        ) : (
                          'Upload Image'
                        )}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Success/Error Messages */}
      {success && (
        <div className="fixed bottom-4 right-4 bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg shadow-lg flex items-center space-x-2 z-50">
          <Check className="w-5 h-5" />
          <span>Blog saved successfully!</span>
        </div>
      )}

      {error && (
        <div className="fixed bottom-4 right-4 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg shadow-lg flex items-center space-x-2 z-50">
          <AlertCircle className="w-5 h-5" />
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            className="ml-4 text-red-600 hover:text-red-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">Blog Preview</h2>
              <button
                onClick={() => setShowPreview(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6">
              {/* Preview Content */}
              <article className="prose prose-lg max-w-none">
                {featuredImagePreview && (
                  <div className="mb-6 -mx-6">
                    <img 
                      src={featuredImagePreview} 
                      alt={title || 'Featured'} 
                      className="w-full h-64 object-cover"
                    />
                  </div>
                )}
                <h1 className="text-4xl font-bold text-gray-900 mb-4">{title || 'Untitled'}</h1>
                {excerpt && (
                  <p className="text-xl text-gray-600 italic mb-6 border-l-4 border-blue-500 pl-4">
                    {excerpt}
                  </p>
                )}
                <div 
                  className="blog-content prose prose-lg max-w-none"
                  dangerouslySetInnerHTML={{ __html: previewContent }}
                  style={{
                    lineHeight: '1.8',
                    color: '#374151'
                  }}
                />
                {(categories.length > 0 || tags) && (
                  <div className="mt-8 pt-6 border-t border-gray-200">
                    {categories.length > 0 && (
                      <div className="mb-4">
                        <span className="text-sm font-semibold text-gray-700 mr-2">Categories:</span>
                        {categories.map((cat, idx) => (
                          <span key={idx} className="inline-block px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm mr-2 mb-2">
                            {cat}
                          </span>
                        ))}
                      </div>
                    )}
                    {tags && (
                      <div>
                        <span className="text-sm font-semibold text-gray-700 mr-2">Tags:</span>
                        {tags.split(',').map((tag, idx) => tag.trim() && (
                          <span key={idx} className="inline-block px-2 py-1 bg-gray-100 text-gray-700 rounded text-sm mr-2 mb-2">
                            #{tag.trim()}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                <div className="mt-6 pt-4 border-t border-gray-200 text-sm text-gray-500">
                  <span>Reading time: {Math.ceil(wordCount / 200)} min</span>
                  <span className="mx-2">•</span>
                  <span>Word count: {wordCount.toLocaleString()}</span>
                </div>
              </article>
            </div>
            <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex justify-end space-x-3">
              <button
                onClick={() => setShowPreview(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50"
              >
                Close
              </button>
              <button
                onClick={() => {
                  setShowPreview(false);
                  handlePublish();
                }}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700"
              >
                Publish
              </button>
            </div>
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );
};

export default AddBlogPage;
