import { dbQuery, ensureDatabase } from "@/lib/db";

export type P2PNotification = {
  id: string;
  notification_type: string;
  title: string;
  body: string;
  is_read: boolean;
  created_at: string;
};

export async function listNotifications(userId: string, limit = 10): Promise<P2PNotification[]> {
  await ensureDatabase();
  return dbQuery<P2PNotification>(
    `SELECT id, notification_type, title, body, is_read, created_at
     FROM p2p_notifications
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [userId, limit]
  );
}

export async function getUnreadNotificationCount(userId: string): Promise<number> {
  await ensureDatabase();
  const rows = await dbQuery<{ count: string }>(
    `SELECT COUNT(*)::TEXT AS count FROM p2p_notifications WHERE user_id = $1 AND is_read = FALSE`,
    [userId]
  );
  return Number(rows[0]?.count ?? "0");
}
