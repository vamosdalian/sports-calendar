import asyncio
import time


class AsyncRateLimiter:
    """A global token-bucket limiter shared by every scraper request.

    Configured with ``qps`` (requests per second). With ``qps < 1`` this
    enforces a minimum spacing of ``1 / qps`` seconds between requests, which
    is what keeps us under Transfermarkt's radar.

    A small burst capacity is allowed but defaults to 1 so requests are
    strictly serialised in time.
    """

    def __init__(self, qps: float, burst: int = 1):
        if qps <= 0:
            raise ValueError("qps must be > 0")
        self.rate = qps
        self.capacity = max(1, burst)
        self._tokens = float(self.capacity)
        self._updated = time.monotonic()
        self._lock = asyncio.Lock()

    async def acquire(self) -> None:
        async with self._lock:
            while True:
                now = time.monotonic()
                elapsed = now - self._updated
                self._tokens = min(
                    self.capacity, self._tokens + elapsed * self.rate
                )
                self._updated = now
                if self._tokens >= 1:
                    self._tokens -= 1
                    return
                # Need to wait for the next token to become available.
                wait = (1 - self._tokens) / self.rate
                await asyncio.sleep(wait)
