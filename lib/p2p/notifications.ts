import { dbQuery, ensureDatabase } from "@/lib/db";
import { sendEmail, renderAntiPhishingNotice, isEmailConfigured } from "@/lib/p2p/email";

export type P2PNotification = {
  id: string;
  notification_type: string;
  title: string;
  body: string;
  is_read: boolean;
  created_at: string;
  updated_at: string | null;
};

export async function listNotifications(userId: string, limit = 10, offset = 0): Promise<P2PNotification[]> {
  await ensureDatabase();
  return dbQuery<P2PNotification>(
    `SELECT id, notification_type, title, body, is_read, created_at, updated_at
     FROM p2p_notifications
     WHERE user_id = $1
     ORDER BY COALESCE(updated_at, created_at) DESC
     LIMIT $2 OFFSET $3`,
    [userId, limit, offset]
  );
}

export async function markNotificationRead(userId: string, id: string): Promise<boolean> {
  await ensureDatabase();
  const rows = await dbQuery<{ id: string }>(
    `UPDATE p2p_notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2 RETURNING id`,
    [id, userId]
  );
  return rows.length > 0;
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  await ensureDatabase();
  await dbQuery(
    `UPDATE p2p_notifications SET is_read = TRUE WHERE user_id = $1 AND is_read = FALSE`,
    [userId]
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

export async function createNotification(
  userId: string,
  input: { type: string; title: string; body: string; data?: Record<string, unknown> }
): Promise<void> {
  await ensureDatabase();
  await dbQuery(
    `INSERT INTO p2p_notifications (user_id, notification_type, title, body, data)
     VALUES ($1, $2, $3, $4, $5::jsonb)`,
    [userId, input.type, input.title, input.body, JSON.stringify(input.data ?? {})]
  );
}

/** Live-updates the "order request" activity row so it reflects the trade's current state. */
export async function updateTradeNotification(
  tradeId: string,
  update: { title: string; body: string }
): Promise<void> {
  await ensureDatabase();
  await dbQuery(
    `UPDATE p2p_notifications
     SET title = $2, body = $3, updated_at = NOW()
     WHERE data->>'tradeId' = $1 AND notification_type = 'trade_created'`,
    [tradeId, update.title, update.body]
  );
}

/**
 * Best-effort transactional email to a user (Resend). Includes their
 * anti-phishing code when set. Never throws — email must not block the request.
 */
export async function notifyByEmail(userId: string, subject: string, bodyText: string): Promise<void> {
  if (!isEmailConfigured()) return;
  try {
    const rows = await dbQuery<{ email: string; anti_phishing_code: string | null }>(
      `SELECT email, anti_phishing_code FROM users WHERE id = $1`,
      [userId]
    );
    const user = rows[0];
    if (!user?.email) return;

    const html = `
      <div style="font-family:Inter,system-ui,sans-serif;color:#182026;max-width:560px;margin:0 auto;padding:24px;background:#ffffff;border:1px solid #dfe4dc;">
        <h2 style="margin:0 0 12px;font-size:18px;">${subject}</h2>
        <p style="margin:0;line-height:1.6;font-size:15px;">${bodyText}</p>
        ${renderAntiPhishingNotice(user.anti_phishing_code)}
      </div>`;
    await sendEmail({ to: user.email, subject, html, text: bodyText });
  } catch {
    // best-effort
  }
}
