import React, { useState, useEffect } from 'react'
import { X } from 'lucide-react'

const NewPostModal = ({ isOpen, onClose, onSubmit, isDarkMode }) => {
  const [formData, setFormData] = useState({
    channel: '',
    platform: '',
    content_type: '',
    media: '',
    content_idea: '',
    Post_type: '',
    Image_type: ''
  })

  const [errors, setErrors] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setFormData({
        channel: '',
        platform: '',
        content_type: '',
        media: '',
        content_idea: '',
        Post_type: '',
        Image_type: ''
      })
      setErrors({})
    }
  }, [isOpen])

  const handleInputChange = (field, value) => {
    setFormData(prev => {
      const newData = { ...prev, [field]: value }

      // Reset dependent fields when parent field changes
      if (field === 'channel') {
        newData.platform = ''
        newData.content_type = ''
      } else if (field === 'platform') {
        newData.content_type = ''
      } else if (field === 'media') {
        newData.Image_type = ''
      }

      return newData
    })

    // Clear error when field is filled
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: null
      }))
    }
  }

  const validateForm = () => {
    const newErrors = {}

    if (!formData.channel) newErrors.channel = 'Please select a channel'
    if (!formData.platform) newErrors.platform = 'Please select a platform'
    if (!formData.content_type) newErrors.content_type = 'Please select content type'
    if (!formData.media) newErrors.media = 'Please select media option'

    if (!formData.content_idea.trim()) {
      newErrors.content_idea = 'Please provide a content idea'
    } else if (formData.content_idea.trim().split(/\s+/).length < 10) {
      newErrors.content_idea = 'Content idea must be at least 10 words'
    }

    if (!formData.Post_type) newErrors.Post_type = 'Please select a post type'

    // Image_type is required only when media is "Generate"
    if (formData.media === 'Generate' && !formData.Image_type) {
      newErrors.Image_type = 'Please select an image type'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!validateForm()) return

    setIsSubmitting(true)

    try {
      // Convert form data to payload format expected by backend
      const payload = {
        channel: formData.channel,
        platform: formData.platform,
        content_type: formData.content_type,
        media: formData.media,
        content_idea: formData.content_idea.trim(),
        Post_type: formData.Post_type,
        ...(formData.media === 'Generate' && { Image_type: formData.Image_type })
      }

      await onSubmit(payload)
      onClose()
    } catch (error) {
      console.error('Error submitting form:', error)
      setErrors({ submit: 'Failed to create post. Please try again.' })
    } finally {
      setIsSubmitting(false)
    }
  }

  const channelOptions = [
    { label: 'Social Media', value: 'Social Media' },
    { label: 'Blog', value: 'Blog' }
  ]

  const platformOptions = [
    { label: 'Instagram', value: 'Instagram' },
    { label: 'Facebook', value: 'Facebook' },
    { label: 'LinkedIn', value: 'LinkedIn' },
    { label: 'YouTube', value: 'YouTube' }
  ]

  const contentTypeOptions = [
    { label: 'Static Post', value: 'static_post' },
    { label: 'Carousel', value: 'carousel' },
    { label: 'Short Video/Reel', value: 'short_video or reel' },
    { label: 'Long Video', value: 'long_video' },
    { label: 'Blog Post', value: 'blog' }
  ]

  const mediaOptions = [
    { label: 'Generate Images', value: 'Generate' },
    { label: 'Upload My Own', value: 'Upload' },
    { label: 'Text Only', value: 'Without media' }
  ]

  const postTypeOptions = [
    'Educational tips',
    'Quote / motivation',
    'Promotional offer',
    'Product showcase',
    'Carousel infographic',
    'Announcement',
    'Testimonial / review',
    'Before–after',
    'Behind-the-scenes',
    'User-generated content',
    'Brand story',
    'Meme / humor',
    'Facts / did-you-know',
    'Event highlight',
    'Countdown',
    'FAQ post',
    'Comparison',
    'Case study snapshot',
    'Milestone / achievement',
    'Call-to-action post'
  ]

  const imageTypeOptions = [
    'Minimal & Clean with Bold Typography',
    'Modern Corporate / B2B Professional',
    'Luxury Editorial (Black, White, Gold Accents)',
    'Photography-Led Lifestyle Aesthetic',
    'Product-Focused Clean Commercial Style',
    'Flat Illustration with Friendly Characters',
    'Isometric / Explainer Illustration Style',
    'Playful & Youthful (Memphis / Stickers / Emojis)',
    'High-Impact Color-Blocking with Loud Type',
    'Retro / Vintage Poster Style',
    'Futuristic Tech / AI-Inspired Dark Mode',
    'Glassmorphism / Neumorphism UI Style',
    'Abstract Shapes & Fluid Gradient Art',
    'Infographic / Data-Driven Educational Layout',
    'Quote Card / Thought-Leadership Typography Post',
    'Meme-Style / Social-Native Engagement Post',
    'Festive / Campaign-Based Creative',
    'Textured Design (Paper, Grain, Handmade Feel)',
    'Magazine / Editorial Layout with Strong Hierarchy',
    'Experimental / Artistic Concept-Driven Design'
  ]

  // Get filtered platform options based on channel
  const getFilteredPlatformOptions = () => {
    if (formData.channel === 'Blog') {
      return [{ label: 'Blog', value: 'Blog' }]
    }
    return platformOptions
  }

  // Get filtered content type options based on channel and platform
  const getFilteredContentTypeOptions = () => {
    if (formData.channel === 'Blog') {
      return [{ label: 'Blog Post', value: 'blog' }]
    }

    // Social media content types
    return contentTypeOptions.filter(option => option.value !== 'blog')
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className={`relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl ${
        isDarkMode ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'
      }`}>
        {/* Header */}
        <div className={`flex items-center justify-between p-6 border-b ${
          isDarkMode ? 'border-gray-700' : 'border-gray-200'
        }`}>
          <h2 className={`text-xl font-semibold ${
            isDarkMode ? 'text-white' : 'text-gray-900'
          }`}>
            Design a New Post
          </h2>
          <button
            onClick={onClose}
            className={`p-2 rounded-lg transition-colors ${
              isDarkMode ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-600'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Channel Selection */}
          <div>
            <label className={`block text-sm font-medium mb-3 ${
              isDarkMode ? 'text-gray-200' : 'text-gray-700'
            }`}>
              Channel *
            </label>
            <select
              value={formData.channel}
              onChange={(e) => handleInputChange('channel', e.target.value)}
              className={`w-full px-4 py-3 rounded-lg border transition-colors ${
                isDarkMode
                  ? 'bg-gray-700 border-gray-600 text-white focus:border-blue-500'
                  : 'bg-white border-gray-300 text-gray-900 focus:border-blue-500'
              } focus:outline-none focus:ring-2 focus:ring-blue-500/20`}
            >
              <option value="">Select a channel...</option>
              {channelOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {errors.channel && <p className="mt-1 text-sm text-red-500">{errors.channel}</p>}
          </div>

          {/* Platform Selection */}
          <div>
            <label className={`block text-sm font-medium mb-3 ${
              isDarkMode ? 'text-gray-200' : 'text-gray-700'
            }`}>
              Platform *
            </label>
            <select
              value={formData.platform}
              onChange={(e) => handleInputChange('platform', e.target.value)}
              disabled={!formData.channel}
              className={`w-full px-4 py-3 rounded-lg border transition-colors ${
                isDarkMode
                  ? 'bg-gray-700 border-gray-600 text-white focus:border-blue-500 disabled:bg-gray-800 disabled:text-gray-500'
                  : 'bg-white border-gray-300 text-gray-900 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-400'
              } focus:outline-none focus:ring-2 focus:ring-blue-500/20`}
            >
              <option value="">
                {!formData.channel ? 'Select a channel first...' : 'Select a platform...'}
              </option>
              {getFilteredPlatformOptions().map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {errors.platform && <p className="mt-1 text-sm text-red-500">{errors.platform}</p>}
          </div>

          {/* Content Type Selection */}
          <div>
            <label className={`block text-sm font-medium mb-3 ${
              isDarkMode ? 'text-gray-200' : 'text-gray-700'
            }`}>
              Content Type *
            </label>
            <select
              value={formData.content_type}
              onChange={(e) => handleInputChange('content_type', e.target.value)}
              disabled={!formData.platform}
              className={`w-full px-4 py-3 rounded-lg border transition-colors ${
                isDarkMode
                  ? 'bg-gray-700 border-gray-600 text-white focus:border-blue-500 disabled:bg-gray-800 disabled:text-gray-500'
                  : 'bg-white border-gray-300 text-gray-900 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-400'
              } focus:outline-none focus:ring-2 focus:ring-blue-500/20`}
            >
              <option value="">
                {!formData.platform ? 'Select a platform first...' : 'Select content type...'}
              </option>
              {getFilteredContentTypeOptions().map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {errors.content_type && <p className="mt-1 text-sm text-red-500">{errors.content_type}</p>}
          </div>

          {/* Media Selection */}
          <div>
            <label className={`block text-sm font-medium mb-3 ${
              isDarkMode ? 'text-gray-200' : 'text-gray-700'
            }`}>
              Media *
            </label>
            <select
              value={formData.media}
              onChange={(e) => handleInputChange('media', e.target.value)}
              className={`w-full px-4 py-3 rounded-lg border transition-colors ${
                isDarkMode
                  ? 'bg-gray-700 border-gray-600 text-white focus:border-blue-500'
                  : 'bg-white border-gray-300 text-gray-900 focus:border-blue-500'
              } focus:outline-none focus:ring-2 focus:ring-blue-500/20`}
            >
              <option value="">Select media option...</option>
              {mediaOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {errors.media && <p className="mt-1 text-sm text-red-500">{errors.media}</p>}
          </div>

          {/* Content Idea */}
          <div className="col-span-1 md:col-span-2">
            <label className={`block text-sm font-medium mb-3 ${
              isDarkMode ? 'text-gray-200' : 'text-gray-700'
            }`}>
              Content Idea * (minimum 10 words)
            </label>
            <textarea
              value={formData.content_idea}
              onChange={(e) => handleInputChange('content_idea', e.target.value)}
              placeholder="Describe your content idea in detail. What do you want to communicate? Who is your audience? What action do you want them to take?"
              rows={4}
              className={`w-full px-4 py-3 rounded-lg border transition-colors ${
                isDarkMode
                  ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:border-blue-500'
                  : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500 focus:border-blue-500'
              } focus:outline-none focus:ring-2 focus:ring-blue-500/20`}
            />
            <div className="flex justify-between mt-1">
              <span className={`text-xs ${
                isDarkMode ? 'text-gray-400' : 'text-gray-500'
              }`}>
                {formData.content_idea.split(/\s+/).filter(word => word.length > 0).length} words
              </span>
              {errors.content_idea && <p className="text-sm text-red-500">{errors.content_idea}</p>}
            </div>
          </div>

          {/* Post Type Selection */}
          <div className="col-span-1 md:col-span-2">
            <label className={`block text-sm font-medium mb-3 ${
              isDarkMode ? 'text-gray-200' : 'text-gray-700'
            }`}>
              Post Type *
            </label>
            <select
              value={formData.Post_type}
              onChange={(e) => handleInputChange('Post_type', e.target.value)}
              className={`w-full px-4 py-3 rounded-lg border transition-colors ${
                isDarkMode
                  ? 'bg-gray-700 border-gray-600 text-white focus:border-blue-500'
                  : 'bg-white border-gray-300 text-gray-900 focus:border-blue-500'
              } focus:outline-none focus:ring-2 focus:ring-blue-500/20`}
            >
              <option value="">Select a post type...</option>
              {postTypeOptions.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
            {errors.Post_type && <p className="mt-1 text-sm text-red-500">{errors.Post_type}</p>}
          </div>

          {/* Image Type Selection - Only show when media is Generate */}
          <div className="col-span-1 md:col-span-2">
            <label className={`block text-sm font-medium mb-3 ${
              isDarkMode ? 'text-gray-200' : 'text-gray-700'
            }`}>
              Image Type {formData.media === 'Generate' ? '*' : ''}
            </label>
            <select
              value={formData.Image_type}
              onChange={(e) => handleInputChange('Image_type', e.target.value)}
              disabled={formData.media !== 'Generate'}
              className={`w-full px-4 py-3 rounded-lg border transition-colors ${
                isDarkMode
                  ? 'bg-gray-700 border-gray-600 text-white focus:border-blue-500 disabled:bg-gray-800 disabled:text-gray-500'
                  : 'bg-white border-gray-300 text-gray-900 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-400'
              } focus:outline-none focus:ring-2 focus:ring-blue-500/20`}
            >
              <option value="">
                {formData.media !== 'Generate' ? 'Select "Generate Images" first...' : 'Select an image style...'}
              </option>
              {imageTypeOptions.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
            {errors.Image_type && <p className="mt-1 text-sm text-red-500">{errors.Image_type}</p>}
          </div>

          {/* Submit Error */}
            {errors.submit && (
            <div className="col-span-1 md:col-span-2 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{errors.submit}</p>
            </div>
          )}

          {/* Submit Buttons */}
          <div className="col-span-1 md:col-span-2 flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className={`px-6 py-2 rounded-lg transition-colors ${
                isDarkMode
                  ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                  : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
              }`}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
            >
              {isSubmitting ? 'Creating...' : 'Create Post'}
            </button>
          </div>
          </div>
        </form>
      </div>
    </div>
  )
}

export default NewPostModal