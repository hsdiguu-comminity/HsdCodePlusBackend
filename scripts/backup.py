
import os
import subprocess
from datetime import datetime
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

PROJECT_ROOT = Path(__file__).resolve().parent.parent
BACKUP_DIR = PROJECT_ROOT / "backups"


def create_backup():
    if not os.getenv("DATABASE_URL"):
        raise RuntimeError(
            "DATABASE_URL .env dosyasında bulunamadı."
        )

    BACKUP_DIR.mkdir(parents=True, exist_ok=True)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_file = BACKUP_DIR / f"hsdcode_{timestamp}.dump"

    command = [
        "docker", "compose", "exec", "-T",
        "db",
        "pg_dump",
        "-U", "hsd",
        "-d", "hsdcode",
        "-Fc",
    ]

    try:
        with backup_file.open("wb") as output:
            subprocess.run(
                command,
                stdout=output,
                check=True,
            )

        print(f"Yedek başarıyla oluşturuldu: {backup_file}")

    except subprocess.CalledProcessError:
        backup_file.unlink(missing_ok=True)
        raise RuntimeError(
            "Yedek alınamadı. Docker ve PostgreSQL durumunu kontrol et."
        )


if __name__ == "__main__":
    create_backup()