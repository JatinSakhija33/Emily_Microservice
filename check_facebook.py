import sys
sys.path.append('backend')
from routers.social_media import *
import asyncio

# Mock user
user = User(id='58d91fe2-1401-46fd-b183-a2a118997fc1', email='services@atsnai.com', name='ATSN AI', created_at='2025-01-01T00:00:00Z')

async def check_facebook_permissions():
    try:
        # Get Facebook connection
        response = supabase_admin.table('platform_connections').select('*').eq('user_id', user.id).eq('platform', 'facebook').eq('is_active', True).execute()

        if response.data and len(response.data) > 0:
            fb_conn = response.data[0]
            print('=== FACEBOOK CONNECTION DETAILS ===')
            print(f'Connection ID: {fb_conn.get("id")}')
            print(f'Platform: {fb_conn.get("platform")}')
            print(f'Page ID: {fb_conn.get("page_id")}')
            print(f'Page Name: {fb_conn.get("page_name")}')
            print(f'Account Type: {fb_conn.get("account_type")}')
            print(f'Is Active: {fb_conn.get("is_active")}')
            print(f'Connected At: {fb_conn.get("connected_at")}')

            # Check what permissions might be missing
            print('\n=== FACEBOOK PERMISSIONS ANALYSIS ===')
            print('Facebook requires these permissions to read page posts:')
            print('- pages_read_engagement')
            print('- pages_read_user_content')
            print('- pages_show_list')
            print('- pages_manage_metadata (for page access token)')
            print('\nThe 403 error suggests these permissions were not granted during OAuth.')
            print('Instagram works because it has different permission requirements.')
        else:
            print('No Facebook connection found')

    except Exception as e:
        print(f'Error: {e}')

if __name__ == "__main__":
    asyncio.run(check_facebook_permissions())

