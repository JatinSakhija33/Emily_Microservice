import React, { useState, useRef, useEffect } from 'react';
import { 
  ImageIcon, 
  Upload, 
  Wand2, 
  Palette, 
  Edit3, 
  RotateCcw, 
  X, 
  CheckCircle,
  Loader2,
  Sparkles,
  Download,
  Send
} from 'lucide-react';
import { supabase } from '../lib/supabase';

const API_BASE_URL = (() => {
  // Check for environment variable first
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL.replace(/\/+$/, '') // Remove all trailing slashes
  }
  
  // Fallback to production URL
  if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    return 'https://agent-emily.onrender.com'
  }
  
  // Local development fallback
  return (import.meta.env.VITE_API_URL || 'https://agent-emily.onrender.com').replace(/\/$/, '')
})();

const SimpleImageEditor = ({ 
  isOpen, 
  onClose, 
  postContent, 
  inputImageUrl, 
  onImageSaved 
}) => {
  const [currentStep, setCurrentStep] = useState('options'); // options, logo_placement, generating, preview
  const [isLoading, setIsLoading] = useState(false);
  const [editedImageUrl, setEditedImageUrl] = useState(null);
  const [userInput, setUserInput] = useState('');
  const [selectedPosition, setSelectedPosition] = useState('bottom_right');
  const [manualInstructions, setManualInstructions] = useState('');
  const [error, setError] = useState(null);
  
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const getAuthToken = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token;
  };

  const handleAddLogo = async () => {
    try {
      setIsLoading(true);
      setError(null);
      setCurrentStep('generating');

      const authToken = await getAuthToken();
      const { data: { user } } = await supabase.auth.getUser();

      const response = await fetch(`${API_BASE_URL}/simple-image-editor/add-logo`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          user_id: user?.id,
          input_image_url: inputImageUrl,
          content: postContent,
          position: selectedPosition
        })
      });

      const data = await response.json();

      if (data.success) {
        setEditedImageUrl(data.edited_image_url);
        setCurrentStep('preview');
      } else {
        throw new Error(data.error || 'Failed to add logo');
      }
    } catch (error) {
      console.error('Error adding logo:', error);
      setError(error.message);
      setCurrentStep('options');
    } finally {
      setIsLoading(false);
    }
  };

  const handleManualEdit = async () => {
    try {
      setIsLoading(true);
      setError(null);
      setCurrentStep('generating');

      const authToken = await getAuthToken();
      const { data: { user } } = await supabase.auth.getUser();

      const response = await fetch(`${API_BASE_URL}/simple-image-editor/manual-edit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          user_id: user?.id,
          input_image_url: inputImageUrl,
          content: postContent,
          instructions: manualInstructions
        })
      });

      const data = await response.json();

      if (data.success) {
        setEditedImageUrl(data.edited_image_url);
        setCurrentStep('preview');
      } else {
        throw new Error(data.error || 'Failed to apply manual instructions');
      }
    } catch (error) {
      console.error('Error applying manual instructions:', error);
      setError(error.message);
      setCurrentStep('options');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveImage = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const authToken = await getAuthToken();
      const { data: { user } } = await supabase.auth.getUser();

      const response = await fetch(`${API_BASE_URL}/simple-image-editor/save-image`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          user_id: user?.id,
          original_image_url: inputImageUrl,
          edited_image_url: editedImageUrl
        })
      });

      const data = await response.json();

      if (data.success) {
        if (onImageSaved) {
          onImageSaved(editedImageUrl);
        }
        onClose();
      } else {
        throw new Error(data.error || 'Failed to save image');
      }
    } catch (error) {
      console.error('Error saving image:', error);
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const resetEditor = () => {
    setCurrentStep('options');
    setEditedImageUrl(null);
    setUserInput('');
    setSelectedPosition('bottom_right');
    setManualInstructions('');
    setError(null);
  };

  const handleClose = () => {
    resetEditor();
    onClose();
  };

  if (!isOpen) return null;

  const renderOptions = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-800">What would you like to do?</h3>
      
      <div className="grid grid-cols-1 gap-3">
        <button
          onClick={() => setCurrentStep('logo_placement')}
          className="flex items-center space-x-3 p-4 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-xl hover:from-blue-600 hover:to-indigo-600 transition-all duration-200"
        >
          <Palette className="w-5 h-5" />
          <span>Add Logo</span>
        </button>
        
        <button
          onClick={() => setCurrentStep('manual_input')}
          className="flex items-center space-x-3 p-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl hover:from-purple-600 hover:to-pink-600 transition-all duration-200"
        >
          <Edit3 className="w-5 h-5" />
          <span>Manual Instructions</span>
        </button>
      </div>
    </div>
  );

  const renderLogoPlacement = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-800">Choose Logo Position</h3>
      
      <div className="grid grid-cols-2 gap-3">
        {[
          { value: 'top_left', label: 'Top Left' },
          { value: 'top_right', label: 'Top Right' },
          { value: 'bottom_left', label: 'Bottom Left' },
          { value: 'bottom_right', label: 'Bottom Right' },
          { value: 'center', label: 'Center' }
        ].map((position) => (
          <button
            key={position.value}
            onClick={() => setSelectedPosition(position.value)}
            className={`p-3 rounded-lg border-2 transition-all duration-200 ${
              selectedPosition === position.value
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            {position.label}
          </button>
        ))}
      </div>
      
      <div className="flex space-x-3">
        <button
          onClick={handleAddLogo}
          disabled={isLoading}
          className="flex-1 flex items-center justify-center space-x-2 p-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50"
        >
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
          <span>Add Logo</span>
        </button>
        
        <button
          onClick={() => setCurrentStep('options')}
          className="px-4 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
        >
          Back
        </button>
      </div>
    </div>
  );

  const renderManualInput = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-800">Enter Your Instructions</h3>
      
      <textarea
        value={manualInstructions}
        onChange={(e) => setManualInstructions(e.target.value)}
        placeholder="Describe what you want to do with the image (e.g., 'Make it more colorful', 'Add a sunset background', 'Crop to square format')"
        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
        rows={4}
      />
      
      <div className="flex space-x-3">
        <button
          onClick={handleManualEdit}
          disabled={isLoading || !manualInstructions.trim()}
          className="flex-1 flex items-center justify-center space-x-2 p-3 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors disabled:opacity-50"
        >
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
          <span>Apply Instructions</span>
        </button>
        
        <button
          onClick={() => setCurrentStep('options')}
          className="px-4 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
        >
          Back
        </button>
      </div>
    </div>
  );

  const renderGenerating = () => (
    <div className="flex flex-col items-center justify-center space-y-4 py-8">
      <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      <p className="text-gray-600">Generating your edited image...</p>
    </div>
  );

  const renderPreview = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-800">Preview Your Edited Image</h3>
      
      <div className="relative">
        <img
          src={editedImageUrl}
          alt="Edited preview"
          className="w-full rounded-lg shadow-lg"
        />
        <div className="absolute top-2 right-2 bg-green-500 text-white px-2 py-1 rounded-full text-xs font-medium">
          Edited
        </div>
      </div>
      
      <div className="flex space-x-3">
        <button
          onClick={handleSaveImage}
          disabled={isLoading}
          className="flex-1 flex items-center justify-center space-x-2 p-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50"
        >
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
          <span>Save Image</span>
        </button>
        
        <button
          onClick={() => setCurrentStep('options')}
          className="px-4 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
        >
          Make More Changes
        </button>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-[70vw] h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-800">Edit Image</h2>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Sidebar - Original Image */}
          <div className="w-1/3 p-6 border-r border-gray-200 bg-gray-50">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Your Image</h3>
            <div className="relative">
              <img
                src={inputImageUrl}
                alt="Original"
                className="w-full rounded-lg shadow-md"
              />
            </div>
          </div>

          {/* Right Side - Editor */}
          <div className="flex-1 p-6 overflow-y-auto">
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
                {error}
              </div>
            )}

            {currentStep === 'options' && renderOptions()}
            {currentStep === 'logo_placement' && renderLogoPlacement()}
            {currentStep === 'manual_input' && renderManualInput()}
            {currentStep === 'generating' && renderGenerating()}
            {currentStep === 'preview' && renderPreview()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SimpleImageEditor;
