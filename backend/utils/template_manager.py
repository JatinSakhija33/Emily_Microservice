"""
Template Manager Utility
Handles static template loading and management
"""

import os
import json
from typing import Dict, List, Optional, Any
from pathlib import Path

class TemplateManager:
    """Manages static templates from local folder"""
    
    def __init__(self, templates_dir: str = "templates"):
        self.templates_dir = Path(templates_dir)
        self.templates_config = self._load_templates_config()
    
    def _load_templates_config(self) -> Dict[str, Any]:
        """Load templates configuration from JSON file"""
        config_path = self.templates_dir / "templates.json"
        try:
            with open(config_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except FileNotFoundError:
            print(f"Warning: Templates config not found at {config_path}")
            return {"templates": [], "categories": []}
        except json.JSONDecodeError as e:
            print(f"Error loading templates config: {e}")
            return {"templates": [], "categories": []}
    
    def get_all_templates(self) -> List[Dict[str, Any]]:
        """Get all available templates"""
        return self.templates_config.get("templates", [])
    
    def get_templates_by_category(self, category: str) -> List[Dict[str, Any]]:
        """Get templates filtered by category"""
        templates = self.get_all_templates()
        if category == "all":
            return templates
        return [t for t in templates if t.get("category") == category]
    
    def get_template_by_id(self, template_id: str) -> Optional[Dict[str, Any]]:
        """Get specific template by ID"""
        templates = self.get_all_templates()
        for template in templates:
            if template.get("id") == template_id:
                return template
        return None
    
    def get_categories(self) -> List[Dict[str, Any]]:
        """Get all template categories"""
        return self.templates_config.get("categories", [])
    
    def get_template_image_path(self, template_id: str) -> Optional[str]:
        """Get the file path for a template (HTML or image)"""
        template = self.get_template_by_id(template_id)
        if not template:
            return None
        
        filename = template.get("filename")
        category = template.get("category")
        
        if not filename or not category:
            return None
        
        template_path = self.templates_dir / category / filename
        return str(template_path) if template_path.exists() else None
    
    def get_template_html_path(self, template_id: str) -> Optional[str]:
        """Get the file path for an HTML template"""
        return self.get_template_image_path(template_id)  # Same method, different name for clarity
    
    def get_template_html_content(self, template_id: str) -> Optional[str]:
        """Get HTML template content as string"""
        html_path = self.get_template_html_path(template_id)
        if not html_path:
            return None
        
        try:
            with open(html_path, 'r', encoding='utf-8') as f:
                return f.read()
        except Exception as e:
            print(f"Error loading HTML template {template_id}: {e}")
            return None
    
    def get_template_image_base64(self, template_id: str) -> Optional[str]:
        """Get template (HTML or image) as base64 string"""
        import base64
        
        template_path = self.get_template_image_path(template_id)
        if not template_path:
            return None
        
        try:
            # Check if it's an HTML file
            if template_path.lower().endswith('.html'):
                with open(template_path, 'r', encoding='utf-8') as f:
                    html_content = f.read()
                base64_data = base64.b64encode(html_content.encode('utf-8')).decode('utf-8')
                return f"data:text/html;base64,{base64_data}"
            else:
                # Handle image files
                with open(template_path, 'rb') as f:
                    image_data = f.read()
                    base64_data = base64.b64encode(image_data).decode('utf-8')
                    return f"data:image/jpeg;base64,{base64_data}"
        except Exception as e:
            print(f"Error loading template {template_id}: {e}")
            return None
    
    def get_template_preview_url(self, template_id: str) -> Optional[str]:
        """Get preview URL for template"""
        template = self.get_template_by_id(template_id)
        if not template:
            return None
        
        return template.get("preview_url")
    
    def search_templates(self, query: str) -> List[Dict[str, Any]]:
        """Search templates by name or description"""
        templates = self.get_all_templates()
        query_lower = query.lower()
        
        results = []
        for template in templates:
            name = template.get("name", "").lower()
            description = template.get("description", "").lower()
            category = template.get("category", "").lower()
            
            if (query_lower in name or 
                query_lower in description or 
                query_lower in category):
                results.append(template)
        
        return results
    
    def get_template_analysis(self, template_id: str) -> Optional[Dict[str, Any]]:
        """Get template analysis data (content areas, image areas, design info)"""
        template = self.get_template_by_id(template_id)
        if not template:
            return None
        
        return {
            "content_areas": template.get("content_areas", []),
            "image_areas": template.get("image_areas", []),
            "design_info": template.get("design_info", {})
        }
    
    def validate_template(self, template_id: str) -> bool:
        """Validate that template exists and has required files"""
        template = self.get_template_by_id(template_id)
        if not template:
            return False
        
        # Check if template file exists (HTML or image)
        template_path = self.get_template_image_path(template_id)
        if not template_path or not os.path.exists(template_path):
            return False
        
        # Check required fields
        required_fields = ["id", "name", "category", "filename"]
        for field in required_fields:
            if not template.get(field):
                return False
        
        return True
    
    def get_template_stats(self) -> Dict[str, Any]:
        """Get statistics about available templates"""
        templates = self.get_all_templates()
        categories = self.get_categories()
        
        # Count templates by category
        category_counts = {}
        for template in templates:
            category = template.get("category", "unknown")
            category_counts[category] = category_counts.get(category, 0) + 1
        
        return {
            "total_templates": len(templates),
            "total_categories": len(categories),
            "templates_by_category": category_counts,
            "categories": [cat["name"] for cat in categories]
        }

# Global template manager instance
template_manager = TemplateManager()
