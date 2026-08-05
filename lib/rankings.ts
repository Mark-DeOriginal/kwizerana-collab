import { dbQuery, ensureDatabase } from "@/lib/db";

export type RankingBoard = {
  id: string;
  niche: string;
  sub_niche: string;
  created_at: string;
  updated_at: string;
  entry_count: number;
};

export type RankedInfluencer = {
  position: number;
  influencer: {
    id: number;
    handle: string;
    name: string;
    bio: string;
    followers: number;
    verified: boolean;
    profile_image_url: string | null;
    profile_url: string;
  };
};

export type RankingBoardWithEntries = RankingBoard & {
  entries: RankedInfluencer[];
};

export const RANK_DEPTH = 10;

export const TOP_LEVEL_NICHES = ["Crypto", "DeFi", "AI", "Science", "Politics"] as const;

export async function listBoards(): Promise<RankingBoard[]> {
  await ensureDatabase();
  const rows = await dbQuery<RankingBoard>(
    `SELECT b.id, b.niche, b.sub_niche, b.created_at, b.updated_at,
            (SELECT COUNT(*) FROM rankings r WHERE r.board_id = b.id)::INTEGER AS entry_count
     FROM ranking_boards b
     ORDER BY b.updated_at DESC`
  );
  return rows;
}

export async function getBoard(id: string): Promise<RankingBoardWithEntries | null> {
  await ensureDatabase();
  const [board] = await dbQuery<RankingBoard>(
    `SELECT b.id, b.niche, b.sub_niche, b.created_at, b.updated_at,
            (SELECT COUNT(*) FROM rankings r WHERE r.board_id = b.id)::INTEGER AS entry_count
     FROM ranking_boards b
     WHERE b.id = $1`,
    [id]
  );
  if (!board) return null;

  const entries = await dbQuery<{
    position: number;
    influencer_id: number;
    handle: string;
    name: string;
    bio: string;
    followers: number;
    verified: boolean;
    profile_image_url: string | null;
    profile_url: string;
  }>(
    `SELECT r.position, i.id AS influencer_id, i.handle, i.name, i.bio, i.followers,
            i.verified, i.profile_image_url, i.profile_url
     FROM rankings r
     JOIN influencers i ON i.id = r.influencer_id
     WHERE r.board_id = $1
     ORDER BY r.position ASC`,
    [id]
  );

  return {
    ...board,
    entries: entries.map((e) => ({
      position: Number(e.position),
      influencer: {
        id: Number(e.influencer_id),
        handle: e.handle,
        name: e.name,
        bio: e.bio,
        followers: Number(e.followers),
        verified: e.verified,
        profile_image_url: e.profile_image_url,
        profile_url: e.profile_url
      }
    }))
  };
}

export async function createBoard(niche: string, subNiche: string): Promise<RankingBoard> {
  await ensureDatabase();
  const [row] = await dbQuery<RankingBoard>(
    `INSERT INTO ranking_boards (id, niche, sub_niche)
     VALUES ($1, $2, $3)
     ON CONFLICT (niche, sub_niche) DO UPDATE SET updated_at = NOW()
     RETURNING id, niche, sub_niche, created_at, updated_at, 0 AS entry_count`,
    [crypto.randomUUID(), niche, subNiche]
  );
  if (!row) throw new Error("Failed to create ranking board.");
  return row;
}

export async function saveBoardEntries(boardId: string, entries: Array<{ position: number; influencerId: number }>) {
  await ensureDatabase();
  await dbQuery(`DELETE FROM rankings WHERE board_id = $1`, [boardId]);

  for (const entry of entries) {
    await dbQuery(
      `INSERT INTO rankings (id, board_id, position, influencer_id)
       VALUES ($1, $2, $3, $4)`,
      [crypto.randomUUID(), boardId, entry.position, entry.influencerId]
    );
  }

  await dbQuery(`UPDATE ranking_boards SET updated_at = NOW() WHERE id = $1`, [boardId]);
}

export async function deleteBoard(boardId: string) {
  await ensureDatabase();
  await dbQuery(`DELETE FROM ranking_boards WHERE id = $1`, [boardId]);
}

export async function searchInfluencers(query: string, limit = 8) {
  await ensureDatabase();
  const q = query.toLowerCase().trim();
  if (!q) return [];

  const rows = await dbQuery<{
    id: number;
    handle: string;
    name: string;
    followers: number;
    verified: boolean;
    profile_image_url: string | null;
  }>(
    `SELECT id, handle, name, followers, verified, profile_image_url
     FROM influencers
     WHERE status = 'active' AND (LOWER(handle) LIKE $1 OR LOWER(name) LIKE $1)
     ORDER BY followers DESC
     LIMIT $2`,
     [`%${q}%`, limit]
  );
  return rows.map((r) => ({
    id: Number(r.id),
    handle: r.handle,
    name: r.name,
    followers: Number(r.followers),
    verified: r.verified,
    profile_image_url: r.profile_image_url
  }));
}

export async function listPublicRankings(): Promise<RankingBoardWithEntries[]> {
  await ensureDatabase();
  const boards = await listBoards();

  const result: RankingBoardWithEntries[] = [];
  for (const board of boards) {
    const full = await getBoard(board.id);
    if (full && full.entries.length > 0) result.push(full);
  }
  return result;
}
