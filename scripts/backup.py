"""Veritabanı yedeği (pg_dump) — son 7 yedek tutulur, eskiler silinir.

Kullanım:  python scripts/backup.py
Yerelde Docker'daki veritabanının yedeğini alır (docker compose exec db pg_dump).
"""

import subprocess
from datetime import datetime

from db import PROJECT_ROOT, get_database_url

BACKUP_DIR = PROJECT_ROOT / "backups"
KEEP_LAST = 7


def create_backup():
    get_database_url()  # .env kontrolü
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)

    backup_file = BACKUP_DIR / f"hsdcode_{datetime.now():%Y%m%d_%H%M%S}.dump"
    command = ["docker", "compose", "exec", "-T", "db", "pg_dump", "-U", "hsd", "-d", "hsdcode", "-Fc"]

    try:
        with backup_file.open("wb") as output:
            subprocess.run(command, stdout=output, check=True, cwd=PROJECT_ROOT)
    except (subprocess.CalledProcessError, FileNotFoundError) as error:
        backup_file.unlink(missing_ok=True)
        raise RuntimeError("Yedek alınamadı. Docker ve PostgreSQL'in çalıştığını kontrol edin.") from error

    print(f"Yedek oluşturuldu: {backup_file}")
    remove_old_backups()


def remove_old_backups():
    backups = sorted(BACKUP_DIR.glob("hsdcode_*.dump"), reverse=True)
    for old in backups[KEEP_LAST:]:
        old.unlink()
        print(f"Eski yedek silindi: {old.name}")


if __name__ == "__main__":
    create_backup()
