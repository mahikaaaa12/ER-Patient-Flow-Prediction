import re
import uuid
from datetime import datetime


def generate_session_id() -> str:
    """Generate a unique conversation session ID."""
    return str(uuid.uuid4())


def sanitize_input(text: str) -> str:
    """Sanitize user input by stripping redundant whitespaces and control characters."""
    if not text:
        return ""
    cleaned = re.sub(r"\s+", " ", text).strip()
    return cleaned


def format_timestamp(dt: datetime | None = None) -> str:
    """Format a datetime object into standard ISO format string."""
    if dt is None:
        dt = datetime.utcnow()
    return dt.isoformat()
