
import asyncio
import os
import json
import uvicorn
from dotenv import load_dotenv

# Load env vars immediately
load_dotenv()

from fastapi import UploadFile
from routers.document_parser import parse_onboarding_document

# Mock UploadFile
class MockUploadFile:
    def __init__(self, filename, content):
        self.filename = filename
        self.content = content
        self.file = None # add file attribute if needed by implementation
    
    async def read(self):
        return self.content

async def test():
    print("Starting direct parser verification...")
    
    # Create a dummy text file content
    content = b"""
    TechNova Solutions
    We are a cutting-edge software development company specializing in AI-driven solutions for small businesses.
    Our goal is to democratize access to artificial intelligence.
    Industry: Technology, Software, AI
    Website: www.technova.example.com
    Phone: +1 555-0199
    Address: 123 Innovation Dr, San Francisco, CA, USA
    Target Audience: Small and medium enterprises, startups
    Goals: Lead Generation, Brand Awareness
    Social Media: LinkedIn, Twitter
    Brand Voice: Professional, Innovative, Educational
    """
    
    # Create the mock upload file
    mock_file = MockUploadFile("test_doc.txt", content)
    
    # Check if API Key is present
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        print("XXXXXX WARNING: GEMINI_API_KEY not set. Test will likely fail. XXXXXX")
    else:
        print(f"API Key found: {api_key[:5]}...")
    
    try:
        print("Calling parse_onboarding_document...")
        # The function expects an UploadFile. 
        # In FastAPI UploadFile has filename and file attributes and async read method.
        # fastAPI UploadFile is hard to mock perfectly but usually read() and filename is enough for simple usage.
        
        result = await parse_onboarding_document(mock_file)
        
        if hasattr(result, 'model_dump'):
            data = result.model_dump()
        else:
            data = result.dict()
            
        print("\nExtraction Result:")
        print(json.dumps(data, indent=2))
        
        # Verify critical fields
        # data is already a dict now
        
        # Loose check because LLM output might vary slightly
        if "TechNova" in data.get("business_name", ""):
             print("\nSUCCESS: Business Name extracted correctly.")
        else:
             print(f"\nFAILURE: Expected 'TechNova Solutions', got '{data.get('business_name')}'")

        if data.get("phone_number") == "+1 555-0199":
             print("SUCCESS: Phone extracted correctly.")
        
    except Exception as e:
        print(f"Error during test: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test())
