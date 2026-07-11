import { dbQuery, ensureDatabase } from "@/lib/db";
import { resolveUserRole, type UserRole } from "@/lib/roles";

export type AppUser = {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  role: UserRole;
};

type UserRow = {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  role: UserRole;
};

function mapUser(row: UserRow): AppUser {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    image: row.image,
    role: row.role
  };
}

export async function getUserByEmail(email?: string | null) {
  if (!email) return null;

  await ensureDatabase();
  const [row] = await dbQuery<UserRow>(
    `SELECT id, email, name, image, role
     FROM users
     WHERE email = $1`,
    [email.toLowerCase()]
  );

  return row ? mapUser(row) : null;
}

export async function upsertUser(input: {
  email: string;
  name?: string | null;
  image?: string | null;
}) {
  await ensureDatabase();

  const normalizedEmail = input.email.toLowerCase();
  const role = resolveUserRole(normalizedEmail);
  const [row] = await dbQuery<UserRow>(
    `INSERT INTO users (id, email, name, image, role)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (email) DO UPDATE
     SET name = EXCLUDED.name,
         image = EXCLUDED.image,
         role = EXCLUDED.role,
         updated_at = NOW(),
         last_sign_in_at = NOW()
     RETURNING id, email, name, image, role`,
    [crypto.randomUUID(), normalizedEmail, input.name ?? null, input.image ?? null, role]
  );

  return mapUser(row);
}
