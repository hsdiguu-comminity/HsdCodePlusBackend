"""Bakım: süresi dolmuş veya kullanılmış şifre sıfırlama token'larını siler.

Kullanım:  python scripts/cleanup.py
Güvenle tekrar çalıştırılabilir (ör. günde bir kez zamanlanmış görev olarak).
"""

from db import get_connection

# Kullanılmış/süresi dolmuş token'lar bir gün boyunca tutulur (sorun incelemesi için), sonra silinir
KEEP_HOURS = 24


def cleanup_reset_tokens(cur) -> int:
    cur.execute(
        """
        DELETE FROM password_reset_tokens
        WHERE (expires_at < now() OR used_at IS NOT NULL)
          AND created_at < now() - make_interval(hours => %s)
        """,
        (KEEP_HOURS,),
    )
    return cur.rowcount


def main():
    with get_connection() as conn, conn.cursor() as cur:
        removed = cleanup_reset_tokens(cur)
    print(f"Temizlik tamamlandı: {removed} eski şifre sıfırlama token'ı silindi.")


if __name__ == "__main__":
    main()
