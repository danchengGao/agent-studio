"""
Email I/O helpers — IMAP inbox polling and SMTP reply sending.

Uses only Python standard library (imaplib, smtplib, email).
"""
import imaplib
import smtplib
import email as email_lib
import email.utils
import re
from dataclasses import dataclass
from email.mime.text import MIMEText
from typing import List, Optional

from openjiuwen.core.common.logging import logger


@dataclass
class InboundEmail:
    """A parsed inbound email message."""
    from_address: str
    subject: str
    body: str
    message_id: str
    uid: str


@dataclass
class IMAPConfig:
    host: str
    port: int
    username: str
    password: str


@dataclass
class SMTPConfig:
    host: str
    port: int
    username: str
    password: str
    from_address: str


# ── IMAP ─────────────────────────────────────────────────────────────────────

def fetch_unread_messages(config: IMAPConfig) -> List[InboundEmail]:
    """Connect to IMAP, fetch all UNSEEN messages, return parsed list."""
    results: List[InboundEmail] = []
    try:
        with imaplib.IMAP4_SSL(config.host, config.port, timeout=30) as imap:
            try:
                imap.login(config.username, config.password)
            except imaplib.IMAP4.error as login_err:
                logger.error("IMAP login failed for %s@%s: %s. "
                           "Check credentials and ensure IMAP is enabled. "
                           "For some providers (188.com, 163.com), you may need to enable "
                           "'IMAP/SMTP service' and use an authorization code instead of your password.",
                           config.username, config.host, login_err)
                raise

            # 1. Send IMAP ID command required by NetEase servers (163.com, 126.com, 188.com).
            #    Without this they accept the login but reject SELECT with "Unsafe Login".
            #
            #    imaplib._simple_command() is unreliable here: NetEase sends back an
            #    untagged "* ID (...)" response followed by the tagged OK, and imaplib's
            #    internal response parser can leave data in the buffer, corrupting the
            #    state machine before SELECT runs.  We send the raw bytes ourselves and
            #    drain all response lines until the tagged final response arrives.
            #    RFC 2971 — harmless on providers that don't support ID.
            try:
                tag = b'OJID1'
                imap.send(tag + b' ID ("name" "OpenJiuwen" "version" "1.0")\r\n')
                while True:
                    line = imap.readline()
                    if not line or line.startswith(tag):
                        break
            except Exception as exc:
                logger.debug("IMAP ID command skipped (provider may not support it): %s", exc)

            # 2. Flush any remaining post-login server responses
            try:
                imap.noop()
            except Exception as exc:
                logger.debug("IMAP NOOP flush failed (non-critical): %s", exc)

            # 3. Select folder and safely validate state transition
            status, data = imap.select("INBOX")
            if status != "OK":
                # Safely decode only if data[0] is a bytes object
                reason = data[0].decode('utf-8', errors='ignore') if (
                            data and isinstance(data[0], bytes)) else "unknown"
                error_msg = f"SELECT INBOX failed ({status}): {reason}"
                logger.error("IMAP %s. This may indicate: "
                           "1) IMAP not properly enabled, "
                           "2) Security settings blocking access (check provider's security settings), "
                           "3) Need to use authorization code instead of password (188.com, 163.com, etc.)",
                           error_msg)
                raise imaplib.IMAP4.error(error_msg)

            # 4. Perform the search now that we are guaranteed to be in SELECTED state
            _, data = imap.uid("search", None, "UNSEEN")
            uids = data[0].split() if data[0] else []

            for uid in uids:
                try:
                    _, msg_data = imap.uid("fetch", uid, "(RFC822)")
                    if not msg_data or not msg_data[0]:
                        continue

                    raw = msg_data[0][1]
                    msg = email_lib.message_from_bytes(raw)

                    from_header = msg.get("From", "")
                    _, from_address = email.utils.parseaddr(from_header)
                    subject = _decode_header(msg.get("Subject", "(no subject)"))
                    message_id = msg.get("Message-ID", "")
                    body = _extract_body(msg)

                    results.append(InboundEmail(
                        from_address=from_address.lower().strip(),
                        subject=subject,
                        body=body,
                        message_id=message_id,
                        uid=uid.decode(),
                    ))
                except Exception as e:
                    logger.warning("Failed to parse email uid=%s: %s", uid, e)

    except imaplib.IMAP4.error:
        # Re-raise IMAP errors (already logged above)
        raise
    except Exception as e:
        logger.error("IMAP error: %s", e)

    return results


def _decode_header(value: str) -> str:
    """Decode a possibly RFC 2047-encoded header value."""
    try:
        parts = email_lib.header.decode_header(value)
        decoded = []
        for part, charset in parts:
            if isinstance(part, bytes):
                decoded.append(part.decode(charset or "utf-8", errors="replace"))
            else:
                decoded.append(part)
        return "".join(decoded)
    except Exception:
        return value


def _extract_body(msg) -> str:
    """Extract plain-text body from a (possibly multipart) email."""
    if msg.is_multipart():
        for part in msg.walk():
            ct = part.get_content_type()
            disp = str(part.get("Content-Disposition", ""))
            if ct == "text/plain" and "attachment" not in disp:
                charset = part.get_content_charset() or "utf-8"
                return part.get_payload(decode=True).decode(charset, errors="replace")
    else:
        charset = msg.get_content_charset() or "utf-8"
        return msg.get_payload(decode=True).decode(charset, errors="replace")
    return ""


# ── Command extraction ────────────────────────────────────────────────────────

def extract_command(body: str) -> Optional[str]:
    """Return the first non-quoted, non-empty line from the email body.

    Skips lines starting with ">" (quoted replies) and common reply
    separators like "On ... wrote:".
    """
    separator_re = re.compile(
        r"^(>|On .+ wrote:|From:|-----Original Message-----|_{5,}|-{5,})",
        re.IGNORECASE,
    )
    for line in body.splitlines():
        stripped = line.strip()
        if not stripped:
            continue
        if separator_re.match(stripped):
            break  # everything after this is quoted reply — stop
        return stripped
    return None


# ── SMTP ─────────────────────────────────────────────────────────────────────

def send_reply(
    config: SMTPConfig,
    to_address: str,
    original_subject: str,
    body: str,
    in_reply_to: str = "",
) -> None:
    """Send a plain-text reply email via SMTP."""
    subject = original_subject if original_subject.lower().startswith("re:") else f"Re: {original_subject}"

    msg = MIMEText(body, "plain", "utf-8")
    msg["From"] = config.from_address
    msg["To"] = to_address
    msg["Subject"] = subject
    if in_reply_to:
        msg["In-Reply-To"] = in_reply_to
        msg["References"] = in_reply_to

    # Try STARTTLS first (port 587), then fall back to SMTP_SSL (port 465)
    try:
        _send_via_starttls(config, to_address, msg)
        logger.info("Reply sent to %s via STARTTLS", to_address)
    except Exception as starttls_err:
        #logger.warning("STARTTLS failed for %s: %s, trying SSL...", to_address, starttls_err)
        try:
            _send_via_ssl(config, to_address, msg)
            logger.info("Reply sent to %s via SSL", to_address)
        except Exception as ssl_err:
            logger.error("SMTP error sending to %s: STARTTLS failed (%s), SSL failed (%s)",
                        to_address, starttls_err, ssl_err)


def _send_via_starttls(config: SMTPConfig, to_address: str, msg: MIMEText) -> None:
    """Send email using STARTTLS (typical port 587)."""
    with smtplib.SMTP(config.host, config.port, timeout=30) as smtp:
        smtp.set_debuglevel(0)  # Set to 1 for debugging
        smtp.ehlo()
        smtp.starttls()
        smtp.ehlo()  # re-identify after TLS upgrade (required by RFC 3207)
        smtp.login(config.username, config.password)
        smtp.sendmail(config.from_address, [to_address], msg.as_string())


def _send_via_ssl(config: SMTPConfig, to_address: str, msg: MIMEText) -> None:
    """Send email using SMTP_SSL (typical port 465)."""
    # Use port 465 if the config port is 587 (STARTTLS default)
    ssl_port = 465 if config.port == 587 else config.port
    with smtplib.SMTP_SSL(config.host, ssl_port, timeout=30) as smtp:
        smtp.set_debuglevel(0)  # Set to 1 for debugging
        smtp.ehlo()
        smtp.login(config.username, config.password)
        smtp.sendmail(config.from_address, [to_address], msg.as_string())


# ── Markdown stripper ────────────────────────────────────────────────────────

def strip_markdown(text: str) -> str:
    """Remove common markdown formatting for plain-text email output."""
    # Bold/italic: **text**, *text*, __text__, _text_
    text = re.sub(r"\*\*(.+?)\*\*", r"\1", text)
    text = re.sub(r"\*(.+?)\*", r"\1", text)
    text = re.sub(r"__(.+?)__", r"\1", text)
    text = re.sub(r"_(.+?)_", r"\1", text)

    # Inline code: `text`
    text = re.sub(r"`(.+?)`", r"\1", text)

    return text
