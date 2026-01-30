import React from 'react'
import { AlertTriangle, X, Loader2, Trash2 } from 'lucide-react'

const DeleteConfirmationModal = ({
  isOpen,
  onClose,
  onConfirm,
  title = 'Delete Content',
  description = 'This action cannot be undone',
  itemName = 'this content',
  itemCount = 1,
  isLoading = false
}) => {
  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2 sm:p-3 md:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose()
        }
      }}
    >
      <div
        className="bg-white rounded-lg sm:rounded-xl md:rounded-2xl lg:rounded-3xl shadow-2xl max-w-md w-full overflow-hidden max-h-[calc(100vh-1rem)] sm:max-h-[calc(100vh-1.5rem)] md:max-h-[calc(100vh-2rem)] flex flex-col"
      >
        {/* Header with Emily branding */}
        <div className="bg-gradient-to-r from-purple-600 to-pink-600 px-3 sm:px-4 md:px-5 lg:px-6 py-3 sm:py-4 md:py-5 lg:py-6 text-white relative flex-shrink-0">
          <div className="flex items-center justify-between gap-2 sm:gap-3 md:gap-4">
            <div className="flex items-center space-x-2 sm:space-x-3 min-w-0 flex-1">
              <div className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 bg-white/20 backdrop-blur-sm rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0">
                <img
                  src="/emily_icon.png"
                  alt="Emily"
                  className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 rounded-full object-cover"
                />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-sm sm:text-base md:text-lg lg:text-xl font-bold truncate">{title}</h2>
                <p className="text-[10px] sm:text-xs md:text-sm text-white/80">{description}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              disabled={isLoading}
              className="w-7 h-7 sm:w-8 sm:h-8 md:w-9 md:h-9 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center transition-colors hover:bg-white/30 disabled:opacity-50 flex-shrink-0"
            >
              <X className="w-3.5 h-3.5 sm:w-4 sm:h-4 md:w-5 md:h-5 text-white" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-3 sm:p-4 md:p-5 lg:p-6 flex-1 min-h-0 flex flex-col">
          {/* Warning section */}
          <div className="flex items-start space-x-2 sm:space-x-3 mb-2 sm:mb-3 md:mb-4">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-red-600" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm sm:text-base md:text-lg font-semibold text-gray-900 mb-1">
                Are you sure you want to delete {itemCount > 1 ? `${itemCount} items` : itemName}?
              </h3>
              <p className="text-xs sm:text-sm text-gray-600 leading-snug">
                This action cannot be undone and will permanently remove {itemCount > 1 ? 'these items' : 'this content'}.
              </p>
            </div>
          </div>

          {/* Content preview (if single item) */}
          {itemCount === 1 && itemName !== 'this content' && (
            <div className="bg-gray-50 rounded-lg sm:rounded-xl p-2 sm:p-3 mb-2 sm:mb-3 md:mb-4">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 sm:w-9 sm:h-9 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <img
                    src="/emily_icon.png"
                    alt="Content"
                    className="w-4 h-4 sm:w-5 sm:h-5 rounded-full object-cover"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-gray-900 text-xs sm:text-sm md:text-base truncate">{itemName}</p>
                  <p className="text-[10px] sm:text-xs text-gray-500">Content Item</p>
                </div>
              </div>
            </div>
          )}

          {/* Consequences */}
          <div className="bg-red-50 border border-red-200 rounded-lg sm:rounded-xl p-2 sm:p-3 mb-2 sm:mb-3 md:mb-4">
            <h4 className="font-semibold text-red-800 mb-1.5 sm:mb-2 flex items-center text-xs sm:text-sm">
              <AlertTriangle className="w-3 h-3 sm:w-3.5 sm:h-3.5 mr-1 sm:mr-1.5 flex-shrink-0" />
              <span>What happens when you delete:</span>
            </h4>
            <ul className="space-y-1 sm:space-y-1.5 text-[10px] sm:text-xs md:text-sm text-red-700">
              <li className="flex items-start">
                <div className="w-1 h-1 sm:w-1.5 sm:h-1.5 bg-red-500 rounded-full mt-1 sm:mt-1.5 mr-1.5 sm:mr-2 flex-shrink-0"></div>
                <span className="leading-snug">{itemCount > 1 ? 'All selected content' : 'The content'} will be permanently removed</span>
              </li>
              <li className="flex items-start">
                <div className="w-1 h-1 sm:w-1.5 sm:h-1.5 bg-red-500 rounded-full mt-1 sm:mt-1.5 mr-1.5 sm:mr-2 flex-shrink-0"></div>
                <span className="leading-snug">This action cannot be reversed</span>
              </li>
              <li className="flex items-start">
                <div className="w-1 h-1 sm:w-1.5 sm:h-1.5 bg-red-500 rounded-full mt-1 sm:mt-1.5 mr-1.5 sm:mr-2 flex-shrink-0"></div>
                <span className="leading-snug">Any scheduled posts will be cancelled</span>
              </li>
            </ul>
          </div>

          {/* Action buttons */}
          <div className="flex flex-row space-x-2 flex-shrink-0 pt-2 border-t border-gray-100">
            <button
              onClick={onClose}
              disabled={isLoading}
              className="flex-1 px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 md:py-2.5 text-gray-700 bg-gray-100 rounded-lg sm:rounded-xl hover:bg-gray-200 transition-colors disabled:opacity-50 font-medium text-xs sm:text-sm md:text-base whitespace-nowrap"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={isLoading}
              className="flex-1 px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 md:py-2.5 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-lg sm:rounded-xl hover:from-red-600 hover:to-red-700 transition-all duration-200 disabled:opacity-50 font-medium flex items-center justify-center space-x-1 sm:space-x-1.5 md:space-x-2 text-xs sm:text-sm md:text-base whitespace-nowrap"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin flex-shrink-0" />
                  <span className="truncate">Deleting...</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                  <span>Delete</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default DeleteConfirmationModal
