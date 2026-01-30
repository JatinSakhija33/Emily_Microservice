import React, { useState, useEffect } from 'react'
import { 
  X, 
  Upload, 
  Image, 
  Folder, 
  Search,
  Sparkles,
  Palette,
  Calendar,
  Briefcase,
  Share2,
  Mail,
  Loader2,
  Check,
  Star,
  Eye
} from 'lucide-react'
import { supabase } from '../lib/supabase'

const API_BASE_URL = (() => {
  // For local development, always use localhost
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'http://localhost:8000'
  }
  
  // Check for environment variable
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL.replace(/\/+$/, '') // Remove all trailing slashes
  }
  
  // Production fallback
  return 'https://agent-emily.onrender.com'
})()

const TemplateSelector = ({ isOpen, onClose, onTemplateSelect, onCustomUpload }) => {
  const [templates, setTemplates] = useState([])
  const [categories, setCategories] = useState([])
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showUpload, setShowUpload] = useState(false)
  const [customTemplateFile, setCustomTemplateFile] = useState(null)
  const [customTemplateName, setCustomTemplateName] = useState('')
  const [customTemplateCategory, setCustomTemplateCategory] = useState('')
  const [customTemplateDescription, setCustomTemplateDescription] = useState('')
  const [uploading, setUploading] = useState(false)
  const [showFullImage, setShowFullImage] = useState({ isOpen: false, imageUrl: '', title: '', isHtml: false, htmlContent: '' })
  
  // Confirmation popup state
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [templateToConfirm, setTemplateToConfirm] = useState(null)

  // Category icons mapping
  const categoryIcons = {
    'social-media': Share2,
    'marketing': Sparkles,
    'events': Calendar,
    'business': Briefcase,
    'creative': Palette,
    'newsletter': Mail
  }

  const categoryColors = {
    'social-media': 'from-blue-500 to-blue-600',
    'marketing': 'from-red-500 to-red-600',
    'events': 'from-green-500 to-green-600',
    'business': 'from-gray-500 to-gray-600',
    'creative': 'from-purple-500 to-purple-600',
    'newsletter': 'from-orange-500 to-orange-600'
  }

  useEffect(() => {
    if (isOpen) {
      loadTemplates()
      loadCategories()
    }
  }, [isOpen])

  const getAuthToken = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token
  }

  const loadTemplates = async () => {
    try {
      setIsLoading(true)
      // Load templates from static JSON file
      const response = await fetch(`${API_BASE_URL}/api/template-editor/templates.json`)
      const data = await response.json()
      if (data.templates) {
        setTemplates(data.templates)
      }
    } catch (error) {
      console.error('Error loading templates:', error)
      // Fallback to hardcoded templates if API fails
      setTemplates([])
    } finally {
      setIsLoading(false)
    }
  }

  const loadCategories = async () => {
    try {
      // Load categories from static JSON file
      const response = await fetch(`${API_BASE_URL}/api/template-editor/templates.json`)
      const data = await response.json()
      if (data.categories) {
        setCategories(data.categories)
      }
    } catch (error) {
      console.error('Error loading categories:', error)
      // Fallback to hardcoded categories if API fails
      setCategories([])
    }
  }

  const filteredTemplates = templates.filter(template => {
    const matchesCategory = selectedCategory === 'all' || template.category === selectedCategory
    const matchesSearch = template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         template.description.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesCategory && matchesSearch
  })

  const handleTemplateSelect = (template) => {
    setTemplateToConfirm(template)
    setShowConfirmation(true)
  }

  const confirmTemplateSelection = () => {
    if (templateToConfirm) {
      onTemplateSelect(templateToConfirm)
      onClose()
    }
    setShowConfirmation(false)
    setTemplateToConfirm(null)
  }

  const cancelTemplateSelection = () => {
    setShowConfirmation(false)
    setTemplateToConfirm(null)
  }

  const handleCustomUpload = async () => {
    if (!customTemplateFile || !customTemplateName.trim()) return

    try {
      setUploading(true)
      const formData = new FormData()
      formData.append('template_name', customTemplateName)
      formData.append('category', customTemplateCategory)
      formData.append('description', customTemplateDescription)
      formData.append('template_image', customTemplateFile)

      const authToken = await getAuthToken()
      const response = await fetch(`${API_BASE_URL}/api/template-editor/upload-template`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`
        },
        body: formData
      })

      const data = await response.json()
      if (data.success) {
        // Reload templates to include the new one
        await loadTemplates()
        setShowUpload(false)
        setCustomTemplateFile(null)
        setCustomTemplateName('')
        setCustomTemplateCategory('')
        setCustomTemplateDescription('')
      }
    } catch (error) {
      console.error('Error uploading template:', error)
    } finally {
      setUploading(false)
    }
  }

  const getTemplateImageUrl = (template) => {
    // Return the template URL (works for both HTML and image templates)
    return `${API_BASE_URL}/api/template-editor/template-image/${template.category}/${template.filename}`
  }

  const getTemplatePreviewUrl = (template) => {
    // For HTML templates, return PNG preview URL; for images, return the image itself
    if (isHtmlTemplate(template)) {
      return `${API_BASE_URL}/api/template-editor/template-preview-image/${template.category}/${template.filename}`
    }
    // For non-HTML templates, return the image URL
    return `${API_BASE_URL}/api/template-editor/template-image/${template.category}/${template.filename}`
  }

  const isHtmlTemplate = (template) => {
    // Check if template format is HTML or if filename ends with .html
    return template.format === 'html' || (template.filename && template.filename.toLowerCase().endsWith('.html'))
  }

  if (!isOpen) return null

  return (
    <div className="fixed bg-transparent flex items-center justify-center z-50 p-4 md:left-48 xl:left-64" style={{ right: '0', top: '0', bottom: '0' }}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-500 to-pink-500 p-6 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                <Sparkles className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">Choose Your Template</h2>
                <p className="text-purple-100">Select a pre-made template or upload your own</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {/* Search and Filter */}
          <div className="mb-6">
            <div className="flex flex-col md:flex-row gap-4">
              {/* Search */}
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search templates..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>

              {/* Category Filter */}
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setSelectedCategory('all')}
                  className={`px-4 py-2 rounded-lg font-medium transition-all ${
                    selectedCategory === 'all'
                      ? 'bg-purple-100 text-purple-700 border-2 border-purple-300'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  All
                </button>
                {categories.map(category => {
                  const IconComponent = categoryIcons[category.name] || Folder
                  return (
                    <button
                      key={category.name}
                      onClick={() => setSelectedCategory(category.name)}
                      className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center space-x-2 ${
                        selectedCategory === category.name
                          ? 'bg-purple-100 text-purple-700 border-2 border-purple-300'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      <IconComponent className="w-4 h-4" />
                      <span>{category.display_name}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Templates Grid */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
              <span className="ml-2 text-gray-600">Loading templates...</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
              {filteredTemplates.map(template => {
                const IconComponent = categoryIcons[template.category] || Folder
                const colorClass = categoryColors[template.category] || 'from-gray-500 to-gray-600'
                
                return (
                  <div
                    key={template.id}
                    onClick={() => handleTemplateSelect(template)}
                    className="group cursor-pointer bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-xl hover:scale-[1.02] transition-all duration-300"
                  >
                    {/* Template Preview */}
                    <div className="aspect-video bg-gray-100 relative overflow-hidden">
                      <img
                        src={getTemplatePreviewUrl(template)}
                        alt={template.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 cursor-pointer"
                        onClick={async (e) => {
                          e.stopPropagation()
                          try {
                            if (isHtmlTemplate(template)) {
                              // For HTML templates, fetch HTML content for full preview
                              const response = await fetch(getTemplateImageUrl(template))
                              const htmlContent = await response.text()
                              setShowFullImage({ 
                                isOpen: true, 
                                imageUrl: getTemplateImageUrl(template), 
                                title: template.name,
                                isHtml: true,
                                htmlContent: htmlContent
                              })
                            } else {
                              // For image templates, show the image
                              setShowFullImage({ 
                                isOpen: true, 
                                imageUrl: getTemplateImageUrl(template), 
                                title: template.name,
                                isHtml: false,
                                htmlContent: ''
                              })
                            }
                          } catch (error) {
                            console.error('Error loading template:', error)
                          }
                        }}
                        onError={(e) => {
                          // If PNG preview fails, fallback to iframe for HTML or show error for images
                          e.target.style.display = 'none'
                          const fallback = e.target.nextSibling
                          if (fallback) {
                            fallback.style.display = 'flex'
                            // If it's an HTML template and preview failed, try loading iframe as fallback
                            if (isHtmlTemplate(template)) {
                              const iframe = document.createElement('iframe')
                              iframe.src = getTemplateImageUrl(template)
                              iframe.className = 'w-full h-full border-0'
                              iframe.sandbox = 'allow-same-origin'
                              iframe.title = template.name
                              fallback.appendChild(iframe)
                            }
                          }
                        }}
                      />
                      <div className="absolute inset-0 bg-gray-100 flex items-center justify-center" style={{ display: 'none' }}>
                        <Image className="w-12 h-12 text-gray-400" />
                      </div>
                      
                      {/* Category Badge */}
                      <div className={`absolute top-3 left-3 px-3 py-1 rounded-full text-white text-xs font-medium bg-gradient-to-r ${colorClass}`}>
                        <IconComponent className="w-3 h-3 inline mr-1" />
                        {template.category.replace('-', ' ')}
                      </div>

                      {/* Hover Overlay */}
                      <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all duration-300 flex items-center justify-center">
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                          <button
                            onClick={async (e) => {
                              e.stopPropagation()
                              try {
                                if (isHtmlTemplate(template)) {
                                  // Fetch HTML content for full preview
                                  const response = await fetch(getTemplateImageUrl(template))
                                  const htmlContent = await response.text()
                                  setShowFullImage({ 
                                    isOpen: true, 
                                    imageUrl: getTemplateImageUrl(template), 
                                    title: template.name,
                                    isHtml: true,
                                    htmlContent: htmlContent
                                  })
                                } else {
                                  setShowFullImage({ 
                                    isOpen: true, 
                                    imageUrl: getTemplateImageUrl(template), 
                                    title: template.name,
                                    isHtml: false,
                                    htmlContent: ''
                                  })
                                }
                              } catch (error) {
                                console.error('Error loading template:', error)
                              }
                            }}
                            className="bg-white rounded-lg px-4 py-2 flex items-center space-x-2 hover:bg-gray-50 transition-colors"
                          >
                            <Eye className="w-4 h-4 text-purple-600" />
                            <span className="text-sm font-medium text-purple-600">Preview</span>
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Template Info */}
                    <div className="p-4">
                      <h3 className="font-semibold text-gray-900 mb-1 group-hover:text-purple-600 transition-colors">
                        {template.name}
                      </h3>
                      <p className="text-sm text-gray-600 capitalize">
                        {template.category.replace('-', ' ')} template
                      </p>
                      
                      {/* Template Stats */}
                      <div className="flex items-center justify-between mt-3">
                        <div className="flex items-center space-x-1 text-xs text-gray-500">
                          <Star className="w-3 h-3" />
                          <span>Popular</span>
                        </div>
                        <div className="text-xs text-gray-500">
                          {template.content_areas?.length || 0} content areas
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Upload Custom Template Button */}
          <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-purple-400 transition-colors">
            <div className="flex flex-col items-center space-y-4">
              <div className="w-16 h-16 bg-gradient-to-r from-purple-100 to-pink-100 rounded-full flex items-center justify-center">
                <Upload className="w-8 h-8 text-purple-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Don't see what you need?</h3>
                <p className="text-gray-600 mb-4">Upload your own custom template and use it right away</p>
                <button
                  onClick={() => setShowUpload(true)}
                  className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:from-purple-600 hover:to-pink-600 transition-all duration-200 font-medium"
                >
                  Upload Custom Template
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Custom Template Upload Modal */}
      {showUpload && (
        <div className="fixed bg-black bg-opacity-60 flex items-center justify-center z-60 p-4 md:left-48 xl:left-64" style={{ right: '0', top: '0', bottom: '0' }}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-gray-900">Upload Custom Template</h3>
                <button
                  onClick={() => setShowUpload(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Template Name *
                </label>
                <input
                  type="text"
                  value={customTemplateName}
                  onChange={(e) => setCustomTemplateName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Enter template name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Category *
                </label>
                <select
                  value={customTemplateCategory}
                  onChange={(e) => setCustomTemplateCategory(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="">Select category</option>
                  {categories.map(category => (
                    <option key={category.name} value={category.name}>
                      {category.display_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={customTemplateDescription}
                  onChange={(e) => setCustomTemplateDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  rows={3}
                  placeholder="Describe your template..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Template Image *
                </label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
                  <input
                    type="file"
                    accept="image/*,.png,.jpg,.jpeg,.gif,.webp"
                    onChange={(e) => setCustomTemplateFile(e.target.files[0])}
                    className="hidden"
                    id="template-file-upload"
                  />
                  <label
                    htmlFor="template-file-upload"
                    className="cursor-pointer flex flex-col items-center space-y-2"
                  >
                    <Upload className="w-8 h-8 text-gray-400" />
                    <span className="text-sm text-gray-600">
                      {customTemplateFile ? customTemplateFile.name : 'Click to upload image'}
                    </span>
                  </label>
                </div>
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  onClick={handleCustomUpload}
                  disabled={!customTemplateFile || !customTemplateName.trim() || !customTemplateCategory || uploading}
                  className="flex-1 bg-gradient-to-r from-purple-500 to-pink-500 text-white py-2 px-4 rounded-lg hover:from-purple-600 hover:to-pink-600 transition-all duration-200 disabled:opacity-50 flex items-center justify-center space-x-2"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Uploading...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Upload Template</span>
                    </>
                  )}
                </button>
                
                <button
                  onClick={() => setShowUpload(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Full Image/HTML Preview Modal */}
      {showFullImage.isOpen && (
        <div className="fixed bg-black bg-opacity-75 flex items-center justify-center z-[60] p-4 md:left-48 xl:left-64" style={{ right: '0', top: '0', bottom: '0' }}>
          <div className="relative max-w-4xl max-h-[90vh] bg-white rounded-lg shadow-2xl flex flex-col">
            {/* Header */}
            <div className="flex justify-between items-center p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-800">{showFullImage.title}</h3>
              <button
                onClick={() => setShowFullImage({ isOpen: false, imageUrl: '', title: '', isHtml: false, htmlContent: '' })}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* Preview Content */}
            <div className="p-4 flex-1 overflow-auto">
              {showFullImage.isHtml && showFullImage.htmlContent ? (
                <div 
                  className="w-full bg-gray-50 rounded-lg p-6"
                  dangerouslySetInnerHTML={{ __html: showFullImage.htmlContent }}
                  style={{
                    lineHeight: '1.8',
                    color: '#374151'
                  }}
                />
              ) : (
                <img
                  src={showFullImage.imageUrl}
                  alt={showFullImage.title}
                  className="max-w-full max-h-[70vh] object-contain rounded-lg mx-auto"
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Popup */}
      {showConfirmation && templateToConfirm && (
        <div className="fixed bg-black bg-opacity-50 flex items-center justify-center z-[70] p-4 md:left-48 xl:left-64" style={{ right: '0', top: '0', bottom: '0' }}>
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-600 rounded-lg flex items-center justify-center">
                  <Sparkles className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Confirm Template</h3>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="p-6">
              <div className="text-center mb-6">
                <div className="aspect-video bg-gray-100 rounded-lg mb-4 flex items-center justify-center max-w-xs mx-auto relative overflow-hidden">
                  <img
                    src={getTemplatePreviewUrl(templateToConfirm)}
                    alt={templateToConfirm.name}
                    className="w-full h-full object-cover rounded-lg"
                    onError={(e) => {
                      // Fallback to iframe for HTML templates if preview fails
                      e.target.style.display = 'none'
                      const fallback = e.target.nextSibling
                      if (fallback) {
                        fallback.style.display = 'flex'
                        if (isHtmlTemplate(templateToConfirm)) {
                          const iframe = document.createElement('iframe')
                          iframe.src = getTemplateImageUrl(templateToConfirm)
                          iframe.className = 'w-full h-full border-0 rounded-lg'
                          iframe.sandbox = 'allow-same-origin'
                          iframe.title = templateToConfirm.name
                          iframe.style.minHeight = '200px'
                          fallback.appendChild(iframe)
                        }
                      }
                    }}
                  />
                  <div className="absolute inset-0 bg-gray-100 flex items-center justify-center" style={{ display: 'none' }}>
                    <Image className="w-16 h-16 text-gray-400" />
                  </div>
                </div>
                <h4 className="font-semibold text-gray-900 text-lg">{templateToConfirm.name}</h4>
                <p className="text-sm text-gray-500 capitalize">{templateToConfirm.category.replace('-', ' ')} template</p>
              </div>

              <div className="flex justify-center space-x-3">
                <button
                  onClick={confirmTemplateSelection}
                  className="px-6 py-2 bg-gradient-to-r from-purple-500 to-pink-600 text-white rounded-lg hover:from-purple-600 hover:to-pink-700 transition-all"
                >
                  Confirm
                </button>
                <button
                  onClick={cancelTemplateSelection}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default TemplateSelector
