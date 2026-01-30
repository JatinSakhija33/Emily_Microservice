"""
API endpoints for Contact Form
Supports multiple email services: Resend, SendGrid, Mailgun, and SMTP
"""

import os
import logging
from typing import Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import httpx

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/contact", tags=["contact"])

class ContactFormRequest(BaseModel):
    name: str
    email: str  # Changed from EmailStr to str to avoid email-validator dependency
    subject: str
    message: str

async def send_via_resend(recipient_email: str, sender_email: str, subject: str, body: str, reply_to: str) -> bool:
    """Send email using Resend API"""
    try:
        api_key = os.getenv("RESEND_API_KEY")
        if not api_key:
            return False
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.resend.com/emails",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "from": sender_email,
                    "to": [recipient_email],
                    "reply_to": reply_to,
                    "subject": subject,
                    "html": body.replace("\n", "<br>"),
                    "text": body
                },
                timeout=10.0
            )
            response.raise_for_status()
            logger.info(f"Email sent via Resend: {response.json().get('id')}")
            return True
    except Exception as e:
        logger.error(f"Resend API error: {e}")
        return False

async def send_via_sendgrid(recipient_email: str, sender_email: str, subject: str, body: str, reply_to: str) -> bool:
    """Send email using SendGrid API"""
    try:
        api_key = os.getenv("SENDGRID_API_KEY")
        if not api_key:
            return False
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.sendgrid.com/v3/mail/send",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "personalizations": [{
                        "to": [{"email": recipient_email}],
                        "reply_to": {"email": reply_to}
                    }],
                    "from": {"email": sender_email},
                    "subject": subject,
                    "content": [
                        {
                            "type": "text/plain",
                            "value": body
                        },
                        {
                            "type": "text/html",
                            "value": body.replace("\n", "<br>")
                        }
                    ]
                },
                timeout=10.0
            )
            response.raise_for_status()
            logger.info("Email sent via SendGrid")
            return True
    except Exception as e:
        logger.error(f"SendGrid API error: {e}")
        return False

async def send_via_mailgun(recipient_email: str, sender_email: str, subject: str, body: str, reply_to: str) -> bool:
    """Send email using Mailgun API"""
    try:
        api_key = os.getenv("MAILGUN_API_KEY")
        domain = os.getenv("MAILGUN_DOMAIN")
        if not api_key or not domain:
            return False
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"https://api.mailgun.net/v3/{domain}/messages",
                auth=("api", api_key),
                data={
                    "from": sender_email,
                    "to": recipient_email,
                    "h:Reply-To": reply_to,
                    "subject": subject,
                    "text": body,
                    "html": body.replace("\n", "<br>")
                },
                timeout=10.0
            )
            response.raise_for_status()
            logger.info("Email sent via Mailgun")
            return True
    except Exception as e:
        logger.error(f"Mailgun API error: {e}")
        return False

def send_via_smtp(recipient_email: str, sender_email: str, subject: str, body: str, reply_to: str) -> bool:
    """Send email using SMTP"""
    try:
        smtp_server = os.getenv("SMTP_SERVER", "smtp.gmail.com")
        smtp_port = int(os.getenv("SMTP_PORT", "587"))
        smtp_username = os.getenv("SMTP_USERNAME")
        smtp_password = os.getenv("SMTP_PASSWORD")
        
        if not smtp_username or not smtp_password:
            return False
        
        msg = MIMEMultipart()
        msg['From'] = sender_email
        msg['To'] = recipient_email
        msg['Subject'] = subject
        msg['Reply-To'] = reply_to
        msg.attach(MIMEText(body, 'plain'))
        
        server = smtplib.SMTP(smtp_server, smtp_port)
        server.starttls()
        server.login(smtp_username, smtp_password)
        server.sendmail(sender_email, recipient_email, msg.as_string())
        server.quit()
        
        logger.info("Email sent via SMTP")
        return True
    except Exception as e:
        logger.error(f"SMTP error: {e}")
        return False

@router.post("/submit")
async def submit_contact_form(request: ContactFormRequest):
    """Submit contact form and send email to services@atsnai.com
    Supports multiple email services (Resend, SendGrid, Mailgun, SMTP)"""
    try:
        # Recipient email (from contact page)
        recipient_email = "services@atsnai.com"
        
        # Get sender email from environment or use default
        sender_email = os.getenv("CONTACT_FORM_SENDER_EMAIL", "noreply@atsnai.com")
        
        # Prepare email content
        subject = f"Contact Form: {request.subject}"
        body = f"""New Contact Form Submission

Name: {request.name}
Email: {request.email}
Subject: {request.subject}

Message:
{request.message}

---
This message was sent from the contact form on atsn ai website.
        """
        
        # Try email services in order of preference
        email_sent = False
        
        # 1. Try Resend (recommended - easiest to set up)
        if os.getenv("RESEND_API_KEY"):
            email_sent = await send_via_resend(recipient_email, sender_email, subject, body, request.email)
        
        # 2. Try SendGrid
        if not email_sent and os.getenv("SENDGRID_API_KEY"):
            email_sent = await send_via_sendgrid(recipient_email, sender_email, subject, body, request.email)
        
        # 3. Try Mailgun
        if not email_sent and os.getenv("MAILGUN_API_KEY") and os.getenv("MAILGUN_DOMAIN"):
            email_sent = await send_via_mailgun(recipient_email, sender_email, subject, body, request.email)
        
        # 4. Try SMTP (fallback)
        if not email_sent:
            email_sent = send_via_smtp(recipient_email, sender_email, subject, body, request.email)
        
        if email_sent:
            logger.info(f"Contact form email sent successfully to {recipient_email}")
            return {
                "success": True,
                "message": "Thank you for contacting us. We'll get back to you within 24 hours."
            }
        else:
            # Log the submission even if email can't be sent
            logger.warning(f"Email service not configured. Contact form submission received:")
            logger.warning(f"  From: {request.name} ({request.email})")
            logger.warning(f"  Subject: {request.subject}")
            logger.warning(f"  Message: {request.message}")
            logger.warning(f"  Should be sent to: {recipient_email}")
            
            return {
                "success": True,
                "message": "Thank you for contacting us. We'll get back to you soon.",
                "note": "Email service not configured - message logged to server"
            }
        
    except Exception as e:
        logger.error(f"Error processing contact form: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to submit contact form. Please try again later."
        )

