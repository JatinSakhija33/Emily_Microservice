import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useNotifications } from '../contexts/NotificationContext'
import { createClient } from '@supabase/supabase-js'
import { 
  Upload, 
  Image, 
  Palette, 
  Wand2, 
  Save, 
  RotateCcw, 
  Eye, 
  Download,
  X,
  Check,
  Loader2,
  Sparkles,
  Template,
  Layers
} from 'lucide-react'

// Initialize Supabase client
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

const TemplateEditor = ({ content, onClose, onSave }) => {
  const { user } = useAuth()
  const { showSuccess, showError, showLoading } = useNotifications()
  
  // State management
  const [currentStep, setCurrentStep] = useState(1)
  const [workflowId, setWorkflowId] = useState(null)
  const [isProcessing, setIsProcessing] = useState(false)
  
  // Template selection
  const [selectedTemplate, setSelectedTemplate] = useState(null)
  const [templateImage, setTemplateImage] = useState(null)
  const [premadeTemplates, setPremadeTemplates] = useState([])
  const [categories, setCategories] = useState([])
  const [selectedCategory, setSelectedCategory] = useState('all')
  
  // Custom template upload
  const [customTemplateFile, setCustomTemplateFile] = useState(null)
  const [templateName, setTemplateName] = useState('')
  const [templateCategory, setTemplateCategory] = useState('')
  const [templateDescription, setTemplateDescription] = useState('')
  
  // Workflow state
  const [workflowStatus, setWorkflowStatus] = useState('idle')
  const [finalTemplate, setFinalTemplate] = useState(null)
  const [customInstructions, setCustomInstructions] = useState('')
  const [userSatisfied, setUserSatisfied] = useState(false)
  
  // Preview states
  const [showPreview, setShowPreview] = useState(false)
  const [previewImage, setPreviewImage] = useState(null)
  

  useEffect(() => {
    loadPremadeTemplates()
    loadCategories()
  }, [])



  const loadPremadeTemplates = async () => {
    try {
      const response = await fetch('/api/template-editor/premade-templates', {
        headers: {
          'Authorization': `Bearer ${await getAuthToken()}`
        }
      })
      const data = await response.json()
      if (data.success) {
        setPremadeTemplates(data.templates)
      }
    } catch (error) {
      console.error('Error loading templates:', error)
    }
  }

  const loadCategories = async () => {
    try {
      const response = await fetch('/api/template-editor/categories', {
        headers: {
          'Authorization': `Bearer ${await getAuthToken()}`
        }
      })
      const data = await response.json()
      if (data.success) {
        setCategories(data.categories)
      }
    } catch (error) {
      console.error('Error loading categories:', error)
    }
  }

  const getAuthToken = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token
  }

  const handleTemplateSelect = (template) => {
    setSelectedTemplate(template)
    setTemplateImage(template.template_image)
  }

  const handleCustomTemplateUpload = (event) => {
    const file = event.target.files[0]
    if (file) {
      setCustomTemplateFile(file)
      const reader = new FileReader()
      reader.onload = (e) => {
        setTemplateImage(e.target.result)
      }
      reader.readAsDataURL(file)
    }
  }

  const startTemplateEditing = async () => {
    if (!templateImage) {
      showError('Please select a template first')
      return
    }

    setIsProcessing(true)
    showLoading('Starting template editing process...')

    try {
      const formData = new FormData()
      formData.append('content_id', content.id)
      
      if (selectedTemplate) {
        formData.append('template_id', selectedTemplate.id)
      } else if (customTemplateFile) {
        formData.append('template_image', customTemplateFile)
      }

      const response = await fetch('/api/template-editor/start-editing', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${await getAuthToken()}`
        },
        body: formData
      })

      const data = await response.json()
      
      if (data.success) {
        setWorkflowId(data.workflow_id)
        setCurrentStep(2)
        setWorkflowStatus('processing')
        showSuccess('Template editing started successfully!')
      } else {
        showError(data.error || 'Failed to start template editing')
      }
    } catch (error) {
      showError('Error starting template editing: ' + error.message)
    } finally {
      setIsProcessing(false)
    }
  }

  const continueWorkflow = async (action) => {
    if (!workflowId) return

    setIsProcessing(true)

    try {
      const formData = new FormData()
      formData.append('workflow_id', workflowId)
      formData.append('user_satisfied', action === 'save')
      formData.append('custom_instructions', customInstructions)
      formData.append('needs_restart', action === 'restart')

      const response = await fetch('/api/template-editor/continue-workflow', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${await getAuthToken()}`
        },
        body: formData
      })

      const data = await response.json()
      
      if (data.success) {
        if (data.final_template) {
          setFinalTemplate(data.final_template)
          setPreviewImage(data.final_template)
        }
        
        if (action === 'save') {
          handleSaveTemplate()
        } else if (action === 'restart') {
          setCurrentStep(1)
          setWorkflowId(null)
          setFinalTemplate(null)
          setCustomInstructions('')
        }
      } else {
        showError(data.error || 'Failed to continue workflow')
      }
    } catch (error) {
      showError('Error continuing workflow: ' + error.message)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleSaveTemplate = async () => {
    if (!finalTemplate) return

    try {
      // Convert base64 to blob
      const response = await fetch(finalTemplate)
      const blob = await response.blob()
      
      // Upload to Supabase storage
      const fileExt = 'jpg'
      const fileName = `template_edited_${Date.now()}.${fileExt}`
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('user-uploads')
        .upload(fileName, blob, {
          contentType: 'image/jpeg',
          upsert: false
        })

      if (uploadError) throw uploadError

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('user-uploads')
        .getPublicUrl(fileName)

      // Update content with new image
      const { error: updateError } = await supabase
        .from('content')
        .update({ 
          image_url: urlData.publicUrl,
          updated_at: new Date().toISOString()
        })
        .eq('id', content.id)

      if (updateError) throw updateError

      showSuccess('Template saved successfully!')
      onSave && onSave(urlData.publicUrl)
      onClose()
    } catch (error) {
      showError('Error saving template: ' + error.message)
    }
  }

  const downloadTemplate = () => {
    if (!finalTemplate) return
    
    const link = document.createElement('a')
    link.href = finalTemplate
    link.download = `template_${Date.now()}.jpg`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const filteredTemplates = selectedCategory === 'all' 
    ? premadeTemplates 
    : premadeTemplates.filter(t => t.category === selectedCategory)

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-600 rounded-lg flex items-center justify-center">
              <Template className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Template Editor</h2>
              <p className="text-sm text-gray-500">Transform your content into beautiful graphics</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {currentStep === 1 && (
            <div className="space-y-6">
              {/* Template Selection */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Choose Template</h3>
                
                {/* Category Filter */}
                <div className="mb-4">
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setSelectedCategory('all')}
                      className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                        selectedCategory === 'all'
                          ? 'bg-purple-100 text-purple-700 border border-purple-200'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      All
                    </button>
                    {categories.map(category => (
                      <button
                        key={category}
                        onClick={() => setSelectedCategory(category)}
                        className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                          selectedCategory === category
                            ? 'bg-purple-100 text-purple-700 border border-purple-200'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {category}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Premade Templates Grid */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
                  {filteredTemplates.map(template => (
                    <div
                      key={template.id}
                      onClick={() => handleTemplateSelect(template)}
                      className={`p-3 border-2 rounded-lg cursor-pointer transition-all ${
                        selectedTemplate?.id === template.id
                          ? 'border-purple-500 bg-purple-50'
                          : 'border-gray-200 hover:border-purple-300 hover:bg-gray-50'
                      }`}
                    >
                      <div className="aspect-square bg-gray-100 rounded-lg mb-2 flex items-center justify-center">
                        {template.preview_url ? (
                          <img 
                            src={template.preview_url} 
                            alt={template.name}
                            className="w-full h-full object-cover rounded-lg"
                          />
                        ) : (
                          <Template className="w-8 h-8 text-gray-400" />
                        )}
                      </div>
                      <h4 className="font-medium text-sm text-gray-900 truncate">{template.name}</h4>
                      <p className="text-xs text-gray-500">{template.category}</p>
                    </div>
                  ))}
                </div>

                {/* Custom Template Upload */}
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                  <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <h4 className="font-medium text-gray-900 mb-2">Upload Custom Template</h4>
                  <p className="text-sm text-gray-500 mb-4">Upload your own template image</p>
                  
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleCustomTemplateUpload}
                    className="hidden"
                    id="custom-template-upload"
                  />
                  <label
                    htmlFor="custom-template-upload"
                    className="inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 cursor-pointer transition-colors"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Choose File
                  </label>
                  
                  {customTemplateFile && (
                    <div className="mt-4">
                      <div className="flex items-center space-x-2 text-sm text-green-600">
                        <Check className="w-4 h-4" />
                        <span>{customTemplateFile.name}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Preview */}
              {templateImage && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-medium text-gray-900 mb-2">Template Preview</h4>
                  <div className="max-w-md mx-auto">
                    <img 
                      src={templateImage} 
                      alt="Template preview"
                      className="w-full h-auto rounded-lg shadow-sm"
                    />
                  </div>
                </div>
              )}



              {/* Action Buttons */}
              <div className="flex justify-end space-x-3">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={startTemplateEditing}
                  disabled={!templateImage || isProcessing}
                  className="px-6 py-2 bg-gradient-to-r from-purple-500 to-pink-600 text-white rounded-lg hover:from-purple-600 hover:to-pink-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                >
                  {isProcessing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Wand2 className="w-4 h-4" />
                  )}
                  <span>{isProcessing ? 'Processing...' : 'Start Editing'}</span>
                </button>
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-6">
              {/* Processing Status */}
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-pink-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  {isProcessing ? (
                    <Loader2 className="w-8 h-8 text-white animate-spin" />
                  ) : (
                    <Sparkles className="w-8 h-8 text-white" />
                  )}
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  {isProcessing ? 'Processing Template...' : 'Template Ready!'}
                </h3>
                <p className="text-gray-500">
                  {isProcessing 
                    ? 'Our AI is analyzing your template and adapting your content...'
                    : 'Your template has been processed and is ready for review.'
                  }
                </p>
              </div>

              {/* Final Template Preview */}
              {finalTemplate && (
                <div className="bg-gray-50 rounded-lg p-6">
                  <h4 className="font-medium text-gray-900 mb-4">Generated Template</h4>
                  <div className="max-w-lg mx-auto">
                    <img 
                      src={finalTemplate} 
                      alt="Generated template"
                      className="w-full h-auto rounded-lg shadow-lg"
                    />
                  </div>
                  
                  {/* Custom Instructions */}
                  <div className="mt-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Custom Instructions (Optional)
                    </label>
                    <textarea
                      value={customInstructions}
                      onChange={(e) => setCustomInstructions(e.target.value)}
                      placeholder="Describe any specific changes you'd like to make..."
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      rows={3}
                    />
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-center space-x-4">
                <button
                  onClick={() => continueWorkflow('restart')}
                  disabled={isProcessing}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 flex items-center space-x-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Start Over</span>
                </button>
                
                {finalTemplate && (
                  <>
                    <button
                      onClick={downloadTemplate}
                      className="px-4 py-2 text-blue-700 bg-blue-100 rounded-lg hover:bg-blue-200 transition-colors flex items-center space-x-2"
                    >
                      <Download className="w-4 h-4" />
                      <span>Download</span>
                    </button>
                    
                    <button
                      onClick={() => continueWorkflow('custom_edit')}
                      disabled={isProcessing || !customInstructions.trim()}
                      className="px-4 py-2 text-orange-700 bg-orange-100 rounded-lg hover:bg-orange-200 transition-colors disabled:opacity-50 flex items-center space-x-2"
                    >
                      <Wand2 className="w-4 h-4" />
                      <span>Apply Changes</span>
                    </button>
                    
                    <button
                      onClick={() => continueWorkflow('save')}
                      disabled={isProcessing}
                      className="px-6 py-2 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg hover:from-green-600 hover:to-green-700 transition-all disabled:opacity-50 flex items-center space-x-2"
                    >
                      <Save className="w-4 h-4" />
                      <span>Save Template</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

    </div>
  )
}

export default TemplateEditor
