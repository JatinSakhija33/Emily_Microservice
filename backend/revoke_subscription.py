"""
Script to revoke a user's subscription by email address
Usage: python revoke_subscription.py xway@prakriti.org.in
"""

import os
import sys
from datetime import datetime
from supabase import create_client
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def revoke_subscription_by_email(email: str):
    """Revoke subscription for a user by their email address"""
    try:
        # Get Supabase credentials
        supabase_url = os.getenv("SUPABASE_URL")
        supabase_service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        
        if not supabase_url or not supabase_service_key:
            print("❌ Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env file")
            return False
        
        # Initialize Supabase client with service role key (for admin access)
        supabase = create_client(supabase_url, supabase_service_key)
        
        print(f"🔍 Searching for user with email: {email}")
        
        # Find user by email using admin API
        try:
            # Try to get user by email directly
            try:
                user_response = supabase.auth.admin.get_user_by_email(email)
                if user_response and user_response.user:
                    user = user_response.user
                    user_id = user.id
                    print(f"✅ Found user: {user_id}")
                    print(f"   Email: {user.email}")
                    print(f"   Created: {user.created_at}")
                else:
                    print(f"❌ User with email {email} not found")
                    return False
            except Exception as get_error:
                # Fallback: list all users and find by email
                print(f"⚠️  Direct lookup failed, trying alternative method...")
                users_response = supabase.auth.admin.list_users()
                
                user = None
                if hasattr(users_response, 'users'):
                    for u in users_response.users:
                        if u.email and u.email.lower() == email.lower():
                            user = u
                            break
                elif isinstance(users_response, list):
                    for u in users_response:
                        if hasattr(u, 'email') and u.email and u.email.lower() == email.lower():
                            user = u
                            break
                
                if not user:
                    print(f"❌ User with email {email} not found")
                    return False
                
                user_id = user.id if hasattr(user, 'id') else user.get('id')
                print(f"✅ Found user: {user_id}")
                print(f"   Email: {user.email if hasattr(user, 'email') else user.get('email')}")
                
        except Exception as e:
            print(f"❌ Error finding user: {e}")
            import traceback
            traceback.print_exc()
            return False
        
        # Check current subscription status
        print(f"\n🔍 Checking current subscription status...")
        profile_result = supabase.table("profiles").select("subscription_status, subscription_plan, razorpay_subscription_id").eq("id", user_id).execute()
        
        if profile_result.data:
            profile = profile_result.data[0]
            current_status = profile.get("subscription_status", "unknown")
            current_plan = profile.get("subscription_plan", "unknown")
            subscription_id = profile.get("razorpay_subscription_id")
            
            print(f"   Current Status: {current_status}")
            print(f"   Current Plan: {current_plan}")
            print(f"   Razorpay Subscription ID: {subscription_id}")
        else:
            print("   No profile found - user may not have completed onboarding")
        
        # Revoke subscription
        print(f"\n🔄 Revoking subscription...")
        now = datetime.utcnow()
        
        update_data = {
            "subscription_status": "cancelled",
            "subscription_end_date": now.isoformat()
        }
        
        result = supabase.table("profiles").update(update_data).eq("id", user_id).execute()
        
        if result.data:
            print(f"✅ Subscription revoked successfully!")
            print(f"   Updated Status: cancelled")
            print(f"   End Date: {now.isoformat()}")
            
            # If there's a Razorpay subscription, you may want to cancel it there too
            if subscription_id:
                print(f"\n⚠️  Note: Razorpay subscription ID found: {subscription_id}")
                print(f"   You may want to cancel this subscription in Razorpay dashboard as well")
            
            return True
        else:
            print(f"❌ Failed to update subscription status")
            return False
            
    except Exception as e:
        print(f"❌ Error revoking subscription: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python revoke_subscription.py <email>")
        print("Example: python revoke_subscription.py xway@prakriti.org.in")
        sys.exit(1)
    
    email = sys.argv[1]
    success = revoke_subscription_by_email(email)
    sys.exit(0 if success else 1)

