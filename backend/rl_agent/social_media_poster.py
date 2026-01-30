"""
Social Media Poster - Handles posting to various social media platforms
"""

import os
import uuid
import time
import requests
from datetime import datetime
from dotenv import load_dotenv

# Load environment variables
load_dotenv()


class SocialMediaPoster:
    """
    Handles posting content to social media platforms
    """

    def __init__(self):
        # Platform API configurations
        self.platform_configs = {
            'instagram': {
                'api_url': 'https://graph.facebook.com/v18.0',
                'requires_image': True
            },
            'facebook': {
                'api_url': 'https://graph.facebook.com/v18.0',
                'requires_image': False
            },
            'twitter': {
                'api_url': 'https://api.twitter.com/2',
                'requires_image': False
            },
            'linkedin': {
                'api_url': 'https://api.linkedin.com/v2',
                'requires_image': False
            }
        }

    def post_to_platform(self, business_id, platform, post_id, caption, image_url=None):
        """
        Post content to a social media platform

        Args:
            business_id (str): Business identifier
            platform (str): Platform name (instagram, facebook, twitter, linkedin)
            post_id (str): Unique post identifier
            caption (str): Post caption/text
            image_url (str, optional): URL of image to post

        Returns:
            dict: {
                'success': bool,
                'media_id': str or None,
                'error': str or None
            }
        """
        try:
            print(f"🚀 Posting to {platform} for business {business_id}...")

            # Validate platform
            if platform not in self.platform_configs:
                return {
                    'success': False,
                    'error': f'Unsupported platform: {platform}'
                }

            # Check if platform credentials are configured
            token_data = self._get_platform_access_token(platform, business_id)
            if not token_data or not token_data.get('access_token'):
                return {
                    'success': False,
                    'error': f'No access token configured for {platform}. Real API credentials required for production.'
                }

            # Post to real platform
            return self._post_to_real_platform(
                platform, token_data, business_id, post_id, caption, image_url
            )

        except Exception as e:
            error_msg = f"Error posting to {platform}: {str(e)}"
            print(f"❌ {error_msg}")
            return {
                'success': False,
                'error': error_msg
            }

    def _get_platform_access_token(self, platform, business_id):
        """
        Get access token and user/page ID for platform from database
        """
        try:
            # Query platform_connections table for active connections
            from db import supabase
            res = supabase.table("platform_connections") \
                .select("access_token_encrypted, page_id, page_username") \
                .eq("user_id", business_id) \
                .eq("platform", platform) \
                .eq("is_active", True) \
                .eq("connection_status", "active") \
                .execute()

            if res.data and len(res.data) > 0:
                connection = res.data[0]
                # Decrypt the access token (assuming it's encrypted)
                # For now, assume it's stored as plain text for development
                access_token = connection.get("access_token_encrypted")
                page_id = connection.get("page_id")
                page_username = connection.get("page_username")

                return {
                    'access_token': access_token,
                    'page_id': page_id,
                    'page_username': page_username
                }

            # Fallback to environment variables for development
            env_token_key = f"{platform.upper()}_ACCESS_TOKEN"
            env_page_key = f"{platform.upper()}_PAGE_ID"
            access_token = os.getenv(env_token_key)
            page_id = os.getenv(env_page_key)

            if access_token and page_id:
                return {
                    'access_token': access_token,
                    'page_id': page_id,
                    'page_username': None
                }

            return None

        except Exception as e:
            print(f"❌ Error getting platform access token: {e}")
            return None


    def _post_to_real_platform(self, platform, token_data, business_id, post_id, caption, image_url=None):
        """
        Actually post to real social media platform APIs
        """
        try:
            if platform == 'instagram':
                return self._post_to_instagram(token_data, caption, image_url)
            elif platform == 'facebook':
                return self._post_to_facebook(token_data, caption, image_url)
            elif platform == 'twitter':
                return self._post_to_twitter(token_data, caption, image_url)
            elif platform == 'linkedin':
                return self._post_to_linkedin(token_data, caption, image_url)
            else:
                return {
                    'success': False,
                    'error': f'Real posting not implemented for {platform}'
                }
        except Exception as e:
            return {
                'success': False,
                'error': f'Real API error for {platform}: {str(e)}'
            }

    def _post_to_instagram(self, token_data, caption, image_url):
        """Post to Instagram using Graph API"""
        try:
            access_token = token_data['access_token']
            ig_user_id = token_data['page_id']

            if not ig_user_id:
                return {
                    'success': False,
                    'error': 'Instagram user ID (page_id) not found in platform connections'
                }

            # Step 1: Create media container
            media_url = f"https://graph.facebook.com/v18.0/{ig_user_id}/media"

            media_data = {
                'access_token': access_token,
                'caption': caption
            }

            # Handle image URL - check if it's a URL or base64
            if image_url and image_url.startswith('http'):
                # It's a URL
                media_data['image_url'] = image_url
            elif image_url and image_url.startswith('data:image'):
                # It's base64 data URL
                # Instagram API expects binary data, not data URLs
                # For now, we'll need to download/upload the image
                # This is a simplified version - in production you'd handle this properly
                return {
                    'success': False,
                    'error': 'Base64 image upload not implemented. Please use image URLs for Instagram posting.'
                }
            else:
                return {
                    'success': False,
                    'error': 'Valid image URL required for Instagram posting'
                }

            # Create media container
            media_response = requests.post(media_url, data=media_data)
            media_response.raise_for_status()
            media_result = media_response.json()

            creation_id = media_result.get('id')
            if not creation_id:
                return {
                    'success': False,
                    'error': f'Failed to create Instagram media container: {media_result}'
                }

            # Step 2: Publish the media container
            publish_url = f"https://graph.facebook.com/v18.0/{ig_user_id}/media_publish"
            publish_data = {
                'access_token': access_token,
                'creation_id': creation_id
            }

            publish_response = requests.post(publish_url, data=publish_data)
            publish_response.raise_for_status()
            publish_result = publish_response.json()

            media_id = publish_result.get('id')
            if not media_id:
                return {
                    'success': False,
                    'error': f'Failed to publish Instagram post: {publish_result}'
                }

            print(f"✅ Successfully posted to Instagram with media ID: {media_id}")
            return {
                'success': True,
                'media_id': media_id
            }

        except requests.exceptions.RequestException as e:
            error_msg = f"Instagram API request failed: {str(e)}"
            if hasattr(e, 'response') and e.response:
                try:
                    error_data = e.response.json()
                    error_msg += f" - {error_data.get('error', {}).get('message', 'Unknown API error')}"
                except:
                    pass
            return {
                'success': False,
                'error': error_msg
            }
        except Exception as e:
            return {
                'success': False,
                'error': f'Instagram posting error: {str(e)}'
            }

    def _post_to_facebook(self, token_data, caption, image_url):
        """Post to Facebook using Graph API"""
        try:
            access_token = token_data['access_token']
            page_id = token_data['page_id']

            if not page_id:
                return {
                    'success': False,
                    'error': 'Facebook page ID not found in platform connections'
                }

            # Facebook API endpoint for posting
            url = f"https://graph.facebook.com/v18.0/{page_id}/feed"

            post_data = {
                'access_token': access_token,
                'message': caption
            }

            # Add link if image_url is provided (Facebook can handle URLs)
            if image_url and image_url.startswith('http'):
                post_data['link'] = image_url

            # Make the API call
            response = requests.post(url, data=post_data)
            response.raise_for_status()
            result = response.json()

            post_id = result.get('id')
            if not post_id:
                return {
                    'success': False,
                    'error': f'Failed to create Facebook post: {result}'
                }

            print(f"✅ Successfully posted to Facebook with post ID: {post_id}")
            return {
                'success': True,
                'media_id': post_id
            }

        except requests.exceptions.RequestException as e:
            error_msg = f"Facebook API request failed: {str(e)}"
            if hasattr(e, 'response') and e.response:
                try:
                    error_data = e.response.json()
                    error_msg += f" - {error_data.get('error', {}).get('message', 'Unknown API error')}"
                except:
                    pass
            return {
                'success': False,
                'error': error_msg
            }
        except Exception as e:
            return {
                'success': False,
                'error': f'Facebook posting error: {str(e)}'
            }

    def _post_to_twitter(self, token_data, caption, image_url):
        """Post to Twitter/X using API v2"""
        try:
            access_token = token_data['access_token']

            # Twitter API v2 endpoint for posting tweets
            url = "https://api.twitter.com/2/tweets"

            headers = {
                'Authorization': f'Bearer {access_token}',
                'Content-Type': 'application/json'
            }

            tweet_data = {
                'text': caption
            }

            # Note: Twitter API v2 doesn't support image uploads in the same way as v1.1
            # For images, you would need to:
            # 1. Upload media using /2/media/upload endpoint
            # 2. Include media_ids in the tweet
            # This is a simplified version that only handles text tweets

            if image_url:
                print(f"⚠️ Twitter image posting not implemented yet. Posting text only.")
                # TODO: Implement Twitter media upload for images

            response = requests.post(url, headers=headers, json=tweet_data)
            response.raise_for_status()
            result = response.json()

            tweet_id = result.get('data', {}).get('id')
            if not tweet_id:
                return {
                    'success': False,
                    'error': f'Failed to create Twitter tweet: {result}'
                }

            print(f"✅ Successfully posted to Twitter with tweet ID: {tweet_id}")
            return {
                'success': True,
                'media_id': tweet_id
            }

        except requests.exceptions.RequestException as e:
            error_msg = f"Twitter API request failed: {str(e)}"
            if hasattr(e, 'response') and e.response:
                try:
                    error_data = e.response.json()
                    error_msg += f" - {error_data.get('errors', [{}])[0].get('message', 'Unknown API error')}"
                except:
                    pass
            return {
                'success': False,
                'error': error_msg
            }
        except Exception as e:
            return {
                'success': False,
                'error': f'Twitter posting error: {str(e)}'
            }

    def _post_to_linkedin(self, token_data, caption, image_url):
        """Post to LinkedIn using REST API"""
        try:
            access_token = token_data['access_token']

            # First, get the LinkedIn person URN
            profile_url = "https://api.linkedin.com/v2/people/~"
            headers = {
                'Authorization': f'Bearer {access_token}',
                'X-Restli-Protocol-Version': '2.0.0'
            }

            profile_response = requests.get(profile_url, headers=headers)
            profile_response.raise_for_status()
            profile_data = profile_response.json()

            person_urn = profile_data.get('id')
            if not person_urn:
                return {
                    'success': False,
                    'error': 'Could not retrieve LinkedIn person URN'
                }

            # Create the post
            post_url = "https://api.linkedin.com/v2/ugcPosts"

            post_data = {
                "author": f"urn:li:person:{person_urn}",
                "lifecycleState": "PUBLISHED",
                "specificContent": {
                    "com.linkedin.ugc.ShareContent": {
                        "shareCommentary": {
                            "text": caption
                        },
                        "shareMediaCategory": "NONE"
                    }
                },
                "visibility": {
                    "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"
                }
            }

            # Note: LinkedIn image posting is more complex and requires:
            # 1. Upload image to LinkedIn's asset system
            # 2. Get asset URN
            # 3. Include in post
            # This simplified version only handles text posts

            if image_url:
                print(f"⚠️ LinkedIn image posting not implemented yet. Posting text only.")
                # TODO: Implement LinkedIn media upload

            response = requests.post(post_url, headers=headers, json=post_data)
            response.raise_for_status()
            result = response.json()

            post_id = result.get('id')
            if not post_id:
                return {
                    'success': False,
                    'error': f'Failed to create LinkedIn post: {result}'
                }

            print(f"✅ Successfully posted to LinkedIn with post ID: {post_id}")
            return {
                'success': True,
                'media_id': post_id
            }

        except requests.exceptions.RequestException as e:
            error_msg = f"LinkedIn API request failed: {str(e)}"
            if hasattr(e, 'response') and e.response:
                try:
                    error_data = e.response.json()
                    error_msg += f" - {error_data.get('serviceErrorCode', 'Unknown API error')}"
                except:
                    pass
            return {
                'success': False,
                'error': error_msg
            }
        except Exception as e:
            return {
                'success': False,
                'error': f'LinkedIn posting error: {str(e)}'
            }


# Create singleton instance
poster = SocialMediaPoster()
