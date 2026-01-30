import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { blogService } from '../services/blogs';
import { 
  Calendar, 
  Tag, 
  FolderOpen, 
  Clock,
  ArrowLeft,
  FileText
} from 'lucide-react';

const BlogDetailPage = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [blog, setBlog] = useState(null);
  const [error, setError] = useState(null);
  const [hasAttemptedFetch, setHasAttemptedFetch] = useState(false);

  useEffect(() => {
    fetchBlog();
  }, [slug]);

  const fetchBlog = async () => {
    try {
      setError(null);
      setHasAttemptedFetch(false);
      // Decode the slug - React Router may have already decoded it, but handle both cases
      let decodedSlug = slug;
      try {
        decodedSlug = decodeURIComponent(decodeURIComponent(slug)); // Try double decode first
        if (decodedSlug === slug) {
          decodedSlug = decodeURIComponent(slug); // If no change, try single decode
        }
      } catch (e) {
        decodedSlug = slug; // If decoding fails, use as-is
      }
      console.log('Fetching blog with slug (original):', slug, 'decoded:', decodedSlug);
      const response = await blogService.getBlogBySlug(decodedSlug);
      console.log('Blog response:', response);
      if (response.blog) {
        setBlog(response.blog);
      } else {
        setError('Blog not found');
      }
    } catch (err) {
      console.error('Error fetching blog:', err);
      setError(err.message || 'Failed to load blog. Please try again later.');
    } finally {
      setHasAttemptedFetch(true);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // Only show error if we've attempted to fetch and there's an error or no blog
  if (hasAttemptedFetch && (error || !blog)) {
    return (
      <div className="min-h-screen bg-[#F6F6F6] relative flex items-center justify-center">
        {/* Background Gradient - Same as Blog Listing Page */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#9E005C]/10 via-[#FF4D94]/10 to-[#3F2B96]/10"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(158,0,92,0.1),transparent_50%)]"></div>
        <div className="relative z-10">
        <div className="text-center max-w-md mx-auto px-4">
          <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Blog Not Found</h2>
          <p className="text-gray-600 mb-6">{error || 'The blog post you are looking for does not exist.'}</p>
          <Link
            to="/blog"
            className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-[#9E005C] to-[#FF4D94] text-white rounded-lg hover:from-[#FF4D94] hover:to-[#9E005C] transition-all"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Blog
          </Link>
        </div>
        </div>
      </div>
    );
  }

  // Skeleton loading component for blog detail
  const BlogDetailSkeleton = () => (
    <div className="min-h-screen bg-[#F6F6F6] relative">
      {/* Background Gradient with Glassy Effect - Same as Blog Listing Page */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#9E005C]/10 via-[#FF4D94]/10 to-[#3F2B96]/10 backdrop-blur-xl animate-pulse" style={{
        background: 'linear-gradient(135deg, rgba(158, 0, 92, 0.1) 0%, rgba(255, 77, 148, 0.1) 50%, rgba(63, 43, 150, 0.1) 100%)'
      }}></div>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(158,0,92,0.1),transparent_50%)] backdrop-blur-sm"></div>
      <div className="relative z-10">
      <div className="max-w-4xl md:max-w-5xl lg:max-w-6xl xl:max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 w-full">
        {/* White Card Skeleton with Glassy Effect */}
        <article className="bg-white/90 backdrop-blur-md rounded-xl shadow-2xl border border-white/40 p-6 sm:p-8 md:p-10 animate-pulse" style={{
          boxShadow: '0 8px 32px 0 rgba(158, 0, 92, 0.1), 0 0 0 1px rgba(255, 255, 255, 0.2)'
        }}>
        {/* Featured Image Skeleton */}
        <div className="mb-8 rounded-lg overflow-hidden w-full h-64 bg-gradient-to-br from-[#9E005C]/20 to-[#FF4D94]/20"></div>
        
        {/* Title Skeleton */}
        <div className="mb-4 sm:mb-6 space-y-3">
          <div className="h-8 bg-gradient-to-r from-[#9E005C]/30 to-[#FF4D94]/30 rounded w-3/4"></div>
          <div className="h-8 bg-gradient-to-r from-[#9E005C]/30 to-[#FF4D94]/30 rounded w-1/2"></div>
        </div>
        
        {/* Meta Information Skeleton */}
        <div className="flex flex-wrap items-center gap-3 sm:gap-4 mb-6 sm:mb-8 pb-4 sm:pb-6 border-b border-gray-200">
          <div className="h-4 w-32 bg-gradient-to-r from-[#9E005C]/20 to-[#FF4D94]/20 rounded"></div>
          <div className="h-4 w-24 bg-gradient-to-r from-[#9E005C]/20 to-[#FF4D94]/20 rounded"></div>
          <div className="h-4 w-20 bg-gradient-to-r from-[#9E005C]/20 to-[#FF4D94]/20 rounded"></div>
        </div>
        
        {/* Excerpt Skeleton */}
        <div className="mb-6 sm:mb-8 p-4 sm:p-6 bg-gradient-to-r from-[#9E005C]/10 to-[#FF4D94]/10 rounded-r-lg space-y-2">
          <div className="h-4 bg-gradient-to-r from-[#9E005C]/20 to-[#FF4D94]/20 rounded w-full"></div>
          <div className="h-4 bg-gradient-to-r from-[#9E005C]/20 to-[#FF4D94]/20 rounded w-5/6"></div>
          <div className="h-4 bg-gradient-to-r from-[#9E005C]/20 to-[#FF4D94]/20 rounded w-4/6"></div>
        </div>
        
        {/* Categories and Tags Skeleton */}
        <div className="mb-8 flex flex-wrap gap-4">
          <div className="h-6 w-24 bg-gradient-to-r from-[#9E005C]/20 to-[#FF4D94]/20 rounded"></div>
          <div className="h-6 w-20 bg-gradient-to-r from-[#9E005C]/30 to-[#FF4D94]/30 rounded-full"></div>
          <div className="h-6 w-16 bg-gradient-to-r from-[#9E005C]/30 to-[#FF4D94]/30 rounded-full"></div>
        </div>
        
        {/* Content Skeleton */}
        <div className="space-y-4">
          <div className="h-4 bg-gradient-to-r from-[#9E005C]/20 to-[#FF4D94]/20 rounded w-full"></div>
          <div className="h-4 bg-gradient-to-r from-[#9E005C]/20 to-[#FF4D94]/20 rounded w-full"></div>
          <div className="h-4 bg-gradient-to-r from-[#9E005C]/20 to-[#FF4D94]/20 rounded w-5/6"></div>
          <div className="h-4 bg-gradient-to-r from-[#9E005C]/20 to-[#FF4D94]/20 rounded w-full"></div>
          <div className="h-4 bg-gradient-to-r from-[#9E005C]/20 to-[#FF4D94]/20 rounded w-4/6"></div>
          <div className="h-4 bg-gradient-to-r from-[#9E005C]/20 to-[#FF4D94]/20 rounded w-full"></div>
          <div className="h-4 bg-gradient-to-r from-[#9E005C]/20 to-[#FF4D94]/20 rounded w-3/4"></div>
        </div>
        
        {/* Footer Skeleton */}
        <div className="mt-12 pt-8 border-t border-gray-200">
          <div className="h-6 w-32 bg-gradient-to-r from-[#9E005C]/30 to-[#FF4D94]/30 rounded"></div>
        </div>
        </article>
      </div>
      </div>
    </div>
  );

  // Show skeleton while loading
  if (!blog && !hasAttemptedFetch) {
    return <BlogDetailSkeleton />;
  }

  return (
    <div className="min-h-screen bg-[#F6F6F6] relative">
      {/* Background Gradient with Glassy Effect - Same as Blog Listing Page */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#9E005C]/10 via-[#FF4D94]/10 to-[#3F2B96]/10 backdrop-blur-xl" style={{
        background: 'linear-gradient(135deg, rgba(158, 0, 92, 0.1) 0%, rgba(255, 77, 148, 0.1) 50%, rgba(63, 43, 150, 0.1) 100%)'
      }}></div>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(158,0,92,0.1),transparent_50%)] backdrop-blur-sm"></div>
      <div className="relative z-10">
      {/* Main Content - Increased width for desktop */}
      <div className="max-w-4xl md:max-w-5xl lg:max-w-6xl xl:max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 w-full">
        {/* White Card with Glassy Effect */}
        <article className="bg-white/90 backdrop-blur-md rounded-xl shadow-2xl border border-white/40 p-6 sm:p-8 md:p-10" style={{
          boxShadow: '0 8px 32px 0 rgba(158, 0, 92, 0.1), 0 0 0 1px rgba(255, 255, 255, 0.2)'
        }}>
        {/* Featured Image */}
        {(blog.featured_image || blog.metadata?.featured_image) && (
          <div className="mb-8 rounded-lg overflow-hidden w-full max-w-full">
            <img 
              src={blog.featured_image || blog.metadata?.featured_image} 
              alt={blog.title || 'Featured'} 
              className="w-full h-auto max-h-96 object-contain sm:object-cover"
              style={{ maxWidth: '100%', height: 'auto', width: '100%' }}
            />
          </div>
        )}

        {/* Title */}
        <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold bg-gradient-to-r from-[#9E005C] to-[#FF4D94] bg-clip-text text-transparent mb-4 sm:mb-6">
          {blog.title || 'Untitled'}
        </h1>

        {/* Meta Information */}
        <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs sm:text-sm text-gray-600 mb-6 sm:mb-8 pb-4 sm:pb-6 border-b border-gray-200">
          <div className="flex items-center">
            <Calendar className="w-4 h-4 mr-1" />
            {formatDate(blog.created_at)}
          </div>
          {blog.reading_time > 0 && (
            <div className="flex items-center">
              <Clock className="w-4 h-4 mr-1" />
              {blog.reading_time} min read
            </div>
          )}
          {blog.word_count > 0 && (
            <div className="flex items-center">
              <span>{blog.word_count.toLocaleString()} words</span>
            </div>
          )}
        </div>

        {/* Excerpt */}
        {blog.excerpt && (
          <div className="mb-6 sm:mb-8 p-4 sm:p-6 bg-blue-50 border-l-4 border-blue-500 rounded-r-lg">
            <p className="text-base sm:text-lg md:text-xl text-gray-700 italic leading-relaxed">
              {blog.excerpt}
            </p>
          </div>
        )}

        {/* Categories and Tags */}
        {(blog.categories?.length > 0 || blog.tags?.length > 0) && (
          <div className="mb-8 flex flex-wrap gap-4">
            {blog.categories && blog.categories.length > 0 && (
              <div>
                <span className="text-sm font-semibold text-gray-700 mr-2">Categories:</span>
                {blog.categories.map((category, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm mr-2 mb-2"
                  >
                    <FolderOpen className="w-3 h-3 mr-1" />
                    {category}
                  </span>
                ))}
              </div>
            )}
            {blog.tags && blog.tags.length > 0 && (
              <div>
                <span className="text-sm font-semibold text-gray-700 mr-2">Tags:</span>
                {blog.tags.map((tag, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center px-2 py-1 bg-gray-100 text-gray-700 rounded text-sm mr-2 mb-2"
                  >
                    <Tag className="w-3 h-3 mr-1" />
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Blog Content */}
        <div 
          className="prose prose-sm sm:prose-base md:prose-lg max-w-none blog-content"
          dangerouslySetInnerHTML={{ __html: blog.content || '' }}
        />

        {/* Footer */}
        <div className="mt-12 pt-8 border-t border-gray-200">
          <Link
            to="/blog"
            className="inline-flex items-center bg-gradient-to-r from-[#9E005C] to-[#FF4D94] bg-clip-text text-transparent hover:from-[#FF4D94] hover:to-[#9E005C] font-medium transition-all"
          >
            <ArrowLeft className="w-4 h-4 mr-2 text-[#9E005C]" />
            Back to All Blogs
          </Link>
        </div>
        </article>
      </div>
      </div>
    </div>
  );
};

export default BlogDetailPage;

