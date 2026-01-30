#!/usr/bin/env python3
"""
Create placeholder template images for the template system
"""

import os
from PIL import Image, ImageDraw, ImageFont
import textwrap

def create_template_image(template_info, output_path):
    """Create a placeholder template image"""
    # Create a 800x600 image with a gradient background
    width, height = 800, 600
    image = Image.new('RGB', (width, height), color='#f0f0f0')
    draw = ImageDraw.Draw(image)
    
    # Create gradient background
    for y in range(height):
        color_value = int(240 - (y / height) * 40)  # Gradient from light to slightly darker
        color = (color_value, color_value, color_value)
        draw.line([(0, y), (width, y)], fill=color)
    
    # Add template title
    try:
        # Try to use a larger font
        title_font = ImageFont.truetype("/System/Library/Fonts/Arial.ttf", 36)
        subtitle_font = ImageFont.truetype("/System/Library/Fonts/Arial.ttf", 18)
    except:
        # Fallback to default font
        title_font = ImageFont.load_default()
        subtitle_font = ImageFont.load_default()
    
    # Draw template name
    title_text = template_info['name']
    title_bbox = draw.textbbox((0, 0), title_text, font=title_font)
    title_width = title_bbox[2] - title_bbox[0]
    title_x = (width - title_width) // 2
    title_y = 50
    
    draw.text((title_x, title_y), title_text, fill='#333333', font=title_font)
    
    # Draw category
    category_text = f"Category: {template_info['category'].replace('-', ' ').title()}"
    category_bbox = draw.textbbox((0, 0), category_text, font=subtitle_font)
    category_width = category_bbox[2] - category_bbox[0]
    category_x = (width - category_width) // 2
    category_y = title_y + 50
    
    draw.text((category_x, category_y), category_text, fill='#666666', font=subtitle_font)
    
    # Draw description
    description = template_info['description']
    wrapped_desc = textwrap.fill(description, width=60)
    desc_lines = wrapped_desc.split('\n')
    
    desc_y = category_y + 40
    for line in desc_lines:
        line_bbox = draw.textbbox((0, 0), line, font=subtitle_font)
        line_width = line_bbox[2] - line_bbox[0]
        line_x = (width - line_width) // 2
        draw.text((line_x, desc_y), line, fill='#555555', font=subtitle_font)
        desc_y += 25
    
    # Draw content areas info
    content_areas_text = f"Content Areas: {len(template_info.get('content_areas', []))}"
    areas_bbox = draw.textbbox((0, 0), content_areas_text, font=subtitle_font)
    areas_width = areas_bbox[2] - areas_bbox[0]
    areas_x = (width - areas_width) // 2
    areas_y = desc_y + 20
    
    draw.text((areas_x, areas_y), content_areas_text, fill='#777777', font=subtitle_font)
    
    # Draw a border
    draw.rectangle([10, 10, width-10, height-10], outline='#cccccc', width=2)
    
    # Add a "Template Preview" label
    label_text = "TEMPLATE PREVIEW"
    label_bbox = draw.textbbox((0, 0), label_text, font=subtitle_font)
    label_width = label_bbox[2] - label_bbox[0]
    label_x = (width - label_width) // 2
    label_y = height - 40
    
    draw.text((label_x, label_y), label_text, fill='#999999', font=subtitle_font)
    
    # Save the image with appropriate format
    if output_path.lower().endswith('.png'):
        image.save(output_path, 'PNG')
    else:
        image.save(output_path, 'JPEG', quality=85)
    print(f"Created template image: {output_path}")

def main():
    """Create all template images"""
    # Load templates.json
    templates_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'templates', 'templates.json')
    
    if not os.path.exists(templates_path):
        print(f"Templates config not found at: {templates_path}")
        return
    
    with open(templates_path, 'r') as f:
        data = json.load(f)
    
    templates = data.get('templates', [])
    
    for template in templates:
        category = template['category']
        filename = template['filename']
        
        # Create category directory if it doesn't exist
        category_dir = os.path.join(os.path.dirname(templates_path), category)
        os.makedirs(category_dir, exist_ok=True)
        
        # Create the template image
        output_path = os.path.join(category_dir, filename)
        create_template_image(template, output_path)
    
    print(f"Created {len(templates)} template images successfully!")

if __name__ == "__main__":
    import json
    main()
