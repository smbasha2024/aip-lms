import math
import time
from collections import deque
from collections.abc import Callable
from threading import Lock

from app.utils.errors import DomainError


class LoginLimiter:
    """Single-process development limiter; production requires the shared proxy limit."""

    def __init__(self, clock: Callable[[], float] = time.monotonic):
        self.clock = clock
        self.attempts: dict[str, deque[float]] = {}
        self.lock = Lock()

    def check(self, address: str) -> None:
        now = self.clock()
        with self.lock:
            # Retain only the current minute; no permanent IP/attempt history.
            for key in list(self.attempts):
                queue = self.attempts[key]
                while queue and queue[0] <= now - 60:
                    queue.popleft()
                if not queue:
                    del self.attempts[key]
            queue = self.attempts.setdefault(address, deque())
            if len(queue) >= 10:
                seconds = max(1, math.ceil(60 - (now - queue[0])))
                raise DomainError(
                    429,
                    "LOGIN_RATE_LIMITED",
                    "Too many sign-in attempts. Try again later.",
                    headers={"Retry-After": str(seconds)},
                )
            queue.append(now)
