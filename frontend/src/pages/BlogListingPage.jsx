import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { blogService } from '../services/blogs';
import { 
  Calendar, 
  Tag, 
  FolderOpen, 
  Clock,
  Search,
  FileText,
  ChevronRight,
  Menu,
  X
} from 'lucide-react';

const BlogListingPage = () => {
  const location = useLocation();
  const [blogs, setBlogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [displayCount, setDisplayCount] = useState(9); // Show 9 posts initially
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    fetchBlogs();
  }, []);

  // Refresh when navigating to this page (e.g., after publishing)
  useEffect(() => {
    if (location.pathname === '/blog') {
      console.log('Navigated to blog page, refreshing...');
      fetchBlogs();
    }
  }, [location.pathname]);

  // Refresh blogs when page becomes visible (e.g., after publishing)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        console.log('Page became visible, refreshing blogs...');
        fetchBlogs();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Also refresh on focus (when user switches back to tab)
    window.addEventListener('focus', fetchBlogs);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', fetchBlogs);
    };
  }, []);

  const fetchBlogs = async () => {
    const startTime = Date.now();
    const minLoadingTime = 2000; // Minimum 2 seconds for better UX
    
    try {
      setLoading(true);
      setError(null);
      console.log('Fetching public blogs with status: published');
      const response = await blogService.getPublicBlogs({ 
        status: 'published',
        limit: 100 
      });
      console.log('Blogs response:', response);
      console.log('Number of blogs received:', response.blogs?.length || 0);
      if (response.blogs && response.blogs.length > 0) {
        console.log('Sample blog:', response.blogs[0]);
        console.log('Sample blog status:', response.blogs[0].status);
      }
      setBlogs(response.blogs || []);
      
      // Calculate elapsed time
      const elapsedTime = Date.now() - startTime;
      
      // Ensure minimum loading time (500ms) for better UX, but don't delay if it already took longer
      if (elapsedTime < minLoadingTime) {
        const remainingTime = minLoadingTime - elapsedTime;
        await new Promise(resolve => setTimeout(resolve, remainingTime));
      }
      
      setLoading(false);
    } catch (err) {
      console.error('Error fetching blogs:', err);
      setError('Failed to load blogs. Please try again later.');
      
      // Calculate elapsed time for error case too
      const elapsedTime = Date.now() - startTime;
      if (elapsedTime < minLoadingTime) {
        const remainingTime = minLoadingTime - elapsedTime;
        await new Promise(resolve => setTimeout(resolve, remainingTime));
      }
      setLoading(false);
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


  const filteredBlogs = blogs.filter(blog => {
    // Filter by search term only
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      blog.title?.toLowerCase().includes(searchLower) ||
      blog.excerpt?.toLowerCase().includes(searchLower) ||
      blog.content?.toLowerCase().includes(searchLower) ||
      blog.tags?.some(tag => tag.toLowerCase().includes(searchLower)) ||
      blog.categories?.some(cat => cat.toLowerCase().includes(searchLower))
    );
  });

  const displayedBlogs = filteredBlogs.slice(0, displayCount);
  const hasMore = filteredBlogs.length > displayCount;

  // Skeleton loading component
  const BlogSkeleton = () => (
    <article className="bg-white/20 backdrop-blur-xl rounded-xl shadow-2xl overflow-hidden border border-white/30 animate-pulse" style={{
      boxShadow: '0 8px 32px 0 rgba(158, 0, 92, 0.15), 0 0 0 1px rgba(255, 255, 255, 0.1)',
      background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.2) 0%, rgba(255, 255, 255, 0.1) 100%)'
    }}>
      {/* Image skeleton */}
      <div className="h-40 sm:h-48 bg-gradient-to-br from-[#9E005C]/20 to-[#FF4D94]/20"></div>
      
      {/* Content skeleton */}
      <div className="p-4 sm:p-5">
        {/* Category skeleton */}
        <div className="mb-2 sm:mb-3">
          <div className="h-5 w-20 bg-gradient-to-r from-[#9E005C]/30 to-[#FF4D94]/30 rounded-full"></div>
        </div>
        
        {/* Title skeleton */}
        <div className="mb-3 space-y-2">
          <div className="h-5 bg-gradient-to-r from-[#9E005C]/30 to-[#FF4D94]/30 rounded w-full"></div>
          <div className="h-5 bg-gradient-to-r from-[#9E005C]/30 to-[#FF4D94]/30 rounded w-3/4"></div>
        </div>
        
        {/* Excerpt skeleton */}
        <div className="mb-3 sm:mb-4 space-y-2">
          <div className="h-4 bg-gradient-to-r from-[#9E005C]/20 to-[#FF4D94]/20 rounded w-full"></div>
          <div className="h-4 bg-gradient-to-r from-[#9E005C]/20 to-[#FF4D94]/20 rounded w-5/6"></div>
        </div>
        
        {/* Meta skeleton */}
        <div className="flex items-center gap-3 mb-3 sm:mb-4">
          <div className="h-4 w-24 bg-gradient-to-r from-[#9E005C]/20 to-[#FF4D94]/20 rounded"></div>
          <div className="h-4 w-16 bg-gradient-to-r from-[#9E005C]/20 to-[#FF4D94]/20 rounded"></div>
        </div>
        
        {/* Read more skeleton */}
        <div className="h-4 w-20 bg-gradient-to-r from-[#9E005C]/30 to-[#FF4D94]/30 rounded"></div>
      </div>
    </article>
  );

  return (
    <div className="min-h-screen bg-[#F6F6F6] relative">
      {loading && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 sm:pt-24 pb-8">
          {/* Search Bar Skeleton */}
          <div className="mb-4 sm:mb-8 flex justify-center sm:justify-end">
            <div className="relative w-full sm:w-64">
              <div className="h-10 bg-gradient-to-r from-[#9E005C]/20 to-[#FF4D94]/20 rounded-full animate-pulse"></div>
            </div>
          </div>
          
          {/* Blog Grid Skeleton */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 pt-2 sm:pt-6">
            {[...Array(9)].map((_, index) => (
              <BlogSkeleton key={index} />
            ))}
          </div>
        </div>
      )}
      
      {!loading && (
        <>
          {/* Background Gradient - Same as Landing Page */}
          <div className="absolute inset-0 bg-gradient-to-br from-[#9E005C]/10 via-[#FF4D94]/10 to-[#3F2B96]/10"></div>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(158,0,92,0.1),transparent_50%)]"></div>
          <div className="relative z-10">
      {/* Navigation Header - Same as Landing Page */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-xl border-b border-[#2E2E2E]/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4 sm:space-x-6 lg:space-x-8">
              <Link to="/" className="text-xl sm:text-2xl md:text-3xl font-bold bg-gradient-to-r from-[#9E005C] to-[#FF4D94] bg-clip-text text-transparent">
                atsn ai
              </Link>
              <div className="hidden md:flex items-center space-x-6 lg:space-x-8">
                <Link 
                  to="/#features"
                  className="text-sm sm:text-base text-[#2E2E2E]/70 hover:text-[#2E2E2E] transition-colors"
                >
                  Features
                </Link>
                <Link 
                  to="/#agents"
                  className="text-sm sm:text-base text-[#2E2E2E]/70 hover:text-[#2E2E2E] transition-colors"
                >
                  Agents
                </Link>
                <Link 
                  to="/#pricing"
                  className="text-sm sm:text-base text-[#2E2E2E]/70 hover:text-[#2E2E2E] transition-colors"
                >
                  Pricing
                </Link>
                <Link 
                  to="/blog"
                  className="text-sm sm:text-base text-[#9E005C] font-medium"
                >
                  Blog
                </Link>
              </div>
            </div>
            <div className="flex items-center space-x-2 sm:space-x-4">
              <Link
                to="/login"
                className="hidden md:block text-sm sm:text-base text-[#2E2E2E]/70 hover:text-[#2E2E2E] transition-colors"
              >
                Sign In
              </Link>
              <Link
                to="/signup"
                className="bg-[#9E005C] text-white px-4 sm:px-6 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm md:text-base font-medium hover:bg-[#FF4D94] transition-all duration-300 transform hover:scale-105"
              >
                Get Started
              </Link>
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="md:hidden text-[#2E2E2E]"
              >
                {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Menu */}
      {isMenuOpen && (
        <div className="fixed inset-0 z-40 md:hidden bg-white/95 backdrop-blur-xl pt-16">
          <div className="flex flex-col items-center justify-start h-full space-y-6 sm:space-y-8 pt-8">
            <Link 
              to="/#features"
              onClick={() => setIsMenuOpen(false)}
              className="text-lg sm:text-xl text-[#2E2E2E]/70 hover:text-[#2E2E2E] transition-colors"
            >
              Features
            </Link>
            <Link 
              to="/#agents"
              onClick={() => setIsMenuOpen(false)}
              className="text-lg sm:text-xl text-[#2E2E2E]/70 hover:text-[#2E2E2E] transition-colors"
            >
              Agents
            </Link>
            <Link 
              to="/#pricing"
              onClick={() => setIsMenuOpen(false)}
              className="text-lg sm:text-xl text-[#2E2E2E]/70 hover:text-[#2E2E2E] transition-colors"
            >
              Pricing
            </Link>
            <Link 
              to="/blog"
              onClick={() => setIsMenuOpen(false)}
              className="text-lg sm:text-xl text-[#9E005C] font-medium"
            >
              Blog
            </Link>
            <Link
              to="/login"
              onClick={() => setIsMenuOpen(false)}
              className="text-lg sm:text-xl text-[#2E2E2E]/70 hover:text-[#2E2E2E] transition-colors"
            >
              Sign In
            </Link>
            <Link
              to="/signup"
              onClick={() => setIsMenuOpen(false)}
              className="bg-[#9E005C] text-white px-6 sm:px-8 py-2.5 sm:py-3 rounded-full text-base sm:text-lg font-medium hover:bg-[#FF4D94] transition-all duration-300"
            >
              Get Started
            </Link>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 sm:pt-24 pb-8">
        {/* Search Bar - Responsive: Centered on mobile, Top Right on desktop */}
        <div className="mb-4 sm:mb-8 flex justify-center sm:justify-end">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 z-10" />
            <input
              type="text"
              placeholder="Search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white"
            />
          </div>
        </div>
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {displayedBlogs.length === 0 ? (
          <div className="text-center py-16">
            <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              {searchTerm ? 'No blogs found' : 'No blogs yet'}
            </h3>
            <p className="text-gray-600">
              {searchTerm
                ? 'Try adjusting your search terms'
                : 'Check back soon for new content'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 pt-2 sm:pt-6">
            {displayedBlogs.map((blog) => (
              <article
                key={blog.id}
                className="bg-white/20 backdrop-blur-xl rounded-xl shadow-2xl md:hover:shadow-2xl transition-all duration-300 overflow-hidden border border-white/30 group md:hover:scale-105 md:hover:-translate-y-2 relative z-0 md:group-hover:z-10"
                style={{
                  boxShadow: '0 8px 32px 0 rgba(158, 0, 92, 0.15), 0 0 0 1px rgba(255, 255, 255, 0.1)',
                  background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.2) 0%, rgba(255, 255, 255, 0.1) 100%)'
                }}
              >
                 {/* Featured Image or Placeholder */}
                 <div className="h-40 sm:h-48 overflow-hidden">
                  {(blog.featured_image || blog.metadata?.featured_image) ? (
                    <img 
                      src={blog.featured_image || blog.metadata?.featured_image} 
                      alt={blog.title || 'Blog post'} 
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                    />
                  ) : (
                    <div className="h-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center">
                      <FileText className="w-12 h-12 text-white opacity-50" />
                    </div>
                  )}
                </div>

                 {/* Blog Content */}
                 <div className="p-4 sm:p-5">
                   {/* Category Badge */}
                   {blog.categories && blog.categories.length > 0 && (
                     <div className="mb-2 sm:mb-3">
                       <span className="inline-flex items-center px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 uppercase tracking-wide">
                         {blog.categories[0]}
                       </span>
                     </div>
                   )}

                  {/* Title */}
                  <Link
                    to={`/blog/${encodeURIComponent(blog.slug || blog.id)}`}
                    className="block mb-3 group/title"
                  >
                    <h2 className="text-base sm:text-lg md:text-xl font-bold bg-gradient-to-r from-[#9E005C] to-[#FF4D94] bg-clip-text text-transparent group-hover/title:from-[#FF4D94] group-hover/title:to-[#9E005C] transition-all line-clamp-3 leading-tight">
                      {blog.title || 'Untitled'}
                    </h2>
                  </Link>

                   {/* Excerpt - Shows more on hover (desktop only) */}
                   {blog.excerpt && (
                     <div className="mb-3 sm:mb-4 overflow-hidden">
                       <p className="text-gray-600 text-xs sm:text-sm line-clamp-2 md:group-hover:line-clamp-none md:group-hover:max-h-32 transition-all duration-300 leading-relaxed">
                         {blog.excerpt}
                       </p>
                     </div>
                   )}

                  {/* Blog Content - Shows on hover (desktop only) */}
                  {blog.content && (
                    <div className="mb-4 overflow-hidden max-h-0 md:group-hover:max-h-48 transition-all duration-300">
                      <p className="text-gray-600 text-xs leading-relaxed">
                        {blog.content.replace(/<[^>]*>/g, '').substring(0, 300)}
                        {blog.content.replace(/<[^>]*>/g, '').length > 300 && '...'}
                      </p>
                    </div>
                  )}

                   {/* Meta Information */}
                   <div className="flex items-center gap-2 sm:gap-3 text-xs text-gray-500 mb-3 sm:mb-4">
                    <div className="flex items-center">
                      <Calendar className="w-3 h-3 mr-1" />
                      {formatDate(blog.created_at)}
                    </div>
                    {blog.reading_time > 0 && (
                      <div className="flex items-center">
                        <Clock className="w-3 h-3 mr-1" />
                        {blog.reading_time} min read
                      </div>
                    )}
                  </div>

                   {/* Read More Link */}
                   <Link
                     to={`/blog/${encodeURIComponent(blog.slug || blog.id)}`}
                     className="inline-flex items-center bg-gradient-to-r from-[#9E005C] to-[#FF4D94] bg-clip-text text-transparent hover:from-[#FF4D94] hover:to-[#9E005C] font-medium text-xs sm:text-sm group/link transition-all"
                   >
                     Read more
                     <ChevronRight className="w-3 h-3 sm:w-4 sm:h-4 ml-1 group-hover/link:translate-x-1 transition-transform text-[#9E005C] group-hover/link:text-[#FF4D94]" />
                   </Link>
                </div>
              </article>
            ))}
          </div>
        )}

        {/* Load More Button */}
        {hasMore && (
          <div className="text-center mt-12">
            <button
              onClick={() => setDisplayCount(prev => prev + 9)}
              className="inline-flex items-center px-6 py-3 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors font-medium"
            >
              Load more
            </button>
          </div>
        )}
      </div>

      {/* Add Blog Link - Hidden or can be moved to admin area */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
      </div>
      </div>
        </>
      )}
    </div>
  );
};

export default BlogListingPage;

