#!/usr/bin/env python3
"""CLI helper to fetch Facebook/Instagram insights and persist analytics_snapshots."""

import argparse
import logging
import os
import sys
from typing import Optional

from dotenv import load_dotenv

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.dirname(SCRIPT_DIR)
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

load_dotenv()

from routers.connections import (
    decrypt_token,
    record_platform_metrics,
    supabase_admin,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
)
logger = logging.getLogger(__name__)

SUPPORTED_PLATFORMS = {"facebook", "instagram"}


def resolve_user_id(user_id: Optional[str], email: Optional[str]) -> Optional[str]:
    if user_id:
        return user_id

    if not email:
        return None

    response = supabase_admin.table("auth.users").select("id").eq("email", email).limit(1).execute()
    if not response.data:
        return None

    return response.data[0].get("id")


def select_connection(user_id: str, platform: str, page_hint: Optional[str]) -> Optional[dict]:
    query = (
        supabase_admin.table("platform_connections")
        .select("*")
        .eq("user_id", user_id)
        .eq("platform", platform)
        .eq("is_active", True)
        .order("updated_at", desc=True)
        .limit(10)
    )
    result = query.execute()
    connections = result.data or []
    if not connections:
        return None

    if page_hint:
        for connection in connections:
            if page_hint in (
                connection.get("page_id"),
                connection.get("instagram_id"),
            ):
                return connection

    return connections[0]


def main():
    parser = argparse.ArgumentParser(description="Fetch insights for a platform connection.")
    parser.add_argument("--user-id", help="Supabase user ID")
    parser.add_argument("--email", help="Supabase user email")
    parser.add_argument(
        "--platform",
        required=True,
        choices=sorted(SUPPORTED_PLATFORMS),
        help="Platform to fetch metrics for (facebook or instagram)",
    )
    parser.add_argument(
        "--page-id",
        help="Optional page or instagram ID to narrow the connection",
    )

    args = parser.parse_args()

    if not args.user_id and not args.email:
        parser.error("either --user-id or --email must be provided")

    user_id = resolve_user_id(args.user_id, args.email)
    if not user_id:
        logger.error("Could not resolve user id for email=%s or id=%s", args.email, args.user_id)
        sys.exit(1)

    platform = args.platform.lower()
    if platform not in SUPPORTED_PLATFORMS:
        logger.error("Unsupported platform: %s", platform)
        sys.exit(1)

    connection = select_connection(user_id, platform, args.page_id)
    if not connection:
        logger.error("No active %s connection found for user %s", platform, user_id)
        sys.exit(1)

    access_token_encrypted = (
        connection.get("access_token_encrypted") or connection.get("access_token")
    )
    if not access_token_encrypted:
        logger.error("Connection %s is missing an access token", connection.get("id"))
        sys.exit(1)

    try:
        access_token = decrypt_token(access_token_encrypted)
    except Exception as exc:
        logger.error("Failed to decrypt access token: %s", exc)
        sys.exit(1)

    page_id = args.page_id or connection.get("page_id") or connection.get("instagram_id")
    if not page_id:
        logger.error("Connection %s lacks a page_id or instagram_id", connection.get("id"))
        sys.exit(1)

    page_name = (
        connection.get("page_name")
        or connection.get("page_username")
        or connection.get("username")
        or connection.get("account_name")
        or ""
    )

    logger.info(
        "Fetching metrics for user=%s platform=%s page_id=%s",
        user_id,
        platform,
        page_id,
    )

    record_platform_metrics(
        user_id=user_id,
        platform=platform,
        page_id=page_id,
        page_name=page_name,
        access_token=access_token,
    )

    logger.info("Done.")


if __name__ == "__main__":
    main()



