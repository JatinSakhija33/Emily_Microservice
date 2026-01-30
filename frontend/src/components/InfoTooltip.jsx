import React, { useState } from 'react'
import { Info } from 'lucide-react'

const InfoTooltip = ({ content, className = "" }) => {
  const [isVisible, setIsVisible] = useState(false)

  return (
    <div className={`relative inline-block ${className}`}>
      <button
        type="button"
        className="inline-flex items-center justify-center w-3.5 h-3.5 sm:w-4 sm:h-4 md:w-5 md:h-5 text-gray-600 hover:text-[#FF4D94] transition-colors duration-200 flex-shrink-0"
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        onFocus={() => setIsVisible(true)}
        onBlur={() => setIsVisible(false)}
      >
        <Info className="w-3.5 h-3.5 sm:w-4 sm:h-4 md:w-5 md:h-5" />
      </button>
      
      {isVisible && (
        <div className="absolute z-[100] w-[220px] sm:w-[280px] md:w-[360px] lg:w-[440px] p-2 sm:p-3 md:p-4 mb-2 text-[10px] sm:text-xs md:text-sm lg:text-base bg-white border border-[#FF6B9D] rounded-lg shadow-2xl bottom-full left-1/2 -translate-x-1/2 sm:left-0 sm:-translate-x-0 pointer-events-none">
          <div className="text-[10px] sm:text-xs md:text-sm lg:text-base leading-[1.5] text-[#9E005C] break-words whitespace-normal">
            {content}
          </div>
          {/* Arrow pointing down */}
          <div className="absolute top-full left-1/2 -translate-x-1/2 sm:left-4 sm:-translate-x-0 w-2 h-2 bg-white border-r border-b border-[#FF6B9D] rotate-45"></div>
        </div>
      )}
    </div>
  )
}

export default InfoTooltip
