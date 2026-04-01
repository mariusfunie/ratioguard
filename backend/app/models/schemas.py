from pydantic import BaseModel, Field
from typing import Optional, Literal
from datetime import datetime
import uuid


class TrackerBase(BaseModel):
    name: str
    auth_type: Literal["cookie", "login", "api"]
    threshold: float = 1.0
    enabled: bool = True
    profile_url: Optional[str] = None
    manual_cookies: Optional[str] = None
    login_url: Optional[str] = None
    username: Optional[str] = None
    password: Optional[str] = None
    api_url: Optional[str] = None
    api_key: Optional[str] = None


class TrackerCreate(TrackerBase):
    pass


class TrackerUpdate(BaseModel):
    name: Optional[str] = None
    threshold: Optional[float] = None
    enabled: Optional[bool] = None
    profile_url: Optional[str] = None
    manual_cookies: Optional[str] = None
    login_url: Optional[str] = None
    username: Optional[str] = None
    password: Optional[str] = None
    api_url: Optional[str] = None
    api_key: Optional[str] = None
    prowlarr_priority: Optional[int] = None
    previous_ratio: Optional[float] = None
    free_leech_detected: Optional[bool] = None


class TrackerOut(TrackerBase):
    id: str
    current_ratio: Optional[float] = None
    upload: Optional[str] = None
    download: Optional[str] = None
    last_checked: Optional[datetime] = None
    status: str = "unknown"
    error_reason: Optional[str] = None
    prowlarr_id: Optional[int] = None
    prowlarr_priority: Optional[int] = None
    previous_ratio: Optional[float] = None
    free_leech_detected: Optional[bool] = None

    class Config:
        from_attributes = True


class RatioHistory(BaseModel):
    tracker_id: str
    ratio: float
    upload: Optional[str] = None
    download: Optional[str] = None
    recorded_at: datetime = Field(default_factory=datetime.utcnow)


class Notification(BaseModel):
    tracker_name: str
    ratio: float
    threshold: float
    sent_at: datetime = Field(default_factory=datetime.utcnow)
    message: str
    discord_sent: bool = False


class AppSettings(BaseModel):
    discord_webhook_url: str = ""
    check_interval_hours: int = 24
    notifications_enabled: bool = True
    prowlarr_url: str = ""
    prowlarr_api_key: str = ""
    prowlarr_sync_enabled: bool = False


class AppSettingsUpdate(BaseModel):
    discord_webhook_url: Optional[str] = None
    check_interval_hours: Optional[int] = None
    notifications_enabled: Optional[bool] = None
    prowlarr_url: Optional[str] = None
    prowlarr_api_key: Optional[str] = None
    prowlarr_sync_enabled: Optional[bool] = None
    transmission_url: Optional[str] = None
    transmission_user: Optional[str] = None
    transmission_pass: Optional[str] = None
