"""Haftalık rapor: yeni üyeler, yayınlanan yazılar, quiz katılımı ve en aktif HSD toplulukları.

Kullanım:  python scripts/reports.py [gün sayısı]   (varsayılan: son 7 gün)
"""

import sys

from db import get_connection


def scalar(cur, query, params):
    cur.execute(query, params)
    return cur.fetchone()[0]


def main(days: int):
    interval = (days,)
    with get_connection() as conn, conn.cursor() as cur:
        new_members = scalar(
            cur, "SELECT COUNT(*) FROM users WHERE created_at >= now() - make_interval(days => %s)", interval
        )
        pending_members = scalar(cur, "SELECT COUNT(*) FROM users WHERE status = 'PENDING'", ())
        published_posts = scalar(
            cur,
            "SELECT COUNT(*) FROM posts WHERE status = 'APPROVED' AND published_at >= now() - make_interval(days => %s)",
            interval,
        )
        pending_posts = scalar(cur, "SELECT COUNT(*) FROM posts WHERE status = 'PENDING'", ())
        quiz_attempts = scalar(
            cur,
            "SELECT COUNT(*) FROM quiz_attempts WHERE finished_at >= now() - make_interval(days => %s)",
            interval,
        )

        cur.execute(
            """
            SELECT c.name, c.university, SUM(s.points) AS points, COUNT(DISTINCT s.user_id) AS members
            FROM score_events s
            JOIN users u ON u.id = s.user_id
            JOIN hsd_communities c ON c.id = u.community_id
            WHERE s.created_at >= now() - make_interval(days => %s)
            GROUP BY c.id
            ORDER BY points DESC
            LIMIT 5
            """,
            interval,
        )
        top_communities = cur.fetchall()

    print(f"=== HSDCode+ raporu (son {days} gün) ===")
    print(f"Yeni üye            : {new_members}  (onay bekleyen: {pending_members})")
    print(f"Yayınlanan yazı     : {published_posts}  (onay bekleyen: {pending_posts})")
    print(f"Tamamlanan quiz     : {quiz_attempts}")
    print("En aktif HSD toplulukları:")
    if not top_communities:
        print("  (bu dönemde puan kazanılmadı)")
    for rank, (name, university, points, members) in enumerate(top_communities, start=1):
        print(f"  {rank}. {name} ({university}) — {points} puan, {members} aktif üye")


if __name__ == "__main__":
    main(int(sys.argv[1]) if len(sys.argv) > 1 else 7)
