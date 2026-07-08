from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Database
    database_url: str = "postgresql+asyncpg://tm:tm_pass@localhost:5432/transfermarkt"

    # Object storage (rustfs / S3)
    s3_endpoint_url: str = "http://localhost:9000"
    s3_access_key: str = "rustfsadmin"
    s3_secret_key: str = "rustfsadmin"
    s3_bucket: str = "transfermarkt-raw"
    s3_region: str = "us-east-1"

    # Scraper
    scraper_qps: float = 0.5
    scraper_base_url: str = "https://www.transfermarkt.com"
    scraper_user_agent: str = (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    )
    scraper_timeout: int = 30
    scraper_max_retries: int = 4
    store_raw_html: bool = True

    # Directory where the recovered aws-waf-token is cached (waf_cookies.json).
    # Persisted so a valid token is reused across requests/restarts and we only
    # call 2captcha again once it expires and httpx gets WAF-blocked.
    scraper_browser_profile: str = ".browser_profile"

    # AWS WAF token recovery. 2captcha is the ONLY mechanism — there is no
    # browser/headful fallback. When httpx is WAF-blocked the challenge is handed
    # to 2captcha; on success the token is cached and reused.
    captcha_provider: str = "2captcha"
    twocaptcha_api_key: str = ""
    twocaptcha_base_url: str = "https://api.2captcha.com"
    captcha_poll_interval: int = 5  # seconds between getTaskResult polls
    captcha_timeout: int = 180  # give up on a single solve after this many seconds
    # Retry a failed 2captcha solve this many times before surfacing a 4xx.
    captcha_max_attempts: int = 3

    # API
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    cors_origins: str = "http://localhost:5173"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
