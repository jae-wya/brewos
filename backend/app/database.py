from supabase import create_client, Client
from app.config import get_settings

settings = get_settings()

def get_supabase() -> Client:
    return create_client(
        settings.supabase_url,
        settings.supabase_anon_key
    )

def get_supabase_admin() -> Client:
    """Service role client — bypasses RLS. Only use server-side."""
    return create_client(
        settings.supabase_url,
        settings.supabase_service_key
    )