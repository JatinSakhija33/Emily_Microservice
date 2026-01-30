import React, { useState, useRef, useEffect } from 'react'

const DualRangeSlider = ({ 
  min = 16, 
  max = 90, 
  minValue, 
  maxValue, 
  onChange,
  className = '',
  isDarkMode = false
}) => {
  const [localMin, setLocalMin] = useState(minValue !== undefined ? minValue : null)
  const [localMax, setLocalMax] = useState(maxValue !== undefined ? maxValue : null)
  const [minInputValue, setMinInputValue] = useState(minValue !== undefined ? String(minValue) : '')
  const [maxInputValue, setMaxInputValue] = useState(maxValue !== undefined ? String(maxValue) : '')
  const sliderRef = useRef(null)
  const minThumbRef = useRef(null)
  const maxThumbRef = useRef(null)
  const [isDragging, setIsDragging] = useState(null) // 'min' or 'max' or null

  useEffect(() => {
    if (minValue !== undefined && minValue !== null) {
      setLocalMin(minValue)
      setMinInputValue(String(minValue))
    } else if (minValue === null || minValue === undefined) {
      setLocalMin(null)
      setMinInputValue('')
    }
  }, [minValue])

  useEffect(() => {
    if (maxValue !== undefined && maxValue !== null) {
      setLocalMax(maxValue)
      setMaxInputValue(String(maxValue))
    } else if (maxValue === null || maxValue === undefined) {
      setLocalMax(null)
      setMaxInputValue('')
    }
  }, [maxValue])

  const getPercentage = (value) => {
    return ((value - min) / (max - min)) * 100
  }

  const getValueFromPercentage = (percentage) => {
    return Math.round(min + (percentage / 100) * (max - min))
  }

  const handleMouseDown = (type) => {
    setIsDragging(type)
  }

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDragging || !sliderRef.current) return

      const rect = sliderRef.current.getBoundingClientRect()
      const percentage = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100))
      const value = getValueFromPercentage(percentage)

      if (isDragging === 'min') {
        const maxAllowed = localMax !== null ? localMax - 1 : max - 1
        const newMin = Math.min(value, maxAllowed)
        setLocalMin(newMin)
        setMinInputValue(String(newMin))
        onChange?.({ min: newMin, max: localMax !== null ? localMax : max })
      } else if (isDragging === 'max') {
        const minAllowed = localMin !== null ? localMin + 1 : min + 1
        // When dragging, cap at max (90) for slider, but allow 90+ via input
        const newMax = Math.min(max, Math.max(value, minAllowed))
        setLocalMax(newMax)
        setMaxInputValue(String(newMax))
        onChange?.({ min: localMin !== null ? localMin : min, max: newMax })
      }
    }

    const handleMouseUp = () => {
      setIsDragging(null)
    }

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, localMin, localMax, min, max, onChange])

  const handleInputChange = (type, value) => {
    // Allow user to type freely - just update the input value
    if (type === 'min') {
      setMinInputValue(value)
    } else {
      setMaxInputValue(value)
    }
  }

  const handleInputBlur = (type) => {
    // On blur, validate and apply constraints
    if (type === 'min') {
      const numValue = parseInt(minInputValue, 10)
      
      if (minInputValue === '' || isNaN(numValue)) {
        // If empty or invalid, reset to current localMin or empty
        if (localMin !== null) {
          setMinInputValue(String(localMin))
        } else {
          setMinInputValue('')
        }
        return
      }

      // Apply constraints: must be between min and (localMax - 1) or (max - 1) if localMax is null
      const maxAllowed = localMax !== null ? localMax - 1 : max - 1
      const newMin = Math.max(min, Math.min(numValue, maxAllowed))
      
      setLocalMin(newMin)
      setMinInputValue(String(newMin))
      
      // Update max if needed to maintain min < max
      const finalMax = localMax !== null ? localMax : max
      if (newMin >= finalMax) {
        const adjustedMax = Math.min(max, newMin + 1)
        setLocalMax(adjustedMax)
        setMaxInputValue(String(adjustedMax))
        onChange?.({ min: newMin, max: adjustedMax })
      } else {
        onChange?.({ min: newMin, max: finalMax })
      }
    } else {
      const numValue = parseInt(maxInputValue, 10)
      
      if (maxInputValue === '' || isNaN(numValue)) {
        // If empty or invalid, reset to current localMax or empty
        if (localMax !== null) {
          setMaxInputValue(String(localMax))
        } else {
          setMaxInputValue('')
        }
        return
      }

      // Allow values >= 90 (90+)
      const minAllowed = localMin !== null ? localMin + 1 : min + 1
      // Don't cap at max - allow 90+ values
      const newMax = Math.max(numValue, minAllowed)
      
      setLocalMax(newMax)
      // Show the actual value in input, but display will show "90+" if >= 90
      setMaxInputValue(String(newMax))
      
      // Update min if needed to maintain min < max
      const finalMin = localMin !== null ? localMin : min
      if (newMax <= finalMin) {
        const adjustedMin = Math.max(min, newMax - 1)
        setLocalMin(adjustedMin)
        setMinInputValue(String(adjustedMin))
        onChange?.({ min: adjustedMin, max: newMax })
      } else {
        onChange?.({ min: finalMin, max: newMax })
      }
    }
  }

  // For slider display, cap max at 90 for visual purposes, but allow higher values
  const displayMax = localMax !== null ? Math.min(localMax, max) : max
  const minPercentage = localMin !== null ? getPercentage(localMin) : 0
  const maxPercentage = localMax !== null ? getPercentage(displayMax) : 100

  return (
    <div className={`w-full ${className}`}>
      <div className="flex items-start justify-between mb-4 gap-4">
        <div className="flex-1 flex flex-col">
          <label className="block text-xs sm:text-sm font-medium mb-1 text-gray-200">
            Minimum Age
          </label>
          <input
            type="number"
            min={min}
            max={localMax !== null ? localMax - 1 : max}
            value={minInputValue}
            onChange={(e) => handleInputChange('min', e.target.value)}
            onBlur={() => handleInputBlur('min')}
            placeholder={`Min: ${min}`}
            className={`w-full px-3 py-2 text-sm border rounded-md focus:ring-2 focus:ring-pink-500 focus:border-transparent h-[38px] ${
              isDarkMode
                ? 'bg-gray-700 border-gray-600 text-gray-100 placeholder-gray-400'
                : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
            }`}
          />
        </div>
        <div className="flex flex-col justify-center" style={{ marginTop: '22px', height: '38px' }}>
          <div className={`flex items-center justify-center text-xl font-medium ${
            isDarkMode ? 'text-gray-300' : 'text-gray-400'
          }`}>-</div>
        </div>
        <div className="flex-1 flex flex-col">
          <label className="block text-xs sm:text-sm font-medium mb-1 text-gray-200">
            Maximum Age
          </label>
          <input
            type="number"
            min={localMin !== null ? localMin + 1 : min + 1}
            value={maxInputValue}
            onChange={(e) => handleInputChange('max', e.target.value)}
            onBlur={() => handleInputBlur('max')}
            placeholder={`Max: ${max}+`}
            className={`w-full px-3 py-2 text-sm border rounded-md focus:ring-2 focus:ring-pink-500 focus:border-transparent h-[38px] ${
              isDarkMode
                ? 'bg-gray-700 border-gray-600 text-gray-100 placeholder-gray-400'
                : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
            }`}
          />
        </div>
      </div>

      <div className={`relative h-2 rounded-full ${
        isDarkMode ? 'bg-gray-600' : 'bg-gray-200'
      }`} ref={sliderRef}>
        <div
          className="absolute h-2 bg-pink-500 rounded-full"
          style={{
            left: `${minPercentage}%`,
            width: `${maxPercentage - minPercentage}%`
          }}
        />
        <div
          ref={minThumbRef}
          className="absolute w-5 h-5 bg-pink-600 rounded-full cursor-pointer shadow-md transform -translate-x-1/2 -translate-y-1.5 hover:bg-pink-700 transition-colors"
          style={{ left: `${minPercentage}%` }}
          onMouseDown={() => handleMouseDown('min')}
        />
        <div
          ref={maxThumbRef}
          className="absolute w-5 h-5 bg-pink-600 rounded-full cursor-pointer shadow-md transform -translate-x-1/2 -translate-y-1.5 hover:bg-pink-700 transition-colors"
          style={{ left: `${maxPercentage}%` }}
          onMouseDown={() => handleMouseDown('max')}
        />
      </div>
      <div className={`flex justify-between text-xs mt-1 ${
        isDarkMode ? 'text-gray-400' : 'text-gray-500'
      }`}>
        <span>{min}</span>
        <span className={`font-medium whitespace-nowrap ${
          isDarkMode ? 'text-gray-200' : 'text-gray-700'
        }`}>
          {localMin !== null && localMax !== null 
            ? `${localMin} - ${localMax >= max ? `${max}+` : localMax}` 
            : 'Select range'}
        </span>
        <span>{max}+</span>
      </div>
    </div>
  )
}

export default DualRangeSlider

