from supabase import create_client, Client
from app.config import get_settings

settings = get_settings()

def get_supabase() -> Client:
    """Anon client, NEW per call. sign_in_with_password switches a client to
    the signed-in user's token, so a shared one would carry the last user's
    session into the next request. Don't make this a singleton."""
    return create_client(
        settings.supabase_url,
        settings.supabase_anon_key
    )

# ONE service-role client for the whole process. A new client per call paid
# a fresh connection + TLS handshake to Supabase on every query (~600 ms
# each, measured 2026-10-17); this one keeps its connections open.
#
# Safe to share across requests and threadpool threads: each .table() query
# builds its own request and headers, and httpx's client is thread-safe.
# Touching .postgrest here creates it eagerly, so two threads can't race to
# create it lazily on first use. Never sign in on this client (CLAUDE.md).
_admin: Client = create_client(
    settings.supabase_url,
    settings.supabase_service_key
)
_admin.postgrest

def get_supabase_admin() -> Client:
    """Service role client — bypasses RLS. Only use server-side."""
    return _admin
