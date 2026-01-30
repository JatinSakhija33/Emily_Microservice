"""
Custom Prompt Manager for Template Editor Agent
Manages template-specific prompts and workflow optimization
"""

import os
import json
import logging
from typing import Dict, Optional, Any
from datetime import datetime

logger = logging.getLogger(__name__)

class PromptManager:
    """Manages custom prompts for template editor agent"""
    
    def __init__(self, config_path: str = None):
        """Initialize the prompt manager"""
        if config_path is None:
            # Default path relative to this file
            current_dir = os.path.dirname(os.path.abspath(__file__))
            config_path = os.path.join(current_dir, '..', 'config', 'custom_prompts.json')
        
        self.config_path = config_path
        self.prompts_config = self._load_config()
    
    def _load_config(self) -> Dict[str, Any]:
        """Load prompts configuration from JSON file"""
        try:
            if not os.path.exists(self.config_path):
                logger.warning(f"Custom prompts config not found at {self.config_path}")
                return {"templates": {}, "settings": {}}
            
            with open(self.config_path, 'r', encoding='utf-8') as f:
                config = json.load(f)
            
            logger.info(f"Loaded custom prompts config with {len(config.get('templates', {}))} templates")
            return config
            
        except Exception as e:
            logger.error(f"Error loading custom prompts config: {e}")
            return {"templates": {}, "settings": {}}
    
    def get_template_prompt(self, template_name: str) -> Optional[Dict[str, Any]]:
        """Get custom prompt for a specific template"""
        try:
            templates = self.prompts_config.get("templates", {})
            template_data = templates.get(template_name.lower())
            
            if template_data:
                logger.info(f"Found custom prompt for template: {template_name}")
                return template_data
            else:
                logger.info(f"No custom prompt found for template: {template_name}")
                return None
                
        except Exception as e:
            logger.error(f"Error getting template prompt for {template_name}: {e}")
            return None
    
    def should_skip_template_analyzer(self, template_name: str) -> bool:
        """Check if template analyzer should be skipped for this template"""
        try:
            template_data = self.get_template_prompt(template_name)
            if template_data:
                return template_data.get("skip_template_analyzer", False)
            
            # Check default setting
            settings = self.prompts_config.get("settings", {})
            return settings.get("default_skip_analyzer", False)
            
        except Exception as e:
            logger.error(f"Error checking skip analyzer for {template_name}: {e}")
            return False
    
    def get_prompt_text(self, template_name: str, post_content: str) -> Optional[str]:
        """Get formatted prompt text for a template with content substitution"""
        try:
            template_data = self.get_template_prompt(template_name)
            if not template_data:
                return None
            
            prompt_template = template_data.get("prompt", "")
            if not prompt_template:
                return None
            
            # Replace placeholder with actual content
            formatted_prompt = prompt_template.replace("{post_content}", post_content)
            
            logger.info(f"Generated custom prompt for template: {template_name}")
            return formatted_prompt
            
        except Exception as e:
            logger.error(f"Error formatting prompt for {template_name}: {e}")
            return None
    
    def get_available_templates(self) -> Dict[str, Dict[str, Any]]:
        """Get all available templates with their metadata"""
        try:
            return self.prompts_config.get("templates", {})
        except Exception as e:
            logger.error(f"Error getting available templates: {e}")
            return {}
    
    def add_template_prompt(self, template_name: str, prompt_data: Dict[str, Any]) -> bool:
        """Add or update a template prompt (for team management)"""
        try:
            if "templates" not in self.prompts_config:
                self.prompts_config["templates"] = {}
            
            # Add metadata
            prompt_data["updated_at"] = datetime.now().isoformat()
            if template_name not in self.prompts_config["templates"]:
                prompt_data["created_at"] = datetime.now().isoformat()
                prompt_data["created_by"] = "team"
            
            self.prompts_config["templates"][template_name.lower()] = prompt_data
            
            # Save to file
            return self._save_config()
            
        except Exception as e:
            logger.error(f"Error adding template prompt for {template_name}: {e}")
            return False
    
    def remove_template_prompt(self, template_name: str) -> bool:
        """Remove a template prompt"""
        try:
            if "templates" in self.prompts_config:
                if template_name.lower() in self.prompts_config["templates"]:
                    del self.prompts_config["templates"][template_name.lower()]
                    return self._save_config()
            
            return False
            
        except Exception as e:
            logger.error(f"Error removing template prompt for {template_name}: {e}")
            return False
    
    def _save_config(self) -> bool:
        """Save configuration to file"""
        try:
            # Ensure directory exists
            os.makedirs(os.path.dirname(self.config_path), exist_ok=True)
            
            with open(self.config_path, 'w', encoding='utf-8') as f:
                json.dump(self.prompts_config, f, indent=2, ensure_ascii=False)
            
            logger.info(f"Saved custom prompts config to {self.config_path}")
            return True
            
        except Exception as e:
            logger.error(f"Error saving custom prompts config: {e}")
            return False
    
    def reload_config(self) -> bool:
        """Reload configuration from file"""
        try:
            self.prompts_config = self._load_config()
            logger.info("Reloaded custom prompts configuration")
            return True
        except Exception as e:
            logger.error(f"Error reloading config: {e}")
            return False

# Global instance
prompt_manager = PromptManager()
