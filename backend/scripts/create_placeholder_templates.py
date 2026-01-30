#!/usr/bin/env python3
"""
Create placeholder template images for the template editor
"""

import os
from PIL import Image, ImageDraw, ImageFont
import json

def create_placeholder_template(width, height, text, filename, bg_color="#f0f0f0", text_color="#333333"):
    """Create a placeholder template image"""
    # Create image
    img = Image.new('RGB', (width, height), bg_color)
    draw = ImageDraw.Draw(img)
    
    # Try to use a default font, fallback to basic if not available
    try:
        font = ImageFont.truetype("arial.ttf", 24)
    except:
        font = ImageFont.load_default()
    
    # Calculate text position (center)
    bbox = draw.textbbox((0, 0), text, font=font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]
    
    x = (width - text_width) // 2
    y = (height - text_height) // 2
    
    # Draw text
    draw.text((x, y), text, fill=text_color, font=font)
    
    # Draw border
    draw.rectangle([0, 0, width-1, height-1], outline="#cccccc", width=2)
    
    # Save image
    img.save(filename, "JPEG", quality=95)
    print(f"Created: {filename}")

def main():
    """Create all placeholder templates"""
    base_dir = "templates"
    
    # Template configurations
    templates = [
        {
            "id": "social-media-1",
            "filename": "instagram-post-1.jpg",
            "category": "social-media",
            "size": (600, 600),
            "text": "Instagram Post Template",
            "bg_color": "#E91E63"
        },
        {
            "id": "social-media-2", 
            "filename": "facebook-cover-1.jpg",
            "category": "social-media",
            "size": (1200, 630),
            "text": "Facebook Cover Template",
            "bg_color": "#1877F2"
        },
        {
            "id": "marketing-1",
            "filename": "promo-banner-1.jpg", 
            "category": "marketing",
            "size": (800, 400),
            "text": "Promotional Banner",
            "bg_color": "#FF5722"
        },
        {
            "id": "events-1",
            "filename": "event-invitation-1.jpg",
            "category": "events", 
            "size": (600, 800),
            "text": "Event Invitation",
            "bg_color": "#2C3E50"
        },
        {
            "id": "business-1",
            "filename": "business-presentation-1.jpg",
            "category": "business",
            "size": (800, 600),
            "text": "Business Presentation",
            "bg_color": "#34495E"
        },
        {
            "id": "creative-1",
            "filename": "artistic-quote-1.jpg",
            "category": "creative",
            "size": (600, 400),
            "text": "Artistic Quote",
            "bg_color": "#8E24AA"
        }
    ]
    
    # Create directories
    for category in ["social-media", "marketing", "events", "business", "creative", "newsletter"]:
        os.makedirs(os.path.join(base_dir, category), exist_ok=True)
    
    # Create template images
    for template in templates:
        category_dir = os.path.join(base_dir, template["category"])
        filename = os.path.join(category_dir, template["filename"])
        
        create_placeholder_template(
            width=template["size"][0],
            height=template["size"][1],
            text=template["text"],
            filename=filename,
            bg_color=template["bg_color"],
            text_color="#FFFFFF"
        )
        
        # Also create preview images (smaller)
        preview_filename = filename.replace(".jpg", "-preview.jpg")
        create_placeholder_template(
            width=200,
            height=200,
            text=template["text"],
            filename=preview_filename,
            bg_color=template["bg_color"],
            text_color="#FFFFFF"
        )
    
    print("\n✅ All placeholder templates created successfully!")
    print("📁 Template files are located in the templates/ directory")

if __name__ == "__main__":
    main()
