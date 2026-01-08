import React, { useState } from 'react';
import { Copy, Edit, Eye, Heart, MessageCircle, Share, Calendar, Hash, Image as ImageIcon, Video, FileText, Layers, ChevronLeft, ChevronRight, Play } from 'lucide-react';

const ContentCard = ({ content, platform, contentType, onEdit, onCopy, onPreview, minimal = false, isDarkMode = false }) => {
  const [copied, setCopied] = useState(false);
  const [showFullContent, setShowFullContent] = useState(false);
  const [currentCarouselIndex, setCurrentCarouselIndex] = useState(0);

  const handleCopy = async () => {
    try {
      let textToCopy = '';

      // Handle different content types for copying
      if (contentType?.toLowerCase() === 'email' && content.email_subject && content.email_body) {
        textToCopy = `Subject: ${content.email_subject}\n\n${content.email_body}`;
      } else if ((contentType?.toLowerCase() === 'short video' || contentType?.toLowerCase() === 'long video') && (content.short_video_script || content.long_video_script)) {
        textToCopy = content.short_video_script || content.long_video_script;
      } else if (contentType?.toLowerCase() === 'message' && content.message) {
        textToCopy = content.message;
      } else {
        textToCopy = content.content || content;
      }

      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy content:', err);
    }
  };

  const getPlatformIcon = (platform) => {
    switch (platform?.toLowerCase()) {
      case 'instagram':
        return (
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.2.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" fill="url(#instagram-gradient)"/>
            <defs>
              <linearGradient id="instagram-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#833ab4"/>
                <stop offset="50%" stopColor="#fd1d1d"/>
                <stop offset="100%" stopColor="#fcb045"/>
              </linearGradient>
            </defs>
          </svg>
        );
      case 'facebook':
        return (
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" fill="#1877F2"/>
          </svg>
        );
      case 'linkedin':
        return (
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" fill="#0077B5"/>
          </svg>
        );
      case 'twitter':
      case 'x':
        return (
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" fill="#000000"/>
          </svg>
        );
      case 'youtube':
        return (
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" fill="#FF0000"/>
          </svg>
        );
      case 'tiktok':
        return (
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" fill="#000000"/>
          </svg>
        );
      case 'pinterest':
        return (
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.174-.105-.949-.199-2.403.041-3.439.219-.937 1.406-5.957 1.406-5.957s-.359-.72-.359-1.781c0-1.663.967-2.911 2.168-2.911 1.024 0 1.518.769 1.518 1.688 0 1.029-.653 2.567-.992 3.992-.285 1.193.6 2.165 1.775 2.165 2.128 0 3.768-2.245 3.768-5.487 0-2.861-2.063-4.869-5.008-4.869-3.41 0-5.409 2.562-5.409 5.199 0 1.033.394 2.143.889 2.75.099.12.112.225.085.345-.09.375-.293 1.199-.334 1.363-.053.225-.172.271-.402.165-1.495-.69-2.433-2.878-2.433-4.646 0-3.776 2.748-7.252 7.92-7.252 4.158 0 7.392 2.967 7.392 6.923 0 4.135-2.607 7.462-6.233 7.462-1.214 0-2.357-.629-2.748-1.378 0 0-.599 2.282-.744 2.84-.282 1.084-1.064 2.456-1.549 3.235C9.584 23.815 10.77 24.001 12.017 24.001c6.624 0 11.99-5.367 11.99-11.987C24.007 5.367 18.641.001.012.017z" fill="#E60023"/>
          </svg>
        );
      case 'whatsapp business':
      case 'whatsapp':
        return (
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.742.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.488" fill="#25D366"/>
          </svg>
        );
      default:
        return <MessageCircle className="w-4 h-4 text-gray-500" />;
    }
  };

  const getContentTypeIcon = (contentType) => {
    switch (contentType?.toLowerCase()) {
      case 'story': return <FileText className="w-4 h-4" />;
      case 'post': return <MessageCircle className="w-4 h-4" />;
      case 'reel': return <Video className="w-4 h-4" />;
      case 'short video': return <Video className="w-4 h-4" />;
      case 'long video': return <Video className="w-4 h-4" />;
      case 'video': return <Video className="w-4 h-4" />;
      case 'image': return <ImageIcon className="w-4 h-4" />;
      case 'carousel': return <Layers className="w-4 h-4" />;
      case 'email': return <FileText className="w-4 h-4" />;
      case 'message': return <MessageCircle className="w-4 h-4" />;
      default: return <FileText className="w-4 h-4" />;
    }
  };

  const getPlatformColor = (platform) => {
    switch (platform?.toLowerCase()) {
      case 'instagram': return 'from-pink-500 to-purple-600';
      case 'facebook': return 'from-blue-600 to-blue-800';
      case 'twitter': return 'from-sky-400 to-sky-600';
      case 'linkedin': return 'from-blue-700 to-blue-900';
      case 'tiktok': return 'from-black to-gray-800';
      case 'pinterest': return 'from-red-500 to-red-700';
      case 'whatsapp business': return 'from-green-500 to-green-700';
      default: return 'from-gray-500 to-gray-700';
    }
  };

  const contentText = content.content || content;
  const contentTextClass = isDarkMode ? 'text-white' : 'text-gray-800';
  const title = content.title || `${contentType} for ${platform}`;
  const hashtags = content.hashtags || [];
  const mediaUrl = content.media_url || content.mediaUrl;
  
  // Check if the media file is a video
  const isVideoFile = (url) => {
    if (!url) return false;
    const videoExtensions = ['.mp4', '.avi', '.mov', '.wmv', '.webm', '.mkv'];
    return videoExtensions.some(ext => url.toLowerCase().includes(ext));
  };
  
  // Determine if media is a video
  const isVideo = content.post_type === 'video' || 
                  content.content_type?.toLowerCase() === 'video' ||
                  contentType?.toLowerCase() === 'video' ||
                  content.metadata?.media_type === 'video' ||
                  (mediaUrl && isVideoFile(mediaUrl));
  
  // Check if this is a carousel post - enhanced detection
  const isCarousel = content.post_type === 'carousel' || 
                     contentType?.toLowerCase() === 'carousel' ||
                     content.content_type?.toLowerCase() === 'carousel' ||
                     content.selected_content_type?.toLowerCase() === 'carousel' ||
                     (content.metadata && content.metadata.carousel_images && content.metadata.carousel_images.length > 0) ||
                     (content.carousel_images && content.carousel_images.length > 0) ||
                     (content.metadata && content.metadata.total_images && content.metadata.total_images > 1);
  
  // Get carousel images from various possible locations
  let carouselImages = [];
  if (isCarousel) {
    // Check multiple locations for carousel images
    if (content.carousel_images && Array.isArray(content.carousel_images) && content.carousel_images.length > 0) {
      carouselImages = content.carousel_images.map(img => typeof img === 'string' ? img : (img.url || img));
    } else if (content.metadata?.carousel_images && Array.isArray(content.metadata.carousel_images) && content.metadata.carousel_images.length > 0) {
      carouselImages = content.metadata.carousel_images.map(img => typeof img === 'string' ? img : (img.url || img));
    } else if (content.metadata?.images && Array.isArray(content.metadata.images) && content.metadata.images.length > 0) {
      carouselImages = content.metadata.images.map(img => typeof img === 'string' ? img : (img.url || img));
    } else if (content.images && Array.isArray(content.images) && content.images.length > 0) {
      // Also check content_images relationship if available
      carouselImages = content.images.map(img => typeof img === 'object' && img.image_url ? img.image_url : (typeof img === 'string' ? img : img));
    }
  }
  
  const carouselImageCount = carouselImages.length;
  
  // Check if this is a short video/reel
  const isShortVideo = contentType?.toLowerCase() === 'short video' ||
                       contentType?.toLowerCase() === 'reel' ||
                       content.content_type?.toLowerCase() === 'short_video or reel' ||
                       (content.short_video_script && content.short_video_script.trim());

  // Determine post type for proper rendering
  const getPostType = () => {
    if (isCarousel) return 'carousel';
    if (isShortVideo) return 'short_video';
    if (isVideo) return 'video';
    if (content.post_type === 'image' || mediaUrl) return 'image';
    return 'text';
  };

  const postType = getPostType();
  
  // Helper functions for carousel navigation
  const nextCarouselImage = (e) => {
    e.stopPropagation();
    setCurrentCarouselIndex((prev) => (prev + 1) % carouselImageCount);
  };
  
  const prevCarouselImage = (e) => {
    e.stopPropagation();
    setCurrentCarouselIndex((prev) => (prev - 1 + carouselImageCount) % carouselImageCount);
  };
  
  const goToCarouselImage = (index) => {
    setCurrentCarouselIndex(index);
  };

  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-all duration-300">
      {/* Media First (for minimal mode) */}
      {minimal && (isCarousel && carouselImages.length > 0 ? (
        <div className="relative group">
          <div className="relative overflow-hidden aspect-square bg-gray-100 rounded-t-xl">
            <div
              className="flex transition-transform duration-300 ease-in-out h-full"
              style={{ transform: `translateX(-${currentCarouselIndex * 100}%)` }}
            >
              {carouselImages.map((img, index) => {
                const imageUrl = typeof img === 'string' ? img : (img.url || img);
                return (
                  <div key={index} className="min-w-full h-full flex-shrink-0">
                    <img
                      src={imageUrl}
                      alt={`Carousel image ${index + 1}`}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.target.style.display = 'none';
                      }}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : mediaUrl && (
        <div className="relative group h-32 bg-gray-100 rounded-t-xl overflow-hidden">
          {isVideo ? (
            <video
              src={mediaUrl}
              className="w-full h-full object-cover"
              controls={false}
              preload="metadata"
              muted
              playsInline
              onError={(e) => {
                e.target.style.display = 'none';
              }}
            />
          ) : (
            <img
              src={mediaUrl}
              alt="Content media"
              className="w-full h-full object-cover"
              onError={(e) => {
                e.target.style.display = 'none';
              }}
            />
          )}
        </div>
      ))}

      {/* Header */}
      <div
        className={`p-4 ${
          minimal
            ? isDarkMode
              ? 'bg-gray-900/70 border-b border-gray-800 text-white'
              : 'bg-white border-b border-gray-100 text-gray-900'
            : isDarkMode
              ? 'bg-gray-900/80 border-b border-gray-800 text-white'
              : `bg-gradient-to-r ${getPlatformColor(platform)} text-white`
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3 flex-1 min-w-0">
            {!minimal && <span className="text-2xl flex-shrink-0">{getPlatformIcon(platform)}</span>}
            <div className="flex-1 min-w-0">
              <div className={`${minimal ? 'text-xs font-normal' : 'text-sm font-normal'} truncate overflow-hidden whitespace-nowrap text-ellipsis`}>
                {(platform || 'Platform') + ' | ' + (contentType || 'Content')}
              </div>
            </div>
          </div>
          {!minimal && (
            <div className="flex items-center space-x-2">
              <button
                onClick={handleCopy}
                className="p-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors"
                title="Copy content"
              >
                {copied ? (
                  <span className="text-xs">✓</span>
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
              {onEdit && (
                <button
                  onClick={() => onEdit(content)}
                  className="p-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors"
                  title="Edit content"
                >
                  <Edit className="w-4 h-4" />
                </button>
              )}
              {onPreview && (
                <button
                  onClick={() => onPreview(content)}
                  className="p-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors"
                  title="Preview content"
                >
                  <Eye className="w-4 h-4" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Media Preview - Only for non-minimal mode */}
      {!minimal && (isCarousel && carouselImages.length > 0 ? (
        <div className="relative group">
          {/* Carousel Slider */}
          <div className="relative overflow-hidden aspect-square bg-gray-100">
            <div
              className="flex transition-transform duration-300 ease-in-out h-full"
              style={{ transform: `translateX(-${currentCarouselIndex * 100}%)` }}
            >
              {carouselImages.map((img, index) => {
                const imageUrl = typeof img === 'string' ? img : (img.url || img);
                return (
                  <div key={index} className="min-w-full h-full flex-shrink-0">
                    <img
                      src={imageUrl}
                      alt={`Carousel image ${index + 1}`}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.target.style.display = 'none';
                      }}
                    />
                  </div>
                );
              })}
            </div>

            {/* Navigation Arrows */}
            {carouselImageCount > 1 && (
              <>
                <button
                  onClick={prevCarouselImage}
                  className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-all opacity-0 group-hover:opacity-100"
                  aria-label="Previous image"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  onClick={nextCarouselImage}
                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-all opacity-0 group-hover:opacity-100"
                  aria-label="Next image"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </>
            )}

            {/* Image Counter Badge */}
            <div className="absolute top-2 right-2 bg-black/50 text-white px-2 py-1 rounded text-xs flex items-center gap-1">
              <Layers className="w-3 h-3" />
              <span>{currentCarouselIndex + 1}/{carouselImageCount}</span>
            </div>

            {/* Carousel Indicator Dots - Enhanced visibility */}
            {carouselImageCount > 1 && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2 z-10">
                {carouselImages.map((_, index) => (
                  <button
                    key={index}
                    onClick={(e) => {
                      e.stopPropagation();
                      goToCarouselImage(index);
                    }}
                    className={`rounded-full transition-all duration-300 ${
                      index === currentCarouselIndex
                        ? 'bg-white w-8 h-2 shadow-lg'
                        : 'bg-white/60 hover:bg-white/80 w-2 h-2'
                    }`}
                    aria-label={`Go to image ${index + 1}`}
                    title={`Image ${index + 1} of ${carouselImageCount}`}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      ) : isShortVideo && content.images && content.images.length > 0 ? (
        <div className="relative group cursor-pointer" onClick={() => onPreview && onPreview(content)}>
          <img
            src={content.images[0]}
            alt="Video thumbnail"
            className="w-full h-48 object-cover rounded-lg"
            onError={(e) => {
              e.target.style.display = 'none';
            }}
          />
          {/* Video Play Button Overlay */}
          <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/30 transition-colors rounded-lg">
            <div className="bg-white/90 rounded-full p-4 shadow-lg group-hover:scale-110 transition-transform">
              <Play className="w-8 h-8 text-purple-600 fill-purple-600" />
            </div>
          </div>
          {/* Video Badge */}
          <div className="absolute top-2 right-2 bg-black/50 text-white px-2 py-1 rounded text-xs flex items-center gap-1">
            <Video className="w-3 h-3" />
            <span>REEL</span>
          </div>
        </div>
      ) : mediaUrl && (
        <div className="relative group cursor-pointer" onClick={() => onPreview && onPreview(content)}>
          {isVideo ? (
            <video
              src={mediaUrl}
              className="w-full h-48 object-cover"
              controls={false}
              preload="metadata"
              muted
              playsInline
              onError={(e) => {
                e.target.style.display = 'none';
              }}
            />
          ) : (
          <img
            src={mediaUrl}
            alt="Content media"
            className="w-full h-48 object-cover"
            onError={(e) => {
              e.target.style.display = 'none';
            }}
          />
          )}
          {isVideo && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/30 transition-colors">
              <div className="bg-white/90 rounded-full p-3 shadow-lg group-hover:scale-110 transition-transform">
                <Play className="w-6 h-6 text-purple-600 fill-purple-600" />
              </div>
            </div>
          )}
          <div className="absolute top-2 right-2 bg-black/50 text-white px-2 py-1 rounded text-xs flex items-center gap-1">
            {isVideo ? (
              <>
                <Video className="w-3 h-3" />
                <span>Video</span>
              </>
            ) : (
              <>
                <ImageIcon className="w-3 h-3" />
                <span>Image</span>
              </>
            )}
          </div>
        </div>
      ))}

      {/* Content - Hidden in minimal mode */}
      {/* Title below carousel */}
      {title && (
        <div
          className={`px-4 py-3 border-b ${
            isDarkMode ? 'border-gray-800 bg-gray-900 text-white' : 'border-gray-100 bg-white text-gray-900'
          }`}
        >
          <h3 className={`text-lg font-normal leading-tight ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>
            {title}
          </h3>
        </div>
      )}

      {!minimal && (
        <div
          className={`p-4 space-y-3 ${
            isDarkMode ? 'bg-gray-900 border-t border-gray-800' : ''
          }`}
        >
          <div className="space-y-3">
            {/* Handle different content types */}
            {contentType?.toLowerCase() === 'email' && content.email_subject && content.email_body ? (
              <div className="space-y-3">
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2">📧 Subject:</h4>
                  <div className="text-gray-800 bg-gray-50 p-3 rounded-lg border-l-4 border-blue-400">
                    {content.email_subject}
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2">📝 Email Body:</h4>
                  <div className="text-gray-800 leading-relaxed">
                    {showFullContent ? content.email_body : content.email_body.substring(0, 200)}
                    {content.email_body.length > 200 && (
                      <button
                        onClick={() => setShowFullContent(!showFullContent)}
                        className="ml-2 text-pink-500 hover:text-pink-600 font-medium"
                      >
                        {showFullContent ? 'Show less' : '...Show more'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ) : (contentType?.toLowerCase() === 'short video' || contentType?.toLowerCase() === 'long video') && (content.short_video_script || content.long_video_script) ? (
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">🎬 Video Script:</h4>
                <div className={`${contentTextClass} leading-relaxed bg-gray-50 p-3 rounded-lg border-l-4 border-purple-400`}>
                  {showFullContent ? (content.short_video_script || content.long_video_script) : (content.short_video_script || content.long_video_script).substring(0, 200)}
                  {(content.short_video_script || content.long_video_script).length > 200 && (
                    <button
                      onClick={() => setShowFullContent(!showFullContent)}
                      className="ml-2 text-pink-500 hover:text-pink-600 font-medium"
                    >
                      {showFullContent ? 'Show less' : '...Show more'}
                    </button>
                  )}
                </div>
              </div>
            ) : (contentType?.toLowerCase() === 'short_video or reel') && content.content ? (
              <div className={`${contentTextClass} leading-relaxed`}>
                {showFullContent ? content.content : content.content.substring(0, 200)}
                {content.content.length > 200 && (
                  <button
                    onClick={() => setShowFullContent(!showFullContent)}
                    className="ml-2 text-pink-500 hover:text-pink-600 font-medium"
                  >
                    {showFullContent ? 'Show less' : '...Show more'}
                  </button>
                )}
              </div>
            ) : contentType?.toLowerCase() === 'message' && content.message ? (
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">💬 Message:</h4>
                <div className="text-gray-800 leading-relaxed bg-gray-50 p-3 rounded-lg border-l-4 border-green-400">
                  {content.message}
                </div>
              </div>
            ) : (
              <div className={`${contentTextClass} leading-relaxed`}>
                {showFullContent ? contentText : contentText.substring(0, 200)}
                {contentText.length > 200 && (
                  <button
                    onClick={() => setShowFullContent(!showFullContent)}
                    className="ml-2 text-pink-500 hover:text-pink-600 font-medium"
                  >
                    {showFullContent ? 'Show less' : '...Show more'}
                  </button>
                )}
              </div>
            )}

            {/* Call to Action */}
            {content.call_to_action && (
              <div className="bg-blue-50 border-l-4 border-blue-400 p-3 rounded-r-lg">
                <p className="text-sm text-blue-800 font-medium">
                  💬 {content.call_to_action}
                </p>
              </div>
            )}

            {/* Engagement Hooks */}
            {content.engagement_hooks && (
              <div className="bg-green-50 border-l-4 border-green-400 p-3 rounded-r-lg">
                <p className="text-sm text-green-800 font-medium">
                  🎯 {content.engagement_hooks}
                </p>
              </div>
            )}

            {/* Image Caption */}
            {content.image_caption && (
              <div className="bg-gray-50 border-l-4 border-gray-400 p-3 rounded-r-lg">
                <p className="text-sm text-gray-700 italic">
                  📷 {content.image_caption}
                </p>
              </div>
            )}

            {/* Visual Elements */}
            {content.visual_elements && content.visual_elements.length > 0 && (
              <div className="bg-purple-50 border-l-4 border-purple-400 p-3 rounded-r-lg">
                <p className="text-sm text-purple-800 font-medium mb-2">
                  🎨 Visual Elements:
                </p>
                <div className="flex flex-wrap gap-1">
                  {content.visual_elements.map((element, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs"
                    >
                      {element}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Hashtags */}
            {hashtags && hashtags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {hashtags.map((tag, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center px-2 py-1 bg-pink-100 text-pink-700 rounded-full text-xs font-medium"
                  >
                    <Hash className="w-3 h-3 mr-1" />
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Footer - Hidden in minimal mode */}
      {!minimal && (
        <div className="px-4 py-3 bg-gray-50 border-t border-gray-200">
          <div className="flex items-center justify-between text-sm text-gray-500">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-1">
                <Heart className="w-4 h-4" />
                <span>0</span>
              </div>
              <div className="flex items-center space-x-1">
                <MessageCircle className="w-4 h-4" />
                <span>0</span>
              </div>
              <div className="flex items-center space-x-1">
                <Share className="w-4 h-4" />
                <span>0</span>
              </div>
            </div>
            <div className="flex items-center space-x-1">
              <Calendar className="w-4 h-4" />
              <span>Draft</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ContentCard;
