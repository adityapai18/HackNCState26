"""In-memory log buffer for real-time streaming to the dashboard."""

import collections
import threading
import time

# Keep last 500 log entries
MAX_LOGS = 500
_log_buffer: collections.deque = collections.deque(maxlen=MAX_LOGS)
_lock = threading.Lock()


def _emit(level: str, msg: str, prefix: str = ""):
    ts = time.time()
    entry = {"ts": ts, "level": level, "msg": msg}
    with _lock:
        _log_buffer.append(entry)
    out = f"{prefix}{msg}" if prefix else msg
    print(out)


def info(msg: str):
    _emit("info", msg)


def warning(msg: str):
    _emit("warning", msg, "[WARN] ")


def error(msg: str):
    _emit("error", msg, "[ERROR] ")


def get_logs(since_ts: float | None = None) -> list[dict]:
    """Return log entries, optionally after since_ts."""
    with _lock:
        logs = list(_log_buffer)
    if since_ts is not None:
        logs = [e for e in logs if e["ts"] > since_ts]
    return logs
