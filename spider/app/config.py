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

    # Browser fetcher (needed because Transfermarkt is behind AWS WAF captcha).
    # Headful so a human can solve the captcha once; the aws-waf-token is then
    # cached in the persistent profile and reused for subsequent requests.
    scraper_headless: bool = False
    scraper_browser_profile: str = ".browser_profile"
    scraper_nav_timeout: int = 60
    # Seconds to wait for a human to solve the captcha before giving up.
    scraper_verification_timeout: int = 600

    # Captcha provider for recovering the aws-waf-token when httpx gets blocked.
    #   "browser"  -> pop a headful Chromium and let a human solve it (default,
    #                 good for local dev)
    #   "2captcha" -> hand the AWS WAF challenge to 2captcha and run unattended
    #                 (use this on a headless server)
    captcha_provider: str = "browser"
    twocaptcha_api_key: str = ""
    twocaptcha_base_url: str = "https://api.2captcha.com"
    captcha_poll_interval: int = 5  # seconds between getTaskResult polls
    captcha_timeout: int = 180  # give up on a single solve after this many seconds

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
