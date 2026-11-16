"""Ortak veritabanı bağlantısı. Tüm scriptler DATABASE_URL'i proje kökündeki .env dosyasından okur.

Kural: Tablo yapısı yalnızca Prisma migration ile değişir; bu scriptler ALTER TABLE çalıştırmaz.
"""

import os
import uuid
from pathlib import Path

import psycopg
from dotenv import load_dotenv

PROJECT_ROOT = Path(__file__).resolve().parent.parent
load_dotenv(PROJECT_ROOT / ".env")


def get_database_url() -> str:
    url = os.getenv("DATABASE_URL")
    if not url:
        raise RuntimeError("DATABASE_URL .env dosyasında bulunamadı.")
    return url


def get_connection():
    return psycopg.connect(get_database_url())


def new_id() -> str:
    """Prisma'nın id alanları metindir ve uygulama tarafında üretilir; scriptler de kendi id'sini üretir."""
    return "c" + uuid.uuid4().hex[:24]
