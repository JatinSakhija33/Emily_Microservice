"""
Shared logic for assembling the Meta OAuth scope list.

Some scopes (for example `pages_public_metadata_access`) require App Review or
feature approval before they can be requested. The helper below lets us toggle
those additional scopes from the environment so we only request them once the
app is ready, and avoid hitting the "Invalid scope" dialog in Firefox/Chrome.
"""
from __future__ import annotations

import os
from typing import List


BASE_META_OAUTH_SCOPES: List[str] = [
    "instagram_basic",
    "pages_read_engagement",
    "instagram_content_publish",
    "pages_manage_posts",
    "read_insights",
]

OPTIONAL_META_OAUTH_SCOPES: List[str] = []


def _include_optional_scopes() -> bool:
    flag = os.getenv("FACEBOOK_ENABLE_PUBLIC_SCOPES", "").strip().lower()
    return flag in {"1", "true", "yes", "on"}


def get_meta_oauth_scopes() -> List[str]:
    """Return the Meta scope list we should request right now."""
    scopes = BASE_META_OAUTH_SCOPES.copy()

    if _include_optional_scopes():
        scopes.extend(OPTIONAL_META_OAUTH_SCOPES)

    return scopes


def get_meta_scope_string() -> str:
    """Return the comma-delimited scope string for OAuth URLs."""
    return ",".join(get_meta_oauth_scopes())


