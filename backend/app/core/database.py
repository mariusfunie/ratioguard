from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy import String, Float, Boolean, Integer, DateTime, Text
from sqlalchemy import text
from datetime import datetime
from app.core.config import settings
import os

# creeaza directorul daca nu exista
os.makedirs(os.path.dirname(settings.DATABASE_PATH), exist_ok=True)

engine = create_async_engine(
    f"sqlite+aiosqlite:///{settings.DATABASE_PATH}",
    echo=False,
)

AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


class TrackerModel(Base):
    __tablename__ = "trackers"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String)
    auth_type: Mapped[str] = mapped_column(String)
    threshold: Mapped[float] = mapped_column(Float, default=1.0)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    profile_url: Mapped[str] = mapped_column(String, nullable=True)
    manual_cookies: Mapped[str] = mapped_column(Text, nullable=True)
    login_url: Mapped[str] = mapped_column(String, nullable=True)
    username: Mapped[str] = mapped_column(String, nullable=True)
    password: Mapped[str] = mapped_column(String, nullable=True)
    api_url: Mapped[str] = mapped_column(String, nullable=True)
    api_key: Mapped[str] = mapped_column(Text, nullable=True)
    current_ratio: Mapped[float] = mapped_column(Float, nullable=True)
    upload: Mapped[str] = mapped_column(String, nullable=True)
    download: Mapped[str] = mapped_column(String, nullable=True)
    last_checked: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    status: Mapped[str] = mapped_column(String, default="unknown")
    error_reason: Mapped[str] = mapped_column(Text, nullable=True)
    session_cookies: Mapped[str] = mapped_column(Text, nullable=True)
    prowlarr_id: Mapped[int] = mapped_column(Integer, nullable=True)
    prowlarr_priority: Mapped[int] = mapped_column(Integer, nullable=True)


class RatioHistoryModel(Base):
    __tablename__ = "ratio_history"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tracker_id: Mapped[str] = mapped_column(String)
    ratio: Mapped[float] = mapped_column(Float)
    upload: Mapped[str] = mapped_column(String, nullable=True)
    download: Mapped[str] = mapped_column(String, nullable=True)
    recorded_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class NotificationModel(Base):
    __tablename__ = "notifications"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tracker_name: Mapped[str] = mapped_column(String)
    ratio: Mapped[float] = mapped_column(Float)
    threshold: Mapped[float] = mapped_column(Float)
    sent_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    message: Mapped[str] = mapped_column(Text)
    discord_sent: Mapped[bool] = mapped_column(Boolean, default=False)


class SettingsModel(Base):
    __tablename__ = "app_settings"

    id: Mapped[str] = mapped_column(String, primary_key=True, default="app_settings")
    discord_webhook_url: Mapped[str] = mapped_column(String, default="")
    check_interval_hours: Mapped[int] = mapped_column(Integer, default=24)
    notifications_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    prowlarr_url: Mapped[str] = mapped_column(String, default="")
    prowlarr_api_key: Mapped[str] = mapped_column(String, default="")
    prowlarr_sync_enabled: Mapped[bool] = mapped_column(Boolean, default=False)


async def connect_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    # insert default settings if not exists
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            text("SELECT id FROM app_settings WHERE id = 'app_settings'")
        )
        if not result.fetchone():
            session.add(SettingsModel())
            await session.commit()
    print("SQLite database ready")


async def close_db():
    await engine.dispose()


async def get_db():
    return AsyncSessionLocal()
