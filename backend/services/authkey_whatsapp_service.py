import os
import re
import logging
from typing import Dict, Optional

import requests

logger = logging.getLogger(__name__)


class AuthKeyWhatsAppService:
    """
    Lightweight client for console.authkey.io WhatsApp APIs.
    Supports simple text or template-based messages for leads.
    """

    def __init__(self):
        self.authkey = os.getenv("AUTHKEY_WHATSAPP_AUTHKEY")
        if not self.authkey:
            raise ValueError("AUTHKEY_WHATSAPP_AUTHKEY is not configured")

        # Base endpoints from docs
        self.base_get_url = "https://api.authkey.io/request"
        self.base_post_url = "https://console.authkey.io/restapi/requestjson.php"

    @staticmethod
    def _extract_country_and_mobile(phone_number: str) -> Dict[str, str]:
        """
        Attempt to split an E.164-ish phone string into country_code + local number.
        Defaults country_code to '91' if we cannot infer (common for IN installs).
        """
        digits = re.sub(r"\D", "", phone_number or "")
        if not digits:
            raise ValueError("Phone number is empty or invalid")

        # If number already looks like CC + 10 digits, split last 10 as mobile
        if len(digits) > 10:
            country_code = digits[:-10]
            mobile = digits[-10:]
        else:
            country_code = os.getenv("AUTHKEY_DEFAULT_COUNTRY_CODE", "91")
            mobile = digits

        if not country_code:
            country_code = os.getenv("AUTHKEY_DEFAULT_COUNTRY_CODE", "91")

        return {"country_code": country_code, "mobile": mobile}

    def send_text(self, phone_number: str, message: str) -> Dict:
        """
        Send a plain text WhatsApp message using the simple GET API.
        """
        if not message or not message.strip():
            raise ValueError("Message is required")

        parts = self._extract_country_and_mobile(phone_number)
        params = {
            "authkey": self.authkey,
            "mobile": parts["mobile"],
            "country_code": parts["country_code"],
            "message": message.strip(),
        }

        logger.info(f"Sending AuthKey WhatsApp text to {parts['country_code']}-{parts['mobile']}")
        resp = requests.get(self.base_get_url, params=params, timeout=15)
        if not resp.ok:
            raise ValueError(f"AuthKey API error ({resp.status_code}): {resp.text}")

        data = resp.json() if resp.headers.get("content-type", "").startswith("application/json") else {"raw": resp.text}
        return {"success": True, "data": data}

    def send_template(
        self,
        phone_number: str,
        template_id: str,
        body_values: Optional[Dict[str, str]] = None,
        header_filename: Optional[str] = None,
        header_data_url: Optional[str] = None,
        template_type: str = "text",
    ) -> Dict:
        """
        Send a template message (text or media) via POST JSON API.
        """
        if not template_id:
            raise ValueError("Template ID (wid) is required for template messages")

        parts = self._extract_country_and_mobile(phone_number)

        payload: Dict[str, any] = {
            "country_code": parts["country_code"],
            "mobile": parts["mobile"],
            "wid": template_id,
            "type": template_type or "text",
        }

        if body_values:
            payload["bodyValues"] = body_values

        if template_type == "media" and header_data_url:
            payload["headerValues"] = {
                "headerFileName": header_filename or "Attachment",
                "headerData": header_data_url,
            }

        headers = {
            "Authorization": f"Basic {self.authkey}",
            "Content-Type": "application/json",
        }

        logger.info(
            f"Sending AuthKey WhatsApp template to {parts['country_code']}-{parts['mobile']} wid={template_id} type={template_type}"
        )
        resp = requests.post(self.base_post_url, json=payload, headers=headers, timeout=20)
        if not resp.ok:
            raise ValueError(f"AuthKey template API error ({resp.status_code}): {resp.text}")

        data = resp.json() if resp.headers.get("content-type", "").startswith("application/json") else {"raw": resp.text}
        return {"success": True, "data": data}
