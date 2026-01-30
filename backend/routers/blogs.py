from fastapi import APIRouter, HTTPException, Depends, Query, status, File, UploadFile, Form
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional, List
import os
import uuid
import re
import urllib.parse
from datetime import datetime
from supabase import create_client
from pydantic import BaseModel
import logging
from cryptography.fernet import Fernet
import requests
import openai
import json

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize Supabase clients
supabase_url = os.getenv("SUPABASE_URL")
supabase_anon_key = os.getenv("SUPABASE_ANON_KEY")
supabase_service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not supabase_url or not supabase_anon_key:
    raise ValueError("SUPABASE_URL and SUPABASE_ANON_KEY must be set")

supabase = create_client(supabase_url, supabase_anon_key)
supabase_admin = create_client(supabase_url, supabase_service_key)

# Encryption setup
ENCRYPTION_KEY = os.getenv('ENCRYPTION_KEY')
if not ENCRYPTION_KEY:
    print("⚠️  WARNING: ENCRYPTION_KEY not set! Generating a new key. This will cause existing tokens to be unreadable.")
    ENCRYPTION_KEY = Fernet.generate_key().decode()
    print(f"🔑 Generated encryption key: {ENCRYPTION_KEY}")
else:
    print(f"🔑 Using provided encryption key: {ENCRYPTION_KEY[:20]}...")

try:
    cipher = Fernet(ENCRYPTION_KEY.encode() if isinstance(ENCRYPTION_KEY, str) else ENCRYPTION_KEY)
except Exception as e:
    print(f"❌ Error initializing cipher: {e}")
    raise

def decrypt_token(encrypted_token: str) -> str:
    """Decrypt token for use"""
    try:
        return cipher.decrypt(encrypted_token.encode()).decode()
    except Exception as e:
        print(f"❌ Error decrypting token: {e}")
        raise

# Security
security = HTTPBearer(auto_error=False)

class User(BaseModel):
    id: str
    email: str
    name: str
    created_at: str

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Get current user from Supabase JWT token"""
    try:
        if not credentials or not credentials.credentials:
            logger.warning("No credentials provided")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authorization credentials required"
            )
            
        token = credentials.credentials
        logger.info(f"Authenticating user with token: {token[:20]}...")
        
        response = supabase.auth.get_user(token)
        logger.info(f"Supabase auth response: {response}")
        
        if response and hasattr(response, 'user') and response.user:
            user_data = response.user
            logger.info(f"User authenticated: {user_data.id}")
            return User(
                id=user_data.id,
                email=user_data.email or "unknown@example.com",
                name=user_data.user_metadata.get('name', user_data.email or "Unknown User"),
                created_at=user_data.created_at.isoformat() if hasattr(user_data.created_at, 'isoformat') else str(user_data.created_at)
            )
        else:
            logger.warning("No user found in response")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token or user not found"
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Authentication error: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication failed"
        )

router = APIRouter(prefix="/api/blogs", tags=["blogs"])

@router.get("/public")
async def get_public_blogs(
    status: Optional[str] = Query("published", description="Filter by status"),
    limit: int = Query(50, description="Number of blogs to return"),
    offset: int = Query(0, description="Number of blogs to skip")
):
    """Get public blogs from main ATSNAI.com website - no authentication required"""
    try:
        logger.info(f"Fetching public blogs from main_site_blogs with status: {status}")
        
        # Get published blogs from main_site_blogs table for public display
        # Normalize status to lowercase for consistency
        status_filter = (status or "published").lower()
        
        query = supabase_admin.table("main_site_blogs").select("*")
        query = query.eq("status", status_filter)
        query = query.order("created_at", desc=True).range(offset, offset + limit - 1)
        
        response = query.execute()
        blogs = response.data if response.data else []
        
        logger.info(f"Found {len(blogs)} public blogs from main_site_blogs with status '{status_filter}'")
        logger.info(f"Sample blog statuses: {[b.get('status') for b in blogs[:3]]}")
        return {"blogs": blogs, "total": len(blogs)}
        
    except Exception as e:
        logger.error(f"Error fetching public blogs: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch blogs: {str(e)}")

@router.get("/public/all")
async def get_all_blogs_public(
    limit: int = Query(100, description="Number of blogs to return"),
    offset: int = Query(0, description="Number of blogs to skip")
):
    """Get all main ATSNAI website blogs (published and draft) - public endpoint for admin page.
    Returns blogs from main_site_blogs table (main ATSNAI.com website blogs).
    Emily user blogs are stored in blog_posts table and are excluded."""
    try:
        logger.info(f"Fetching all main site blogs from main_site_blogs table (admin view)")
        
        # Query main_site_blogs table (separate table for main ATSNAI.com website blogs)
        # Emily user blogs are stored in blog_posts table and are not included here
        query = supabase_admin.table("main_site_blogs").select("*")
        query = query.order("created_at", desc=True).range(offset, offset + limit - 1)
        
        response = query.execute()
        blogs = response.data if response.data else []
        
        logger.info(f"Found {len(blogs)} main site blogs from main_site_blogs table")
        return {"blogs": blogs, "total": len(blogs)}
        
    except Exception as e:
        logger.error(f"Error fetching all blogs: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch blogs: {str(e)}")

@router.get("/")
async def get_blogs(
    current_user: User = Depends(get_current_user),
    status: Optional[str] = Query(None, description="Filter by status"),
    site_id: Optional[str] = Query(None, description="Filter by WordPress site ID"),
    limit: int = Query(50, description="Number of blogs to return"),
    offset: int = Query(0, description="Number of blogs to skip")
):
    """Get all blogs for the current user"""
    try:
        logger.info(f"Fetching blogs for user: {current_user.id}")
        
        # Get blogs without join for now - we'll add the join back after migration
        query = supabase_admin.table("blog_posts").select("*").eq("author_id", current_user.id)
        
        if status:
            query = query.eq("status", status)
        if site_id:
            query = query.eq("wordpress_site_id", site_id)
        
        query = query.order("created_at", desc=True).range(offset, offset + limit - 1)
        
        response = query.execute()
        blogs = response.data if response.data else []
        
        logger.info(f"Found {len(blogs)} blogs")
        return {"blogs": blogs, "total": len(blogs)}
        
    except Exception as e:
        logger.error(f"Error fetching blogs: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch blogs: {str(e)}")


# Stats route (must come before {blog_id} route)
@router.get("/stats/")
async def get_blog_stats(
    current_user: User = Depends(get_current_user)
):
    """Get blog statistics for the current user"""
    try:
        logger.info(f"Fetching blog stats for user: {current_user.id}")
        
        # Get total blogs
        total_response = supabase_admin.table("blog_posts").select("id", count="exact").eq("author_id", current_user.id).execute()
        total_blogs = total_response.count if total_response.count else 0
        
        # Get published blogs
        published_response = supabase_admin.table("blog_posts").select("id", count="exact").eq("author_id", current_user.id).eq("status", "published").execute()
        published_blogs = published_response.count if published_response.count else 0
        
        # Get draft blogs
        draft_response = supabase_admin.table("blog_posts").select("id", count="exact").eq("author_id", current_user.id).eq("status", "draft").execute()
        draft_blogs = draft_response.count if draft_response.count else 0
        
        # Get scheduled blogs
        scheduled_response = supabase_admin.table("blog_posts").select("id", count="exact").eq("author_id", current_user.id).eq("status", "scheduled").execute()
        scheduled_blogs = scheduled_response.count if scheduled_response.count else 0
        
        # Get total campaigns
        campaigns_response = supabase_admin.table("blog_campaigns").select("id", count="exact").eq("user_id", current_user.id).execute()
        total_campaigns = campaigns_response.count if campaigns_response.count else 0
        
        stats = {
            "total_blogs": total_blogs,
            "published_blogs": published_blogs,
            "draft_blogs": draft_blogs,
            "scheduled_blogs": scheduled_blogs,
            "total_campaigns": total_campaigns
        }
        
        logger.info(f"Blog stats: {stats}")
        return {"stats": stats}
        
    except Exception as e:
        logger.error(f"Error fetching blog stats: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch blog stats: {str(e)}")

@router.get("/public/by-slug")
async def get_public_blog_by_slug_query(
    slug: str = Query(..., description="Blog slug")
):
    """Get a specific published blog by slug - public endpoint (query parameter version)
    Uses query parameter to avoid issues with special characters in path
    """
    try:
        # Decode the slug in case it's URL encoded
        try:
            decoded_slug = urllib.parse.unquote(urllib.parse.unquote(slug))
            if decoded_slug == slug:
                decoded_slug = urllib.parse.unquote(slug)
        except:
            decoded_slug = slug
        
        logger.info(f"Fetching public blog - received slug: '{slug}', decoded: '{decoded_slug}'")
        
        # Get all published blogs from main_site_blogs table to find the matching one
        all_published = supabase_admin.table("main_site_blogs").select("id, slug, title, status").eq("status", "published").execute()
        logger.info(f"Total published blogs in main_site_blogs: {len(all_published.data or [])}")
        
        matching_blog = None
        
        if all_published.data:
            logger.info(f"Available slugs in DB: {[b.get('slug') for b in all_published.data]}")
            
            # Try multiple matching strategies
            for blog in all_published.data:
                blog_slug = blog.get('slug', '')
                # Try exact match (decoded)
                if blog_slug == decoded_slug:
                    matching_blog = blog
                    logger.info(f"✓ Found exact match with decoded slug: {blog_slug}")
                    break
                # Try exact match (original as received)
                if blog_slug == slug:
                    matching_blog = blog
                    logger.info(f"✓ Found exact match with original slug: {blog_slug}")
                    break
                # Try case-insensitive match
                if blog_slug.lower() == decoded_slug.lower():
                    matching_blog = blog
                    logger.info(f"✓ Found case-insensitive match: {blog_slug}")
                    break
                # Try matching by removing question marks and timestamps (handles ? vs %3F differences)
                # Remove timestamp suffix (e.g., -1762770338)
                import re
                blog_slug_base = re.sub(r'-\d+$', '', blog_slug)
                decoded_slug_base = re.sub(r'-\d+$', '', decoded_slug)
                blog_slug_clean = blog_slug_base.replace('?', '').replace('%3F', '').replace('&', '')
                decoded_slug_clean = decoded_slug_base.replace('?', '').replace('%3F', '').replace('&', '')
                if blog_slug_clean and decoded_slug_clean and blog_slug_clean == decoded_slug_clean:
                    matching_blog = blog
                    logger.info(f"✓ Found match after cleaning: {blog_slug} (cleaned: {blog_slug_clean})")
                    break
        
        if not matching_blog:
            logger.warning(f"✗ Blog not found with slug: '{decoded_slug}' (received: '{slug}')")
            logger.warning(f"Available slugs: {[b.get('slug') for b in (all_published.data or [])]}")
            raise HTTPException(status_code=404, detail=f"Blog not found. Searched for: {decoded_slug}")
        
        # Fetch full blog data from main_site_blogs table
        response = supabase_admin.table("main_site_blogs").select("*").eq("id", matching_blog['id']).execute()
        
        if not response.data or len(response.data) == 0:
            logger.error(f"Failed to fetch full blog data for ID: {matching_blog['id']}")
            raise HTTPException(status_code=404, detail="Blog not found")
        
        blog = response.data[0]
        logger.info(f"✓ Blog found: {blog['title']} (ID: {blog['id']})")
        return {"blog": blog}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching blog: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch blog: {str(e)}")

@router.get("/{blog_id}")
async def get_blog(
    blog_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get a specific blog by ID"""
    try:
        logger.info(f"Fetching blog {blog_id} for user: {current_user.id}")
        
        response = supabase_admin.table("blog_posts").select("*").eq("id", blog_id).eq("author_id", current_user.id).execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail="Blog not found")
        
        blog = response.data[0]
        logger.info(f"Blog found: {blog['title']}")
        return {"blog": blog}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching blog: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch blog: {str(e)}")

@router.post("/")
async def create_blog(
    blog_data: dict,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
):
    """Create a new blog post manually - public endpoint"""
    try:
        # Try to get user if authenticated, otherwise use None
        user_id = None
        try:
            if credentials and credentials.credentials:
                response = supabase.auth.get_user(credentials.credentials)
                if response and hasattr(response, 'user') and response.user:
                    user_id = response.user.id
                    logger.info(f"Creating blog for authenticated user: {user_id}")
                else:
                    logger.info("Creating blog without authentication")
            else:
                logger.info("Creating blog without authentication")
        except Exception as auth_error:
            logger.info(f"Creating blog without authentication: {auth_error}")
        
        # Generate slug from title if not provided
        title = blog_data.get('title', 'Untitled')
        # Create slug: lowercase, replace spaces/special chars with dashes, remove multiple dashes
        if not blog_data.get('slug'):
            slug = re.sub(r'[^\w\s-]', '', title.lower())  # Remove special characters
            slug = re.sub(r'[-\s]+', '-', slug)  # Replace spaces and multiple dashes with single dash
            slug = slug.strip('-')[:200]  # Remove leading/trailing dashes and limit length
        else:
            slug = blog_data.get('slug')
        
        # Ensure slug is unique by appending timestamp if needed
        # Check in both main_site_blogs and blog_posts to ensure uniqueness across both tables
        existing_slug_check_main = supabase_admin.table("main_site_blogs").select("id").eq("slug", slug).execute()
        existing_slug_check_user = supabase_admin.table("blog_posts").select("id").eq("slug", slug).execute()
        if existing_slug_check_main.data or existing_slug_check_user.data:
            slug = f"{slug}-{int(datetime.now().timestamp())}"
        
        # Prepare blog data for main_site_blogs table
        # Get metadata and add featured_image to it if column doesn't exist
        metadata = blog_data.get('metadata', {})
        featured_image = blog_data.get('featured_image')
        
        # Store featured_image in metadata if column doesn't exist in schema
        if featured_image:
            metadata['featured_image'] = featured_image
        
        # Create blog data for main_site_blogs table (no author_id, wordpress_site_id, or wordpress_post_id)
        new_blog = {
            "id": str(uuid.uuid4()),
            "title": title,
            "content": blog_data.get('content', ''),
            "excerpt": blog_data.get('excerpt', ''),
            "slug": slug,
            "status": (blog_data.get('status', 'draft') or 'draft').lower(),  # Normalize to lowercase
            "post_type": blog_data.get('post_type', 'post'),
            "format": blog_data.get('format', 'standard'),
            "categories": blog_data.get('categories', []),
            "tags": blog_data.get('tags', []),
            "scheduled_at": blog_data.get('scheduled_at'),
            "published_at": blog_data.get('published_at'),
            "meta_description": blog_data.get('meta_description', ''),
            "meta_keywords": blog_data.get('meta_keywords', []),
            "reading_time": blog_data.get('reading_time', 0),
            "word_count": blog_data.get('word_count', 0),
            "seo_score": blog_data.get('seo_score', 0),
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat(),
            "metadata": metadata
        }
        
        # Add featured_image if provided (column exists in main_site_blogs schema)
        if featured_image:
            new_blog["featured_image"] = featured_image
        
        # Insert blog into main_site_blogs table (main ATSNAI.com website blogs)
        logger.info("Creating main site blog in main_site_blogs table")
        try:
            response = supabase_admin.table("main_site_blogs").insert(new_blog).execute()
            
            if not response.data:
                raise HTTPException(status_code=500, detail="Failed to create blog")
            
            logger.info(f"Main site blog created: {new_blog['id']}")
            return {"message": "Blog created successfully", "blog": response.data[0]}
        except Exception as insert_error:
            logger.error(f"Error creating main site blog: {insert_error}")
            raise HTTPException(status_code=500, detail=f"Failed to create blog: {str(insert_error)}")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating blog: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create blog: {str(e)}")

@router.post("/generate")
async def generate_blogs(
    current_user: User = Depends(get_current_user)
):
    """Generate new blog posts for the user"""
    try:
        logger.info(f"Generating blogs for user: {current_user.id}")
        
        # Import here to avoid circular imports
        from agents.blog_writing_agent import BlogWritingAgent
        
        # Initialize blog writing agent with service role key to bypass RLS for token tracking
        blog_agent = BlogWritingAgent(
            supabase_url=os.getenv("SUPABASE_URL"),
            supabase_key=os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY"),
            openai_api_key=os.getenv("OPENAI_API_KEY")
        )
        
        # Generate blogs
        result = await blog_agent.generate_blogs_for_user(current_user.id)
        
        if result.get("success"):
            logger.info(f"Blog generation successful: {result.get('total_blogs', 0)} blogs created")
            return result
        else:
            logger.error(f"Blog generation failed: {result.get('error', 'Unknown error')}")
            raise HTTPException(status_code=500, detail=f"Failed to generate blogs: {result.get('error', 'Unknown error')}")
            
    except Exception as e:
        logger.error(f"Error generating blogs: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate blogs: {str(e)}")

@router.post("/public/{blog_id}/generate-image")
async def generate_blog_image(blog_id: str):
    """Generate an image for a blog post using Gemini 2.5 Preview Flash"""
    logger.info(f"Route hit: /api/blogs/public/{blog_id}/generate-image")
    try:
        import google.generativeai as genai
        import base64
        import uuid
        from datetime import datetime
        
        logger.info(f"Generating image for blog {blog_id}")
        
        # Get blog data from main_site_blogs table
        blog_response = supabase_admin.table("main_site_blogs").select("*").eq("id", blog_id).execute()
        
        if not blog_response.data:
            raise HTTPException(status_code=404, detail="Blog not found")
        
        blog = blog_response.data[0]
        
        # Get Gemini API key
        gemini_api_key = os.getenv("GEMINI_API_KEY")
        if not gemini_api_key:
            raise HTTPException(status_code=500, detail="Image generation service not configured")
        
        # Configure Gemini
        genai.configure(api_key=gemini_api_key)
        gemini_image_model = 'gemini-2.5-flash-image'
        
        # Create image prompt from blog content
        title = blog.get('title', 'Blog Post')
        excerpt = blog.get('excerpt', '')
        content = blog.get('content', '')
        
        # Extract text from HTML content
        import re
        text_content = re.sub(r'<[^>]+>', '', content) if content else ''
        content_summary = text_content[:500] if text_content else excerpt[:500]
        
        # Create prompt for image generation
        image_prompt = f"""Create a professional, high-quality blog post featured image for the following blog:

Title: {title}

Content Summary: {content_summary}

Requirements:
- Professional and visually appealing
- Suitable for blog post header/featured image
- High resolution (1024x1024 or landscape format)
- Modern design with good composition
- Engaging and eye-catching
- Relevant to the blog topic
- Clean and professional aesthetic
- No text overlays (image only)
"""
        
        logger.info(f"Generating image with prompt: {image_prompt[:200]}...")
        
        # Generate image using Gemini
        model = genai.GenerativeModel(gemini_image_model)
        response = model.generate_content(image_prompt)
        
        # Extract image data
        image_data = None
        if response.candidates and len(response.candidates) > 0:
            candidate = response.candidates[0]
            if candidate.content.parts:
                for part in candidate.content.parts:
                    if hasattr(part, 'inline_data') and part.inline_data and part.inline_data.data:
                        image_data = part.inline_data.data
                        break
        
        if not image_data:
            raise HTTPException(status_code=500, detail="Failed to generate image - no image data returned")
        
        # Convert to bytes if needed
        if isinstance(image_data, str):
            image_bytes = base64.b64decode(image_data)
        else:
            image_bytes = image_data
        
        # Convert PNG to WebP format for better compression and quality
        file_ext = "webp"
        content_type = "image/webp"
        
        try:
            from PIL import Image
            import io
            
            # Open the image from bytes
            image = Image.open(io.BytesIO(image_bytes))
            
            # Convert RGBA to RGB if necessary (WebP supports both, but RGB is more compatible)
            if image.mode == 'RGBA':
                # Create a white background for transparency
                rgb_image = Image.new('RGB', image.size, (255, 255, 255))
                rgb_image.paste(image, mask=image.split()[3])  # Use alpha channel as mask
                image = rgb_image
            elif image.mode != 'RGB':
                image = image.convert('RGB')
            
            # Convert to WebP format with high quality
            webp_buffer = io.BytesIO()
            image.save(webp_buffer, format='WebP', quality=90, method=6)
            image_bytes = webp_buffer.getvalue()
            
            logger.info(f"✅ Converted image to WebP format. Size: {len(image_bytes)} bytes")
        except ImportError:
            logger.warning("PIL/Pillow not available, using original PNG format")
            # Fallback to PNG if PIL is not available
            file_ext = "png"
            content_type = "image/png"
        except Exception as e:
            logger.warning(f"Failed to convert to WebP: {e}, using original format")
            # Fallback to PNG if conversion fails
            file_ext = "png"
            content_type = "image/png"
        
        # Upload to Supabase Storage - using "blog image" bucket
        file_name = f"{blog_id}/{uuid.uuid4()}.{file_ext}"
        bucket_name = "blog image"
        
        # Upload image
        upload_response = supabase_admin.storage.from_(bucket_name).upload(
            file_name,
            image_bytes,
            file_options={"content-type": content_type, "upsert": "true"}
        )
        
        # Get public URL
        image_url_response = supabase_admin.storage.from_(bucket_name).get_public_url(file_name)
        image_url = image_url_response
        
        # Update blog with featured image in main_site_blogs table
        metadata = blog.get('metadata', {})
        if not isinstance(metadata, dict):
            metadata = {}
        metadata['featured_image'] = image_url
        metadata['image_generated_at'] = datetime.now().isoformat()
        
        # Update featured_image column if it exists, otherwise store in metadata
        update_data = {
            "metadata": metadata,
            "updated_at": datetime.now().isoformat()
        }
        # Try to set featured_image column if it exists
        if 'featured_image' in blog or True:  # Always try to set it
            update_data["featured_image"] = image_url
        
        update_response = supabase_admin.table("main_site_blogs").update(update_data).eq("id", blog_id).execute()
        
        logger.info(f"Image generated and saved for blog {blog_id}: {image_url}")
        
        return {
            "success": True,
            "image_url": image_url,
            "message": "Image generated successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating blog image: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate image: {str(e)}")

@router.post("/public/{blog_id}/upload-image")
async def upload_blog_image(
    blog_id: str,
    file: UploadFile = File(...)
):
    """Upload a manual image for a blog post - uses same bucket and path format as generated images"""
    logger.info(f"Route hit: /api/blogs/public/{blog_id}/upload-image")
    try:
        # Get blog data from main_site_blogs table to verify it exists
        blog_response = supabase_admin.table("main_site_blogs").select("*").eq("id", blog_id).execute()
        
        if not blog_response.data:
            raise HTTPException(status_code=404, detail="Blog not found")
        
        blog = blog_response.data[0]
        
        # Validate file type
        allowed_types = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
        if file.content_type not in allowed_types:
            raise HTTPException(status_code=400, detail="Invalid file type. Please upload a JPEG, PNG, GIF, or WebP image.")
        
        # Read file content
        file_content = await file.read()
        logger.info(f"File content read - size: {len(file_content)} bytes, type: {file.content_type}")
        
        # Validate file size (max 10MB)
        max_size = 10 * 1024 * 1024  # 10MB
        if len(file_content) > max_size:
            raise HTTPException(status_code=400, detail="File size must be less than 10MB")
        
        # Determine file extension from filename or content type
        file_ext = file.filename.split('.')[-1].lower() if '.' in file.filename else None
        
        # If no extension in filename, try to determine from content type
        if not file_ext or file_ext not in ['jpg', 'jpeg', 'png', 'gif', 'webp']:
            if file.content_type:
                if 'jpeg' in file.content_type or 'jpg' in file.content_type:
                    file_ext = 'jpg'
                elif 'png' in file.content_type:
                    file_ext = 'png'
                elif 'gif' in file.content_type:
                    file_ext = 'gif'
                elif 'webp' in file.content_type:
                    file_ext = 'webp'
                else:
                    file_ext = 'png'  # Default fallback
            else:
                # Try to detect from file content (magic bytes)
                if file_content.startswith(b'RIFF') and b'WEBP' in file_content[:12]:
                    file_ext = 'webp'
                elif file_content.startswith(b'\x89PNG'):
                    file_ext = 'png'
                elif file_content.startswith(b'\xff\xd8\xff'):
                    file_ext = 'jpg'
                elif file_content.startswith(b'GIF'):
                    file_ext = 'gif'
                else:
                    file_ext = 'png'  # Default fallback
        
        # Determine content type for upload
        content_type_map = {
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'png': 'image/png',
            'gif': 'image/gif',
            'webp': 'image/webp'
        }
        upload_content_type = content_type_map.get(file_ext, file.content_type or 'image/png')
        
        # Upload to Supabase Storage - using "blog image" bucket (same as generated images)
        file_name = f"{blog_id}/{uuid.uuid4()}.{file_ext}"
        bucket_name = "blog image"
        
        logger.info(f"Uploading to bucket: {bucket_name}, path: {file_name}, format: {file_ext}, content-type: {upload_content_type}")
        
        # Upload image with upsert to allow replacing existing images
        upload_response = supabase_admin.storage.from_(bucket_name).upload(
            file_name,
            file_content,
            file_options={"content-type": upload_content_type, "upsert": "true"}
        )
        
        if hasattr(upload_response, 'error') and upload_response.error:
            logger.error(f"Storage upload failed: {upload_response.error}")
            raise HTTPException(status_code=400, detail=f"Storage upload failed: {upload_response.error}")
        
        # Get public URL
        image_url_response = supabase_admin.storage.from_(bucket_name).get_public_url(file_name)
        image_url = image_url_response
        
        logger.info(f"Image uploaded successfully: {image_url}")
        
        # Update blog with featured image in main_site_blogs table
        metadata = blog.get('metadata', {})
        if not isinstance(metadata, dict):
            metadata = {}
        metadata['featured_image'] = image_url
        metadata['image_uploaded_at'] = datetime.now().isoformat()
        
        # Update featured_image column if it exists, otherwise store in metadata
        update_data = {
            "metadata": metadata,
            "updated_at": datetime.now().isoformat()
        }
        # Try to set featured_image column if it exists
        if 'featured_image' in blog or True:  # Always try to set it
            update_data["featured_image"] = image_url
        
        update_response = supabase_admin.table("main_site_blogs").update(update_data).eq("id", blog_id).execute()
        
        logger.info(f"Image uploaded and saved for blog {blog_id}: {image_url}")
        
        return {
            "success": True,
            "image_url": image_url,
            "message": "Image uploaded successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error uploading blog image: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to upload image: {str(e)}")

@router.put("/public/{blog_id}")
async def update_blog_public(
    blog_id: str,
    blog_data: dict
):
    """Update a blog post - public endpoint for admin page"""
    try:
        logger.info(f"Updating blog {blog_id} (public endpoint)")
        
        # Check if blog exists in main_site_blogs table
        existing_response = supabase_admin.table("main_site_blogs").select("id").eq("id", blog_id).execute()
        
        if not existing_response.data:
            raise HTTPException(status_code=404, detail="Blog not found")
        
        # Prepare update data
        update_data = {}
        
        # Handle slug generation if title changed
        if 'title' in blog_data:
            title = blog_data.get('title', 'Untitled')
            if not blog_data.get('slug'):
                slug = re.sub(r'[^\w\s-]', '', title.lower())
                slug = re.sub(r'[-\s]+', '-', slug)
                slug = slug.strip('-')[:200]
                update_data['slug'] = slug
        
        # Handle featured_image in metadata
        if 'featured_image' in blog_data:
            metadata = blog_data.get('metadata', {})
            if not isinstance(metadata, dict):
                metadata = {}
            metadata['featured_image'] = blog_data.get('featured_image')
            update_data['metadata'] = metadata
            # Remove featured_image from update_data if it was there
            if 'featured_image' in blog_data:
                del blog_data['featured_image']
        
        # Normalize status to lowercase
        if 'status' in blog_data:
            blog_data['status'] = (blog_data.get('status') or 'draft').lower()
        
        # Merge all update data
        update_data.update(blog_data)
        update_data["updated_at"] = datetime.now().isoformat()
        
        # Remove fields that don't exist in main_site_blogs table
        fields_to_remove = ['author_id', 'wordpress_site_id', 'wordpress_post_id']
        for field in fields_to_remove:
            if field in update_data:
                del update_data[field]
        
        # Update blog in main_site_blogs table
        response = supabase_admin.table("main_site_blogs").update(update_data).eq("id", blog_id).execute()
        
        if not response.data:
            raise HTTPException(status_code=500, detail="Failed to update blog")
        
        logger.info(f"Blog updated: {blog_id}")
        return {"message": "Blog updated successfully", "blog": response.data[0]}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating blog: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to update blog: {str(e)}")

@router.put("/{blog_id}")
async def update_blog(
    blog_id: str,
    blog_data: dict,
    current_user: User = Depends(get_current_user)
):
    """Update a blog post"""
    try:
        logger.info(f"Updating blog {blog_id} for user: {current_user.id}")
        
        # Verify blog belongs to user
        existing_response = supabase_admin.table("blog_posts").select("id").eq("id", blog_id).eq("author_id", current_user.id).execute()
        
        if not existing_response.data:
            raise HTTPException(status_code=404, detail="Blog not found")
        
        # Update blog
        update_data = {
            **blog_data,
            "updated_at": datetime.now().isoformat()
        }
        
        response = supabase_admin.table("blog_posts").update(update_data).eq("id", blog_id).eq("author_id", current_user.id).execute()
        
        if not response.data:
            raise HTTPException(status_code=500, detail="Failed to update blog")
        
        logger.info(f"Blog updated: {blog_id}")
        return {"message": "Blog updated successfully", "blog": response.data[0]}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating blog: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to update blog: {str(e)}")

@router.delete("/public/{blog_id}")
async def delete_blog_public(
    blog_id: str
):
    """Delete a blog post - public endpoint for admin page"""
    try:
        logger.info(f"Deleting blog {blog_id} (public endpoint)")
        
        # Get blog details from main_site_blogs table
        blog_response = supabase_admin.table("main_site_blogs").select("*").eq("id", blog_id).execute()
        
        if not blog_response.data:
            raise HTTPException(status_code=404, detail="Blog not found")
        
        blog = blog_response.data[0]
        
        # Delete from main_site_blogs table
        delete_response = supabase_admin.table("main_site_blogs").delete().eq("id", blog_id).execute()
        
        logger.info(f"Blog deleted: {blog_id}")
        return {"message": "Blog deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting blog: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete blog: {str(e)}")

@router.delete("/{blog_id}")
async def delete_blog(
    blog_id: str,
    current_user: User = Depends(get_current_user)
):
    """Delete a blog post from both WordPress and Supabase"""
    try:
        logger.info(f"Deleting blog {blog_id} for user: {current_user.id}")
        
        # Get blog details including WordPress info
        blog_response = supabase_admin.table("blog_posts").select("*").eq("id", blog_id).eq("author_id", current_user.id).execute()
        
        if not blog_response.data:
            raise HTTPException(status_code=404, detail="Blog not found")
        
        blog = blog_response.data[0]
        
        # If blog was published to WordPress, delete it from there too
        if blog.get('wordpress_post_id') and blog.get('wordpress_site_id'):
            try:
                # Get WordPress connection details
                wordpress_response = supabase_admin.table("platform_connections").select("*").eq("id", blog['wordpress_site_id']).eq("platform", "wordpress").execute()
                
                if wordpress_response.data:
                    wordpress_site = wordpress_response.data[0]
                    
                    # Decrypt WordPress app password
                    try:
                        app_password = decrypt_token(wordpress_site['wordpress_app_password_encrypted'])
                    except Exception as e:
                        logger.error(f"Error decrypting WordPress app password: {e}")
                        # Continue with Supabase deletion even if WordPress deletion fails
                    else:
                        # Delete from WordPress using REST API
                        import requests
                        from requests.auth import HTTPBasicAuth
                        
                        delete_url = f"{wordpress_site['wordpress_site_url'].rstrip('/')}/wp-json/wp/v2/posts/{blog['wordpress_post_id']}"
                        
                        logger.info(f"Deleting from WordPress: {delete_url}")
                        
                        response = requests.delete(
                            delete_url,
                            auth=HTTPBasicAuth(wordpress_site['wordpress_username'], app_password),
                            headers={
                                'Accept': 'application/json',
                                'Content-Type': 'application/json',
                                'User-Agent': 'Agent-Emily/1.0'
                            },
                            timeout=30
                        )
                        
                        if response.status_code == 200:
                            logger.info(f"Blog deleted from WordPress: Post ID {blog['wordpress_post_id']}")
                        else:
                            logger.warning(f"Failed to delete from WordPress (status {response.status_code}): {response.text}")
                            
            except Exception as e:
                logger.error(f"Error deleting from WordPress: {e}")
                # Continue with Supabase deletion even if WordPress deletion fails
        
        # Delete from Supabase
        supabase_admin.table("blog_posts").delete().eq("id", blog_id).eq("author_id", current_user.id).execute()
        
        logger.info(f"Blog deleted from Supabase: {blog_id}")
        return {"message": "Blog deleted successfully from both WordPress and Supabase"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting blog: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete blog: {str(e)}")

@router.post("/{blog_id}/publish")
async def publish_blog(
    blog_id: str,
    current_user: User = Depends(get_current_user)
):
    """Publish a blog to WordPress"""
    try:
        logger.info(f"Publishing blog {blog_id} for user: {current_user.id}")
        
        # Get blog details
        blog_response = supabase_admin.table("blog_posts").select("*").eq("id", blog_id).eq("author_id", current_user.id).execute()
        
        if not blog_response.data:
            raise HTTPException(status_code=404, detail="Blog not found")
        
        blog = blog_response.data[0]
        
        # Check if blog has WordPress connection
        if not blog.get('wordpress_site_id'):
            raise HTTPException(status_code=400, detail="This blog is in standalone mode and cannot be published to WordPress. Please connect WordPress in settings to enable publishing.")
        
        # Get the WordPress connection from platform_connections
        wordpress_response = supabase_admin.table("platform_connections").select("*").eq("id", blog['wordpress_site_id']).eq("platform", "wordpress").execute()
        
        if not wordpress_response.data:
            raise HTTPException(status_code=400, detail="WordPress site not found")
        
        wordpress_site = wordpress_response.data[0]
        
        # Decrypt WordPress app password
        try:
            app_password = decrypt_token(wordpress_site['wordpress_app_password_encrypted'])
        except Exception as e:
            logger.error(f"Error decrypting WordPress app password: {e}")
            raise HTTPException(status_code=500, detail="Failed to decrypt WordPress app password")
        
        # Get featured image URL from metadata or direct field
        featured_image_url = None
        if blog.get('metadata') and isinstance(blog.get('metadata'), dict):
            featured_image_url = blog['metadata'].get('featured_image')
        if not featured_image_url:
            featured_image_url = blog.get('featured_image')
        
        logger.info(f"Blog featured image URL: {featured_image_url if featured_image_url else 'No featured image found'}")
        
        # Format blog content for WordPress API
        # Clean and prepare content - ensure it's proper HTML
        blog_content = blog.get('content', '')
        
        # If content is empty, use excerpt as fallback
        if not blog_content or not blog_content.strip():
            blog_content = blog.get('excerpt', '')
        
        # Ensure content is properly formatted HTML
        # WordPress REST API expects HTML content in the 'content' field
        # The content should already be HTML from the editor
        if blog_content:
            # Only fix double-encoded HTML entities (not single-encoded ones)
            # Fix double-encoded ampersands, but preserve single-encoded ones
            blog_content = blog_content.replace('&amp;amp;', '&amp;')  # Fix double-encoded &
            blog_content = blog_content.replace('&amp;lt;', '&lt;')    # Fix double-encoded <
            blog_content = blog_content.replace('&amp;gt;', '&gt;')    # Fix double-encoded >
            blog_content = blog_content.replace('&amp;quot;', '&quot;') # Fix double-encoded "
            # Ensure proper line breaks are preserved
            blog_content = blog_content.strip()
        
        wordpress_data = {
            "title": blog['title'],
            "content": blog_content,  # Send as HTML - WordPress will render it
            "excerpt": blog.get('excerpt', ''),
            "status": "publish",
            "format": blog.get('format', 'standard'),
            "categories": blog.get('categories', []),
            "tags": blog.get('tags', []),
            "meta": {
                "description": blog.get('meta_description', ''),
                "keywords": blog.get('meta_keywords', [])
            }
        }
        
        logger.info(f"Content length: {len(blog_content)} characters. First 200 chars: {blog_content[:200]}")
        
        # Post to WordPress using REST API authentication
        rest_api_url = f"{wordpress_site['wordpress_site_url'].rstrip('/')}/wp-json/wp/v2/posts"
        media_api_url = f"{wordpress_site['wordpress_site_url'].rstrip('/')}/wp-json/wp/v2/media"
        
        logger.info(f"Publishing to WordPress using REST API: {rest_api_url}")
        
        try:
            import requests
            from requests.auth import HTTPBasicAuth
            import io
            from urllib.parse import urlparse
            
            # Create a new session to avoid cookie persistence issues
            session = requests.Session()
            
            # Disable automatic cookie handling to prevent multiple cookies issue
            session.cookies.clear()
            
            # Upload featured image to WordPress if it exists
            featured_media_id = None
            if featured_image_url:
                try:
                    logger.info(f"Uploading featured image to WordPress: {featured_image_url}")
                    
                    # Download the image from Supabase/URL
                    # Try with headers first (for Supabase public URLs)
                    headers = {
                        'User-Agent': 'Agent-Emily/1.0',
                        'Accept': 'image/*'
                    }
                    
                    image_response = requests.get(featured_image_url, timeout=30, headers=headers, stream=True)
                    
                    if image_response.status_code == 200:
                        # Get image content
                        image_content = image_response.content
                        
                        if not image_content or len(image_content) == 0:
                            logger.warning("Downloaded image is empty")
                        else:
                            # Get image filename from URL
                            parsed_url = urlparse(featured_image_url)
                            filename = parsed_url.path.split('/')[-1] or 'blog-image.jpg'
                            # Remove query parameters from filename
                            if '?' in filename:
                                filename = filename.split('?')[0]
                            
                            # Determine content type from response headers or filename
                            # Priority: 1. Response Content-Type header, 2. Filename extension, 3. Magic bytes
                            content_type = image_response.headers.get('Content-Type', '')
                            logger.info(f"Image Content-Type from response header: {content_type}")
                            
                            if not content_type or not content_type.startswith('image/'):
                                # Try to determine from filename
                                filename_lower = filename.lower()
                                if filename_lower.endswith('.png'):
                                    content_type = 'image/png'
                                elif filename_lower.endswith('.gif'):
                                    content_type = 'image/gif'
                                elif filename_lower.endswith('.webp'):
                                    content_type = 'image/webp'
                                elif filename_lower.endswith('.jpg') or filename_lower.endswith('.jpeg'):
                                    content_type = 'image/jpeg'
                                else:
                                    # Try to detect from content (check magic bytes)
                                    if image_content.startswith(b'RIFF') and b'WEBP' in image_content[:12]:
                                        # WebP format: starts with RIFF and contains WEBP
                                        content_type = 'image/webp'
                                        filename = filename.rsplit('.', 1)[0] + '.webp' if '.' in filename else 'blog-image.webp'
                                    elif image_content.startswith(b'\x89PNG'):
                                        content_type = 'image/png'
                                        filename = filename.rsplit('.', 1)[0] + '.png' if '.' in filename else 'blog-image.png'
                                    elif image_content.startswith(b'\xff\xd8\xff'):
                                        content_type = 'image/jpeg'
                                        filename = filename.rsplit('.', 1)[0] + '.jpg' if '.' in filename else 'blog-image.jpg'
                                    elif image_content.startswith(b'GIF'):
                                        content_type = 'image/gif'
                                        filename = filename.rsplit('.', 1)[0] + '.gif' if '.' in filename else 'blog-image.gif'
                                    else:
                                        # Default to WebP since we're generating in WebP format
                                        content_type = 'image/webp'
                                        filename = 'blog-image.webp'
                                        logger.info("Could not detect image format from content, defaulting to WebP")
                            
                            logger.info(f"Preparing to upload image: {filename}, Content-Type: {content_type}, Size: {len(image_content)} bytes")
                            
                            # Prepare file for upload
                            files = {
                                'file': (filename, io.BytesIO(image_content), content_type)
                            }
                            
                            # Upload to WordPress Media Library
                            media_response = session.post(
                                media_api_url,
                                files=files,
                                auth=HTTPBasicAuth(wordpress_site['wordpress_username'], app_password),
                                headers={
                                    'Content-Disposition': f'attachment; filename="{filename}"',
                                    'User-Agent': 'Agent-Emily/1.0'
                                },
                                timeout=60,
                                allow_redirects=False
                            )
                            
                            if media_response.status_code == 201:
                                media_data = media_response.json()
                                featured_media_id = media_data.get('id')
                                
                                # Ensure featured_media_id is an integer (WordPress REST API requires integer)
                                if featured_media_id:
                                    try:
                                        featured_media_id = int(featured_media_id)
                                    except (ValueError, TypeError):
                                        logger.error(f"❌ Invalid media ID format: {featured_media_id}")
                                        featured_media_id = None
                                
                                if featured_media_id:
                                    logger.info(f"✅ Featured image uploaded successfully. Media ID: {featured_media_id} (type: {type(featured_media_id).__name__})")
                                    # Log the full media response for debugging
                                    logger.debug(f"Media upload response: {media_data}")
                                else:
                                    logger.error(f"❌ Media ID not found in response: {media_data}")
                            elif media_response.status_code == 401:
                                logger.warning(f"⚠️ WordPress authentication failed for media upload. Status: {media_response.status_code}. Post will be published without featured image.")
                                # Continue without image - don't block publishing
                            else:
                                error_text = media_response.text[:500] if media_response.text else "No error message"
                                logger.warning(f"⚠️ Failed to upload featured image. Status: {media_response.status_code}, Response: {error_text}. Post will be published without featured image.")
                                # Continue without image - don't block publishing
                    else:
                        logger.warning(f"⚠️ Failed to download featured image from URL. Status: {image_response.status_code}, URL: {featured_image_url}. Post will be published without featured image.")
                        # Continue without image - don't block publishing
                except HTTPException:
                    # Re-raise HTTP exceptions (these are critical errors)
                    raise
                except Exception as img_error:
                    logger.warning(f"⚠️ Error uploading featured image to WordPress: {str(img_error)}. Post will be published without featured image.")
                    import traceback
                    logger.warning(f"Traceback: {traceback.format_exc()}")
                    # Continue without image - don't block publishing
            
            # Prepare post data for REST API
            # Use clean content without appending metadata to the content body
            # WordPress will handle categories and tags separately via the API
            # This ensures the content displays properly without HTML structure showing as text
            
            # Add featured image directly to content HTML if available (simpler and more reliable approach)
            # This ensures the image always shows in the blog post content, regardless of WordPress theme settings
            content_with_image = wordpress_data['content']
            if featured_image_url:
                # Escape the title for HTML attribute
                import html
                escaped_title = html.escape(wordpress_data["title"])
                
                # Add featured image at the beginning of content as a simple <img> tag
                # Using responsive styling to ensure it displays well on all devices
                image_html = f'<figure style="margin: 0 0 20px 0; width: 100%;"><img src="{featured_image_url}" alt="{escaped_title}" style="width: 100%; height: auto; max-width: 100%; display: block; border-radius: 8px;" /></figure>\n\n'
                content_with_image = image_html + content_with_image
                logger.info(f"✅ Added featured image directly to content HTML: {featured_image_url}")
                logger.info("ℹ️ Image embedded in content - will always display regardless of WordPress theme featured image settings")
            
            post_data = {
                'title': wordpress_data['title'],
                'content': content_with_image,  # HTML content with embedded image - WordPress will render it
                'excerpt': wordpress_data['excerpt'],
                'status': 'publish',
                'format': wordpress_data['format'],
                'meta': {
                    '_yoast_wpseo_metadesc': wordpress_data['meta']['description'],
                    '_yoast_wpseo_focuskw': ', '.join(wordpress_data['meta']['keywords'])
                }
            }
            
            # Add featured media ID if image was uploaded successfully
            if featured_media_id:
                # Ensure it's an integer for WordPress REST API
                post_data['featured_media'] = int(featured_media_id)
                logger.info(f"✅ Setting featured media ID: {int(featured_media_id)} (as integer) for WordPress post")
            else:
                if featured_image_url:
                    logger.warning(f"⚠️ Featured image URL exists ({featured_image_url}) but upload failed. Post will be published without featured image.")
                else:
                    logger.info("ℹ️ No featured image URL found. Post will be published without featured image.")
            
            # Handle categories and tags - WordPress REST API expects integer IDs
            # For now, we'll skip categories and tags to avoid the type error
            # In a production system, you'd want to:
            # 1. Create categories/tags in WordPress first
            # 2. Get their IDs
            # 3. Use those IDs here
            # 
            # For now, we'll include them in the content or meta instead
            if wordpress_data['categories']:
                # Add categories as meta data instead of direct categories
                post_data['meta']['_blog_categories'] = ', '.join(wordpress_data['categories'])
            if wordpress_data['tags']:
                # Add tags as meta data instead of direct tags
                post_data['meta']['_blog_tags'] = ', '.join(wordpress_data['tags'])
            
            # Log content preview for debugging
            content_preview = post_data['content'][:500] if len(post_data['content']) > 500 else post_data['content']
            logger.info(f"Publishing post with content preview (first 500 chars): {content_preview}")
            logger.info(f"Content contains HTML tags: {'<' in post_data['content'] and '>' in post_data['content']}")
            
            # Publish the post using REST API
            # WordPress REST API expects HTML in the 'content' field and will render it automatically
            response = session.post(
                rest_api_url,
                json=post_data,  # JSON encoding will properly handle HTML content
                auth=HTTPBasicAuth(wordpress_site['wordpress_username'], app_password),
                headers={
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',  # Important: This tells WordPress to expect JSON with HTML content
                    'User-Agent': 'Agent-Emily/1.0'
                },
                timeout=30,
                allow_redirects=False  # Prevent redirects that might cause cookie issues
            )
            
            if response.status_code == 201:
                wordpress_post_id = response.json()['id']
                logger.info(f"Blog published to WordPress via REST API: Post ID {wordpress_post_id}")
                
                # Ensure featured image is set - always update post to set featured image
                # WordPress sometimes doesn't set featured_media during POST, so we explicitly update it
                if featured_media_id:
                    try:
                        logger.info(f"Setting featured image {featured_media_id} for post {wordpress_post_id} via PUT request")
                        update_response = session.put(
                            f"{wordpress_site['wordpress_site_url'].rstrip('/')}/wp-json/wp/v2/posts/{wordpress_post_id}",
                            json={'featured_media': int(featured_media_id)},
                            auth=HTTPBasicAuth(wordpress_site['wordpress_username'], app_password),
                            headers={
                                'Accept': 'application/json',
                                'Content-Type': 'application/json',
                                'User-Agent': 'Agent-Emily/1.0'
                            },
                            timeout=30,
                            allow_redirects=False
                        )
                        
                        if update_response.status_code == 200:
                            updated_post = update_response.json()
                            verified_featured_media = updated_post.get('featured_media', 0)
                            
                            # Also check the featured_media object if available
                            featured_media_obj = updated_post.get('_links', {}).get('wp:featuredmedia', [])
                            
                            if verified_featured_media == int(featured_media_id):
                                logger.info(f"✅ Successfully set featured image {featured_media_id} for post {wordpress_post_id}")
                                
                                # Also set via meta field as fallback (some themes use this)
                                try:
                                    meta_update_response = session.put(
                                        f"{wordpress_site['wordpress_site_url'].rstrip('/')}/wp-json/wp/v2/posts/{wordpress_post_id}",
                                        json={'meta': {'_thumbnail_id': int(featured_media_id)}},
                                        auth=HTTPBasicAuth(wordpress_site['wordpress_username'], app_password),
                                        headers={
                                            'Accept': 'application/json',
                                            'Content-Type': 'application/json',
                                            'User-Agent': 'Agent-Emily/1.0'
                                        },
                                        timeout=30,
                                        allow_redirects=False
                                    )
                                    if meta_update_response.status_code == 200:
                                        logger.info(f"✅ Also set _thumbnail_id meta field for post {wordpress_post_id}")
                                except Exception as meta_error:
                                    logger.warning(f"⚠️ Could not set _thumbnail_id meta: {str(meta_error)}")
                                
                                # Verify the media exists and is accessible
                                try:
                                    media_check_response = session.get(
                                        f"{wordpress_site['wordpress_site_url'].rstrip('/')}/wp-json/wp/v2/media/{featured_media_id}",
                                        auth=HTTPBasicAuth(wordpress_site['wordpress_username'], app_password),
                                        timeout=30
                                    )
                                    if media_check_response.status_code == 200:
                                        media_info = media_check_response.json()
                                        media_url = media_info.get('source_url') or media_info.get('guid', {}).get('rendered', '')
                                        logger.info(f"✅ Verified media exists. Media URL: {media_url}")
                                    else:
                                        logger.warning(f"⚠️ Could not verify media {featured_media_id}. Status: {media_check_response.status_code}")
                                except Exception as verify_error:
                                    logger.warning(f"⚠️ Error verifying media: {str(verify_error)}")
                            else:
                                logger.warning(f"⚠️ Featured image update returned different ID. Expected: {featured_media_id}, Got: {verified_featured_media}")
                        else:
                            error_response = update_response.text[:500] if update_response.text else "No error message"
                            logger.warning(f"⚠️ Failed to update featured image for post {wordpress_post_id}. Status: {update_response.status_code}, Response: {error_response}")
                    except Exception as update_error:
                        logger.warning(f"⚠️ Error updating featured image for post: {str(update_error)}")
                        # Don't fail the whole publish if update fails
            elif response.status_code == 401:
                # Check if it's a cookie-related issue
                if 'Set-Cookie' in response.headers:
                    logger.warning(f"WordPress returned cookies in 401 response: {response.headers.get('Set-Cookie', 'None')}")
                
                raise HTTPException(
                    status_code=400,
                    detail="WordPress authentication failed. Please check your username and app password. Make sure you're using an Application Password, not your regular WordPress password."
                )
            elif response.status_code == 403:
                raise HTTPException(
                    status_code=400,
                    detail="WordPress REST API access denied. Please ensure your user has proper permissions."
                )
            else:
                raise HTTPException(
                    status_code=400,
                    detail=f"WordPress REST API returned status {response.status_code}. Error: {response.text}"
                )
            
        except requests.exceptions.RequestException as e:
            logger.error(f"WordPress REST API publishing failed: {e}")
            raise HTTPException(
                status_code=400, 
                detail=f"Failed to publish to WordPress via REST API. Error: {str(e)}"
            )
        except Exception as e:
            logger.error(f"WordPress REST API publishing failed: {e}")
            raise HTTPException(
                status_code=400, 
                detail=f"Failed to publish to WordPress via REST API. Error: {str(e)}"
            )
        
        # Get the published post details to get the proper permalink
        try:
            # Try to get the post details to extract the permalink
            post_response = requests.get(
                f"{wordpress_site['wordpress_site_url'].rstrip('/')}/wp-json/wp/v2/posts/{wordpress_post_id}",
                auth=(wordpress_site['wordpress_username'], app_password),
                timeout=30
            )
            
            if post_response.status_code == 200:
                post_data = post_response.json()
                blog_url = post_data.get('link', f"{wordpress_site['wordpress_site_url'].rstrip('/')}/?p={wordpress_post_id}")
                
                # Verify featured image is set in final post
                final_featured_media = post_data.get('featured_media', 0)
                if featured_media_id and final_featured_media != int(featured_media_id):
                    logger.warning(f"⚠️ Final verification: Featured image ID mismatch. Expected: {featured_media_id}, Found in post: {final_featured_media}")
            else:
                # Fallback to post ID format
                blog_url = f"{wordpress_site['wordpress_site_url'].rstrip('/')}/?p={wordpress_post_id}"
        except Exception as e:
            logger.warning(f"Could not fetch post permalink, using fallback: {e}")
            # Fallback to post ID format
            blog_url = f"{wordpress_site['wordpress_site_url'].rstrip('/')}/?p={wordpress_post_id}"
        
        # Update blog with WordPress post ID and blog URL
        update_data = {
            "status": "published",
            "published_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat(),
            "wordpress_post_id": wordpress_post_id,
            "blog_url": blog_url
        }
        
        supabase_admin.table("blog_posts").update(update_data).eq("id", blog_id).execute()
        
        logger.info(f"Blog published to WordPress: {blog_id} -> Post ID: {wordpress_post_id}")
        
        # Prepare response message
        # Image is now embedded directly in content HTML (simpler approach)
        image_status = "embedded" if featured_image_url else "none"
        message = "Blog published successfully"
        troubleshooting_note = None
        
        if featured_image_url:
            message += " with featured image embedded in content"
            # Image is now in the HTML content, so it will always show
            troubleshooting_note = "Featured image has been embedded directly in the blog post content and will always display."
        elif featured_media_id:
            # Fallback: if we uploaded to Media Library but no URL, still note it
            image_status = "attached"
            message += " with featured image (uploaded to Media Library)"
        
        return {
            "message": message, 
            "blog_id": blog_id,
            "wordpress_post_id": str(wordpress_post_id),
            "wordpress_url": f"{wordpress_site['wordpress_site_url'].rstrip('/')}/?p={wordpress_post_id}",
            "blog_url": blog_url,
            "image_status": image_status,
            "featured_media_id": str(featured_media_id) if featured_media_id else None,
            "troubleshooting_note": troubleshooting_note
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error publishing blog: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to publish blog: {str(e)}")

class GenerateTagsCategoriesRequest(BaseModel):
    content: str
    title: Optional[str] = None

class CheckRelevanceRequest(BaseModel):
    content: str
    title: Optional[str] = None
    existing_categories: List[str] = []
    existing_tags: List[str] = []

@router.post("/generate-tags-categories")
async def generate_tags_categories(
    request: GenerateTagsCategoriesRequest,
    current_user: User = Depends(get_current_user)
):
    """Generate tags and categories from blog content using AI"""
    try:
        # Check if OpenAI API key is available
        openai_api_key = os.getenv("OPENAI_API_KEY")
        if not openai_api_key:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="OpenAI API key not configured"
            )
        
        # Create OpenAI client
        client = openai.OpenAI(api_key=openai_api_key)
        
        # Validate content
        if not request.content or not request.content.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Content is required to generate tags and categories"
            )
        
        # Strip HTML tags from content for better analysis
        import re
        text_content = re.sub(r'<[^>]+>', '', request.content)
        text_content = text_content.strip()
        
        # Check if content is too short
        if len(text_content) < 50:
            logger.warning(f"Content is very short: {len(text_content)} characters")
        
        # Limit content length for API efficiency
        if len(text_content) > 3000:
            text_content = text_content[:3000]
            logger.info(f"Content truncated to 3000 characters")
        
        # Create the prompt
        prompt = f"""Analyze the following blog content and generate relevant tags and categories.

Title: {request.title if request.title else 'Not provided'}

Content:
{text_content}

Based on the content above, generate:
1. Categories (2-3): Broad topic categories that best describe the main themes
2. Tags (5-8): Specific keywords and topics that are relevant to the content

Return your response as a valid JSON object with this exact structure:
{{
    "categories": ["Category1", "Category2", "Category3"],
    "tags": ["tag1", "tag2", "tag3", "tag4", "tag5", "tag6"]
}}

Requirements:
- Categories should be broad, general topics (e.g., "Technology", "Business", "Health")
- Tags should be specific keywords related to the content
- All items should be relevant to the actual content
- Use title case for categories
- Use lowercase for tags (unless they are proper nouns)
- Return only valid JSON, no additional text or explanations"""

        logger.info(f"Generating tags and categories for content length: {len(text_content)}")
        
        # Call OpenAI
        try:
            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": "You are an expert content analyst. Always return valid JSON only, no additional text."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.7,
                max_tokens=500
            )
            
            result_text = response.choices[0].message.content.strip()
            logger.info(f"OpenAI response received, length: {len(result_text)}")
            
            # Track token usage (non-blocking)
            try:
                from services.token_usage_service import TokenUsageService
                supabase_service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY")
                if supabase_url and supabase_service_key:
                    token_tracker = TokenUsageService(supabase_url, supabase_service_key)
                    import asyncio
                    asyncio.create_task(
                        token_tracker.track_chat_completion_usage(
                            user_id=current_user.id,
                            feature_type="blog_generation",
                            model_name="gpt-4o-mini",
                            response=response,
                            request_metadata={"action": "generate_tags_categories"}
                        )
                    )
            except Exception as e:
                logger.error(f"Error tracking token usage: {str(e)}")
            
        except Exception as openai_error:
            logger.error(f"OpenAI API error: {str(openai_error)}")
            raise HTTPException(
                status_code=500,
                detail=f"OpenAI API error: {str(openai_error)}"
            )
        
        # Remove markdown code blocks if present
        if result_text.startswith("```json"):
            lines = result_text.split("\n")
            result_text = "\n".join(lines[1:-1]) if len(lines) > 2 else result_text
        elif result_text.startswith("```"):
            lines = result_text.split("\n")
            result_text = "\n".join(lines[1:-1]) if len(lines) > 2 else result_text
        
        # Clean up the result text
        result_text = result_text.strip()
        
        # Parse JSON response
        try:
            result = json.loads(result_text)
            logger.info(f"Successfully parsed JSON: categories={len(result.get('categories', []))}, tags={len(result.get('tags', []))}")
            
            # Validate and clean the response
            categories = result.get("categories", [])
            tags = result.get("tags", [])
            
            # Ensure they are lists
            if not isinstance(categories, list):
                logger.warning(f"Categories is not a list: {type(categories)}")
                categories = []
            if not isinstance(tags, list):
                logger.warning(f"Tags is not a list: {type(tags)}")
                tags = []
            
            # Convert all to strings and clean
            categories = [str(c).strip() for c in categories if c]
            tags = [str(t).strip() for t in tags if t]
            
            # Limit counts
            categories = categories[:3]
            tags = tags[:8]
            
            logger.info(f"Returning: categories={categories}, tags={tags}")
            
            return {
                "success": True,
                "categories": categories,
                "tags": tags
            }
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse AI response as JSON. Error: {str(e)}")
            logger.error(f"Response text: {result_text[:500]}")
            raise HTTPException(
                status_code=500,
                detail=f"Failed to parse AI response. Error: {str(e)}"
            )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating tags and categories: {e}")
        import traceback
        logger.error(f"Full traceback: {traceback.format_exc()}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate tags and categories: {str(e)}"
        )

@router.post("/check-tags-categories-relevance")
async def check_tags_categories_relevance(
    request: CheckRelevanceRequest,
    current_user: User = Depends(get_current_user)
):
    """Check if existing tags and categories are still relevant to the content using AI"""
    try:
        # Check if OpenAI API key is available
        openai_api_key = os.getenv("OPENAI_API_KEY")
        if not openai_api_key:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="OpenAI API key not configured"
            )
        
        # Validate input
        if not request.content or not request.content.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Content is required to check relevance"
            )
        
        if not request.existing_categories and not request.existing_tags:
            # No existing tags/categories, so they're not relevant (need to generate new ones)
            return {
                "success": True,
                "relevant": False,
                "categories_relevant": [],
                "tags_relevant": [],
                "categories_irrelevant": [],
                "tags_irrelevant": [],
                "should_update": True
            }
        
        # Create OpenAI client
        client = openai.OpenAI(api_key=openai_api_key)
        
        # Strip HTML tags from content
        import re
        text_content = re.sub(r'<[^>]+>', '', request.content)
        text_content = text_content.strip()
        
        # Limit content length
        if len(text_content) > 3000:
            text_content = text_content[:3000]
        
        # Prepare existing tags/categories for analysis
        categories_str = ', '.join(request.existing_categories) if request.existing_categories else 'None'
        tags_str = ', '.join(request.existing_tags) if request.existing_tags else 'None'
        
        # Create the prompt
        prompt = f"""Analyze the following blog content and determine if the existing tags and categories are still relevant.

Title: {request.title if request.title else 'Not provided'}

Content:
{text_content}

Existing Categories: {categories_str}
Existing Tags: {tags_str}

Your task:
1. Determine which categories are still relevant to the new content
2. Determine which tags are still relevant to the new content
3. Calculate the percentage of relevant items

Return your response as a valid JSON object with this exact structure:
{{
    "categories_relevant": ["Category1", "Category2"],
    "categories_irrelevant": ["Category3"],
    "tags_relevant": ["tag1", "tag2", "tag3"],
    "tags_irrelevant": ["tag4", "tag5"],
    "relevance_percentage": 60
}}

Requirements:
- A category/tag is relevant if it still accurately describes or relates to the content
- A category/tag is irrelevant if it no longer matches the content's main themes or topics
- Calculate relevance_percentage as: (relevant_items / total_items) * 100
- Return only valid JSON, no additional text or explanations"""

        logger.info(f"Checking relevance for {len(request.existing_categories)} categories and {len(request.existing_tags)} tags")
        
        # Call OpenAI
        try:
            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": "You are an expert content analyst. Always return valid JSON only, no additional text."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.3,  # Lower temperature for more consistent relevance checking
                max_tokens=500
            )
            
            result_text = response.choices[0].message.content.strip()
            logger.info(f"OpenAI relevance check response received")
            
            # Track token usage (non-blocking)
            try:
                from services.token_usage_service import TokenUsageService
                supabase_service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY")
                if supabase_url and supabase_service_key:
                    token_tracker = TokenUsageService(supabase_url, supabase_service_key)
                    import asyncio
                    asyncio.create_task(
                        token_tracker.track_chat_completion_usage(
                            user_id=current_user.id,
                            feature_type="blog_generation",
                            model_name="gpt-4o-mini",
                            response=response,
                            request_metadata={"action": "check_tags_categories_relevance"}
                        )
                    )
            except Exception as e:
                logger.error(f"Error tracking token usage: {str(e)}")
            
        except Exception as openai_error:
            logger.error(f"OpenAI API error: {str(openai_error)}")
            raise HTTPException(
                status_code=500,
                detail=f"OpenAI API error: {str(openai_error)}"
            )
        
        # Remove markdown code blocks if present
        if result_text.startswith("```json"):
            lines = result_text.split("\n")
            result_text = "\n".join(lines[1:-1]) if len(lines) > 2 else result_text
        elif result_text.startswith("```"):
            lines = result_text.split("\n")
            result_text = "\n".join(lines[1:-1]) if len(lines) > 2 else result_text
        
        result_text = result_text.strip()
        
        # Parse JSON response
        try:
            result = json.loads(result_text)
            
            categories_relevant = result.get("categories_relevant", [])
            categories_irrelevant = result.get("categories_irrelevant", [])
            tags_relevant = result.get("tags_relevant", [])
            tags_irrelevant = result.get("tags_irrelevant", [])
            relevance_percentage = result.get("relevance_percentage", 0)
            
            # Ensure they are lists
            if not isinstance(categories_relevant, list):
                categories_relevant = []
            if not isinstance(categories_irrelevant, list):
                categories_irrelevant = []
            if not isinstance(tags_relevant, list):
                tags_relevant = []
            if not isinstance(tags_irrelevant, list):
                tags_irrelevant = []
            
            # Determine if we should update (if majority >50% are irrelevant)
            should_update = relevance_percentage < 50
            
            logger.info(f"Relevance check: {relevance_percentage}% relevant, should_update: {should_update}")
            
            return {
                "success": True,
                "relevant": relevance_percentage >= 50,
                "categories_relevant": categories_relevant,
                "tags_relevant": tags_relevant,
                "categories_irrelevant": categories_irrelevant,
                "tags_irrelevant": tags_irrelevant,
                "relevance_percentage": relevance_percentage,
                "should_update": should_update
            }
            
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse AI response as JSON. Error: {str(e)}")
            logger.error(f"Response text: {result_text[:500]}")
            # If parsing fails, assume we should update (safer default)
            return {
                "success": True,
                "relevant": False,
                "categories_relevant": [],
                "tags_relevant": [],
                "categories_irrelevant": request.existing_categories,
                "tags_irrelevant": request.existing_tags,
                "should_update": True
            }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error checking relevance: {e}")
        import traceback
        logger.error(f"Full traceback: {traceback.format_exc()}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to check relevance: {str(e)}"
        )

class GenerateFromTitleRequest(BaseModel):
    title: str
    existing_content: Optional[str] = None
    existing_excerpt: Optional[str] = None

class AIEditBlogRequest(BaseModel):
    content: str
    instruction: str
    edit_type: str  # 'title', 'content', or 'excerpt'

@router.post("/ai/edit")
async def ai_edit_blog(
    request: AIEditBlogRequest,
    current_user: User = Depends(get_current_user)
):
    """Edit blog content using AI while preserving HTML structure"""
    try:
        # Check if OpenAI API key is available
        openai_api_key = os.getenv("OPENAI_API_KEY")
        if not openai_api_key:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="OpenAI API key not configured"
            )
        
        # Create OpenAI client
        client = openai.OpenAI(api_key=openai_api_key)
        
        # Determine if content is HTML or plain text
        has_html_tags = bool(re.search(r'<[a-z][a-z0-9]*[^>]*>', request.content, re.IGNORECASE))
        
        # Create the edit prompt based on content type
        if request.edit_type == 'title':
            # For titles, no HTML needed
            edit_prompt = f"""You are an expert content editor. Edit the following title based on the user's instructions.

ORIGINAL TITLE:
{request.content}

USER INSTRUCTIONS:
{request.instruction}

REQUIREMENTS:
- Follow the user's instructions precisely
- Keep it concise and engaging
- Return only the edited title, nothing else

Return the edited title:"""
            
            system_message = "You are an expert content editor. Always return only the edited title without any explanations or additional text."
        elif request.edit_type == 'excerpt':
            # For excerpts, plain text
            edit_prompt = f"""You are an expert content editor. Edit the following excerpt based on the user's instructions.

ORIGINAL EXCERPT:
{request.content}

USER INSTRUCTIONS:
{request.instruction}

REQUIREMENTS:
- Follow the user's instructions precisely
- Keep it concise (150-200 characters ideal)
- Return only the edited excerpt, nothing else

Return the edited excerpt:"""
            
            system_message = "You are an expert content editor. Always return only the edited excerpt without any explanations or additional text."
        else:
            # For content, preserve HTML structure
            if has_html_tags:
                # Content has HTML - preserve structure
                edit_prompt = f"""You are an expert blog content editor. Edit the following HTML content based on the user's instructions while preserving the HTML structure.

ORIGINAL CONTENT (HTML):
{request.content}

USER INSTRUCTIONS:
{request.instruction}

CRITICAL REQUIREMENTS:
- Follow the user's instructions precisely
- PRESERVE ALL HTML TAGS AND STRUCTURE (h1, h2, h3, p, ul, li, etc.)
- Maintain proper HTML formatting throughout
- Keep the same semantic structure unless specifically requested to change it
- Ensure the edited content is clear, engaging, and professional
- Do not add any information that wasn't in the original or requested by the user
- Return the edited content with proper HTML structure, nothing else
- Use proper HTML tags: <h2> for main sections, <h3> for subsections, <p> for paragraphs, <ul>/<li> for lists

Return the edited HTML content:"""
                
                system_message = "You are an expert blog content editor specializing in HTML-formatted content. Always preserve HTML structure and return only the edited HTML content without any explanations or additional text."
            else:
                # Plain text content - convert to HTML
                edit_prompt = f"""You are an expert blog content editor. Edit the following content based on the user's instructions and return it in proper HTML format.

ORIGINAL CONTENT:
{request.content}

USER INSTRUCTIONS:
{request.instruction}

CRITICAL REQUIREMENTS:
- Follow the user's instructions precisely
- Return the edited content in clean, professional HTML format
- Use proper HTML tags: <h2> for main sections, <h3> for subsections, <p> for paragraphs, <ul>/<li> for lists
- Structure the content with clear sections using proper HTML headings
- Each section should have a clear purpose and flow logically
- Use proper paragraph tags (<p>) for body text
- Ensure the edited content is clear, engaging, and professional
- Do not add any information that wasn't in the original or requested by the user
- Return only the edited HTML content, nothing else

Return the edited HTML content:"""
                
                system_message = "You are an expert blog content editor. Always return edited content in proper HTML format with proper structure (h2, h3, p tags, lists) without any explanations or additional text."
        
        # Call OpenAI to edit the content
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_message},
                {"role": "user", "content": edit_prompt}
            ],
            temperature=0.7,
            max_tokens=4000
        )
        
        edited_content = response.choices[0].message.content.strip()
        
        # Remove any markdown code blocks if present
        if edited_content.startswith("```html"):
            edited_content = edited_content.split("```html")[1].split("```")[0].strip()
        elif edited_content.startswith("```"):
            edited_content = edited_content.split("```")[1].split("```")[0].strip()
        
        # Track token usage (non-blocking)
        try:
            from services.token_usage_service import TokenUsageService
            supabase_url = os.getenv("SUPABASE_URL")
            supabase_service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY")
            if supabase_url and supabase_service_key:
                token_tracker = TokenUsageService(supabase_url, supabase_service_key)
                import asyncio
                # Track usage asynchronously
                asyncio.create_task(
                    token_tracker.track_chat_completion_usage(
                        user_id=current_user.id,
                        feature_type="content_ai_edit",
                        model_name="gpt-4o-mini",
                        response=response,
                        request_metadata={
                            "edit_type": request.edit_type,
                            "has_html": has_html_tags
                        }
                    )
                )
        except Exception as e:
            # Log error but don't break the edit functionality
            logger.error(f"Error tracking blog AI edit token usage: {str(e)}")
        
        return {
            "success": True,
            "edited_content": edited_content
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error editing blog with AI: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to edit blog with AI: {str(e)}"
        )

@router.post("/generate-from-title")
async def generate_from_title(
    request: GenerateFromTitleRequest,
    current_user: User = Depends(get_current_user)
):
    """Generate blog content, excerpt, categories, and tags based on title"""
    try:
        # Check if OpenAI API key is available
        openai_api_key = os.getenv("OPENAI_API_KEY")
        if not openai_api_key:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="OpenAI API key not configured"
            )
        
        # Validate input
        if not request.title or not request.title.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Title is required"
            )
        
        # Create OpenAI client
        client = openai.OpenAI(api_key=openai_api_key)
        
        # Strip HTML from existing content if provided
        import re
        existing_content_text = ''
        if request.existing_content:
            existing_content_text = re.sub(r'<[^>]+>', '', request.existing_content)
            existing_content_text = existing_content_text.strip()
        
        # Create the prompt
        prompt = f"""Based on the following blog title, generate comprehensive blog content, excerpt, categories, and tags.

Title: {request.title}

{f"Existing Content (for reference, but generate new content based on title): {existing_content_text[:500]}" if existing_content_text else ""}

Your task:
1. Generate comprehensive blog content (800-1500 words) that matches the title
2. Create a compelling excerpt (150-160 characters) that summarizes the content
3. Suggest 2-3 relevant categories that match the title and content
4. Suggest 5-8 relevant tags that are specific to the content

CRITICAL STRUCTURE REQUIREMENTS:
- Write in clean, professional HTML format with proper semantic structure
- Structure the content with clear sections using proper HTML headings (h2, h3)
- Each section should have a clear purpose and flow logically
- Use proper paragraph tags (<p>) for body text
- Create well-organized sections that can be displayed in a structured layout
- Avoid redundant titles or headings - the title is already set, focus on content sections
- Include sections like:
  * Introduction paragraph (hook the reader)
  * Main content sections with subheadings
  * Key points or benefits (use lists where appropriate)
  * Conclusion that ties everything together
- Make sections scannable and easy to read
- Use proper HTML formatting: <h2> for main sections, <h3> for subsections, <p> for paragraphs, <ul>/<li> for lists

Return your response as a valid JSON object with this exact structure:
{{
    "content": "<h2>Introduction</h2><p>Full blog content with proper HTML formatting...</p><h2>Main Section</h2><p>More content...</p>",
    "excerpt": "Brief description of the blog post...",
    "categories": ["Category1", "Category2", "Category3"],
    "tags": ["tag1", "tag2", "tag3", "tag4", "tag5", "tag6"]
}}

Requirements:
- Content must be comprehensive, well-structured, and match the title
- Use proper HTML formatting (h2, h3, p, strong, ul, li tags) - DO NOT use h1 (title is separate)
- Excerpt should be engaging and 150-160 characters (plain text, no HTML)
- Categories should be broad, general topics
- Tags should be specific keywords
- All content should be relevant to the title
- Return only valid JSON, no additional text or explanations"""

        logger.info(f"Generating blog content from title: {request.title}")
        
        # Call OpenAI
        try:
            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": "You are an expert blog writer. Always return valid JSON only, no additional text."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.7,
                max_tokens=3000
            )
            
            result_text = response.choices[0].message.content.strip()
            logger.info(f"OpenAI response received for title-based generation")
            
            # Track token usage (non-blocking)
            try:
                from services.token_usage_service import TokenUsageService
                supabase_service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY")
                if supabase_url and supabase_service_key:
                    token_tracker = TokenUsageService(supabase_url, supabase_service_key)
                    import asyncio
                    asyncio.create_task(
                        token_tracker.track_chat_completion_usage(
                            user_id=current_user.id,
                            feature_type="blog_generation",
                            model_name="gpt-4o-mini",
                            response=response,
                            request_metadata={"action": "generate_from_title", "title": request.title[:100] if request.title else None}
                        )
                    )
            except Exception as e:
                logger.error(f"Error tracking token usage: {str(e)}")
            
        except Exception as openai_error:
            logger.error(f"OpenAI API error: {str(openai_error)}")
            raise HTTPException(
                status_code=500,
                detail=f"OpenAI API error: {str(openai_error)}"
            )
        
        # Remove markdown code blocks if present
        if result_text.startswith("```json"):
            lines = result_text.split("\n")
            result_text = "\n".join(lines[1:-1]) if len(lines) > 2 else result_text
        elif result_text.startswith("```"):
            lines = result_text.split("\n")
            result_text = "\n".join(lines[1:-1]) if len(lines) > 2 else result_text
        
        result_text = result_text.strip()
        
        # Parse JSON response
        try:
            result = json.loads(result_text)
            
            content = result.get("content", "")
            excerpt = result.get("excerpt", "")
            categories = result.get("categories", [])
            tags = result.get("tags", [])
            
            # Ensure they are the correct types
            if not isinstance(categories, list):
                categories = []
            if not isinstance(tags, list):
                tags = []
            
            # Limit counts
            categories = categories[:3]
            tags = tags[:8]
            
            # Clean and validate
            categories = [str(c).strip() for c in categories if c]
            tags = [str(t).strip() for t in tags if t]
            
            logger.info(f"Successfully generated content from title: {len(content)} chars, {len(categories)} categories, {len(tags)} tags")
            
            return {
                "success": True,
                "content": content,
                "excerpt": excerpt,
                "categories": categories,
                "tags": tags
            }
            
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse AI response as JSON. Error: {str(e)}")
            logger.error(f"Response text: {result_text[:500]}")
            raise HTTPException(
                status_code=500,
                detail=f"Failed to parse AI response. Error: {str(e)}"
            )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating from title: {e}")
        import traceback
        logger.error(f"Full traceback: {traceback.format_exc()}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate from title: {str(e)}"
        )


