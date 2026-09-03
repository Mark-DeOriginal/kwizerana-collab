import { dbQuery, ensureDatabase } from "@/lib/db";
import { getOwnedVendorIds } from "@/lib/p2p/trades";

export type ChatMessage = {
  id: string;
  trade_id: string;
  sender_id: string;
  sender_name: string;
  sender_role: "buyer" | "seller";
  message_text: string;
  message_type: string;
  image_url: string | null;
  created_at: string;
};

async function assertParticipant(userId: string, tradeId: string): Promise<{ buyer_id: string; seller_id: string }> {
  await ensureDatabase();
  const ownedVendorIds = await getOwnedVendorIds(userId);
  const allIds = [userId, ...Array.from(ownedVendorIds)];
  const rows = await dbQuery<{ buyer_id: string; seller_id: string }>(
    `SELECT buyer_id, seller_id FROM p2p_trades WHERE id = $1`,
    [tradeId]
  );
  const trade = rows[0];
  if (!trade) throw new Error("Trade not found.");
  if (!allIds.includes(trade.buyer_id) && !allIds.includes(trade.seller_id)) {
    throw new Error("Not your trade.");
  }
  return trade;
}

export async function listChatMessages(userId: string, tradeId: string): Promise<ChatMessage[]> {
  const trade = await assertParticipant(userId, tradeId);
  const rows = await dbQuery<Omit<ChatMessage, "sender_role">>(
    `SELECT m.id::TEXT AS id, m.trade_id::TEXT AS trade_id, m.sender_id, u.name AS sender_name,
            m.message_text, m.message_type, m.image_url, m.created_at
     FROM p2p_chat_messages m
     JOIN users u ON u.id = m.sender_id
     WHERE m.trade_id = $1
     ORDER BY m.id ASC`,
    [tradeId]
  );
  return rows.map((r) => ({
    ...r,
    sender_role: r.sender_id === trade.seller_id ? ("seller" as const) : ("buyer" as const)
  }));
}

export async function sendChatMessage(userId: string, tradeId: string, text: string): Promise<ChatMessage> {
  const trimmed = text.trim();
  if (!trimmed) throw new Error("Message cannot be empty.");

  const trade = await assertParticipant(userId, tradeId);

  const inserted = await dbQuery<{ id: string }>(
    `INSERT INTO p2p_chat_messages (trade_id, sender_id, message_text, message_type)
     VALUES ($1, $2, $3, 'text')
     RETURNING id::TEXT AS id`,
    [tradeId, userId, trimmed]
  );

  const rows = await dbQuery<Omit<ChatMessage, "sender_role">>(
    `SELECT m.id::TEXT AS id, m.trade_id::TEXT AS trade_id, m.sender_id, u.name AS sender_name,
            m.message_text, m.message_type, m.image_url, m.created_at
     FROM p2p_chat_messages m
     JOIN users u ON u.id = m.sender_id
     WHERE m.id = $1`,
    [inserted[0].id]
  );
  const row = rows[0];
  return {
    ...row,
    sender_role: row.sender_id === trade.seller_id ? ("seller" as const) : ("buyer" as const)
  };
}
