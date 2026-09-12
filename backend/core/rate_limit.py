# In-memory sliding-window rate limiter -- docs/backend.md §7.1/§12.6, closing the "no
# rate limiting on /api/auth/login" gap.
#
# Deliberately in-process, not Redis-backed: this only rate-limits correctly on a
# single backend instance. That's an honest limitation, not an oversight -- Redis is
# already deferred to Phase 2+ scale-out (docs/backend.md §9's event-bus decision), and
# introducing it just for this would be premature. If/when this backend runs as
# multiple instances behind a load balancer, this limiter needs a shared store (Redis
# or the same Postgres this project already plans to migrate to) or a caller can
# trivially bypass it by hitting a different instance each time.
import time
import threading
from collections import defaultdict
from typing import Dict, List


class InMemoryRateLimiter:
    def __init__(self, max_attempts: int, window_seconds: int):
        self.max_attempts = max_attempts
        self.window_seconds = window_seconds
        self._attempts: Dict[str, List[float]] = defaultdict(list)
        self._lock = threading.Lock()

    def check_and_record(self, key: str) -> bool:
        """Returns True if this attempt is allowed (and records it); False if `key`
        has already hit max_attempts within the window (does not record a
        rate-limited attempt again, so waiting out the window works as expected)."""
        now = time.time()
        cutoff = now - self.window_seconds
        with self._lock:
            attempts = self._attempts[key]
            attempts[:] = [t for t in attempts if t > cutoff]
            if len(attempts) >= self.max_attempts:
                return False
            attempts.append(now)
            return True

    def reset(self, key: str) -> None:
        """Call on a successful login so a legitimate user isn't penalized by their
        own earlier failed attempts once they get it right."""
        with self._lock:
            self._attempts.pop(key, None)
