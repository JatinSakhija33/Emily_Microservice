"""
Color Extraction Service
Extracts dominant colors from images using PIL/Pillow and color quantization
"""
import logging
import requests
from io import BytesIO
from PIL import Image
import numpy as np
from typing import List, Tuple
from collections import Counter

logger = logging.getLogger(__name__)


class ColorExtractionService:
    """Service for extracting dominant colors from images"""
    
    def __init__(self):
        pass
    
    def extract_colors_from_url(self, image_url: str, num_colors: int = 4) -> List[str]:
        """
        Extract dominant colors from an image URL
        
        Args:
            image_url: URL of the image
            num_colors: Number of colors to extract (default: 4)
            
        Returns:
            List of hex color codes (e.g., ['#FF0000', '#00FF00', ...])
        """
        try:
            # Download image from URL
            response = requests.get(image_url, timeout=10)
            response.raise_for_status()
            
            # Open image from bytes
            image = Image.open(BytesIO(response.content))
            
            return self._extract_colors_from_image(image, num_colors)
            
        except Exception as e:
            logger.error(f"Error extracting colors from URL {image_url}: {str(e)}")
            raise
    
    def extract_colors_from_bytes(self, image_bytes: bytes, num_colors: int = 4) -> List[str]:
        """
        Extract dominant colors from image bytes
        
        Args:
            image_bytes: Image file bytes
            num_colors: Number of colors to extract (default: 4)
            
        Returns:
            List of hex color codes
        """
        try:
            image = Image.open(BytesIO(image_bytes))
            return self._extract_colors_from_image(image, num_colors)
        except Exception as e:
            logger.error(f"Error extracting colors from bytes: {str(e)}")
            raise
    
    def _extract_colors_from_image(self, image: Image.Image, num_colors: int = 4) -> List[str]:
        """
        Extract dominant colors from a PIL Image
        
        Args:
            image: PIL Image object
            num_colors: Number of colors to extract
            
        Returns:
            List of hex color codes
        """
        try:
            # Convert image to RGB if necessary
            if image.mode != 'RGB':
                image = image.convert('RGB')
            
            # Resize image for faster processing (max 200x200)
            image.thumbnail((200, 200), Image.Resampling.LANCZOS)
            
            # Convert to numpy array
            img_array = np.array(image)
            
            # Reshape to list of pixels
            pixels = img_array.reshape(-1, 3)
            
            # Remove transparent/white background pixels (optional - helps focus on actual colors)
            # Filter out very light pixels (likely background)
            pixels = pixels[
                ~((pixels[:, 0] > 240) & (pixels[:, 1] > 240) & (pixels[:, 2] > 240))
            ]
            
            if len(pixels) == 0:
                # If all pixels were filtered, use original pixels
                pixels = img_array.reshape(-1, 3)
            
            # Use k-means clustering to find dominant colors
            # For simplicity, we'll use a frequency-based approach
            # Round colors to reduce color space
            rounded_pixels = (pixels // 32) * 32  # Round to nearest 32 (reduces to ~8 colors per channel)
            
            # Count color frequencies
            color_counts = Counter(map(tuple, rounded_pixels))
            
            # Get most common colors
            most_common = color_counts.most_common(num_colors * 2)  # Get more to filter
            
            # Convert to hex and filter similar colors
            colors = []
            for color_tuple, count in most_common:
                hex_color = self._rgb_to_hex(color_tuple)
                
                # Skip if too similar to already selected colors
                if not self._is_similar_color(hex_color, colors):
                    colors.append(hex_color)
                    if len(colors) >= num_colors:
                        break
            
            # If we don't have enough colors, fill with most common remaining
            while len(colors) < num_colors and len(most_common) > len(colors):
                for color_tuple, count in most_common:
                    hex_color = self._rgb_to_hex(color_tuple)
                    if hex_color not in colors:
                        colors.append(hex_color)
                        break
                else:
                    break
            
            # Ensure we have exactly num_colors
            while len(colors) < num_colors:
                colors.append('#000000')  # Default black if needed
            
            return colors[:num_colors]
            
        except Exception as e:
            logger.error(f"Error in color extraction: {str(e)}")
            # Return default colors on error
            return ['#000000', '#FFFFFF', '#CCCCCC', '#666666'][:num_colors]
    
    def _rgb_to_hex(self, rgb: Tuple[int, int, int]) -> str:
        """Convert RGB tuple to hex color code"""
        return f"#{rgb[0]:02X}{rgb[1]:02X}{rgb[2]:02X}"
    
    def _is_similar_color(self, hex_color: str, existing_colors: List[str], threshold: int = 30) -> bool:
        """
        Check if a color is too similar to existing colors
        
        Args:
            hex_color: Hex color to check
            existing_colors: List of existing hex colors
            threshold: Color difference threshold
            
        Returns:
            True if color is similar to any existing color
        """
        if not existing_colors:
            return False
        
        def hex_to_rgb(hex_str):
            hex_str = hex_str.lstrip('#')
            return tuple(int(hex_str[i:i+2], 16) for i in (0, 2, 4))
        
        def color_distance(rgb1, rgb2):
            return sum((a - b) ** 2 for a, b in zip(rgb1, rgb2)) ** 0.5
        
        new_rgb = hex_to_rgb(hex_color)
        
        for existing_hex in existing_colors:
            existing_rgb = hex_to_rgb(existing_hex)
            distance = color_distance(new_rgb, existing_rgb)
            if distance < threshold:
                return True
        
        return False

