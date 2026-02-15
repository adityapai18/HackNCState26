import requests

import config
from bot_logger import error as log_err, info as log_info, warning as log_warn


RESEND_EMAILS_URL = "https://api.resend.com/emails"


def _send_email(subject: str, text_body: str) -> bool:
    if not config.RESEND_API_KEY:
        log_warn("RESEND_API_KEY not configured; skipping stop alert email.")
        return False

    payload = {
        "from": config.BOT_ALERT_EMAIL_FROM,
        "to": [config.BOT_ALERT_EMAIL_TO],
        "subject": subject,
        "text": text_body,
    }
    headers = {
        "Authorization": f"Bearer {config.RESEND_API_KEY}",
        "Content-Type": "application/json",
    }

    try:
        resp = requests.post(RESEND_EMAILS_URL, json=payload, headers=headers, timeout=20)
        if 200 <= resp.status_code < 300:
            log_info(f"Alert email sent to {config.BOT_ALERT_EMAIL_TO}")
            return True
        log_err(f"Failed to send alert email: HTTP {resp.status_code} {resp.text}")
        return False
    except Exception as e:
        log_err(f"Failed to send alert email: {e}")
        return False


def send_bot_stop_email(reason: str, session_key_expired: bool) -> bool:
    """Send a bot stop alert email via Resend. Returns True on success."""
    subject = "Bot stopped"
    if session_key_expired:
        subject = "Bot stopped: session key expired"
    lines = [
        "The bot has stopped and requires attention.",
        f"Reason: {reason}",
        "",
        "Please create a new issue key.",
    ]
    return _send_email(subject, "\n".join(lines))


def send_test_email() -> bool:
    """Send a manual test email via Resend. Returns True on success."""
    subject = "Bot test email"
    lines = [
        "This is a test email from the bot service.",
        "",
        "Please create a new issue key.",
    ]
    return _send_email(subject, "\n".join(lines))
