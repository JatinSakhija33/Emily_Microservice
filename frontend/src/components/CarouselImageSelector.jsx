import React, { useState } from 'react'
import { X, Check, Edit } from 'lucide-react'

const CarouselImageSelector = ({
  images,
  selectedImage,
  onImageSelect,
  onClose,
  isDarkMode = false
}) => {
  const [hoveredImage, setHoveredImage] = useState(null)

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose()
        }
      }}
    >
      <div
        className={`relative max-w-4xl w-full mx-4 rounded-2xl shadow-2xl overflow-hidden ${
          isDarkMode ? 'bg-gray-800' : 'bg-white'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`p-6 border-b ${
          isDarkMode
            ? 'border-gray-700 bg-gradient-to-r from-gray-700 to-gray-600'
            : 'border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50'
        }`}>
          <div className="flex items-center justify-between">
            <div>
              <h2 className={`text-xl font-semibold ${
                isDarkMode ? 'text-gray-100' : 'text-gray-900'
              }`}>
                Select Carousel Image
              </h2>
              <p className={`text-sm mt-1 ${
                isDarkMode ? 'text-gray-400' : 'text-gray-600'
              }`}>
                Choose an image to edit from your carousel
              </p>
            </div>
            <button
              onClick={onClose}
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                isDarkMode
                  ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-500'
              }`}
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {images.map((image, index) => (
              <div
                key={index}
                className={`relative rounded-lg overflow-hidden border-2 transition-all duration-200 cursor-pointer ${
                  selectedImage === image
                    ? 'border-blue-500 shadow-lg scale-105'
                    : hoveredImage === image
                    ? 'border-blue-300 shadow-md'
                    : isDarkMode
                    ? 'border-gray-600 hover:border-gray-500'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                onMouseEnter={() => setHoveredImage(image)}
                onMouseLeave={() => setHoveredImage(null)}
                onClick={() => onImageSelect(image)}
              >
                <div className="aspect-square">
                  <img
                    src={image}
                    alt={`Carousel image ${index + 1}`}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.target.src = '/default-image.png'
                    }}
                  />
                </div>

                {/* Selected indicator */}
                {selectedImage === image && (
                  <div className="absolute top-2 right-2 bg-blue-500 rounded-full p-1">
                    <Check className="w-4 h-4 text-white" />
                  </div>
                )}

                {/* Hover overlay */}
                {hoveredImage === image && selectedImage !== image && (
                  <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                    <div className="bg-white rounded-full p-2">
                      <Edit className="w-5 h-5 text-gray-800" />
                    </div>
                  </div>
                )}

                {/* Image number */}
                <div className={`absolute bottom-2 left-2 px-2 py-1 rounded text-xs font-medium ${
                  isDarkMode
                    ? 'bg-gray-900/80 text-gray-200'
                    : 'bg-black/60 text-white'
                }`}>
                  {index + 1}
                </div>
              </div>
            ))}
          </div>

          {/* Action buttons */}
          <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={onClose}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                isDarkMode
                  ? 'text-gray-400 bg-gray-700 hover:bg-gray-600'
                  : 'text-gray-600 bg-gray-100 hover:bg-gray-200'
              }`}
            >
              Cancel
            </button>
            <button
              onClick={() => {
                if (selectedImage) {
                  onImageSelect(selectedImage)
                  onClose()
                }
              }}
              disabled={!selectedImage}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                selectedImage
                  ? 'bg-blue-600 hover:bg-blue-700 text-white'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              Select Image
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CarouselImageSelector