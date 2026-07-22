import { dbQuery, ensureDatabase } from "@/lib/db";
import { resolveUserRole, type Permission, type UserRole } from "@/lib/roles";

export type AppUser = {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  role: UserRole;
  permissions: Permission[];
  created_at: string;
  updated_at: string;
  last_sign_in_at: string;
};

type UserRow = {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  role: UserRole;
  permissions: Permission[];
  created_at: string;
  updated_at: string;
  last_sign_in_at: string;
};

function mapUser(row: UserRow): AppUser {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    image: row.image,
    role: row.role,
    permissions: row.permissions ?? [],
    created_at: row.created_at,
    updated_at: row.updated_at,
    last_sign_in_at: row.last_sign_in_at
  };
}

export async function getUserByEmail(email?: string | null) {
  if (!email) return null;

  await ensureDatabase();
  const [row] = await dbQuery<UserRow>(
    `SELECT id, email, name, image, role, permissions, created_at, updated_at, last_sign_in_at
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
         role = CASE
           WHEN EXCLUDED.role = 'admin' THEN EXCLUDED.role
           ELSE users.role
         END,
         updated_at = NOW(),
         last_sign_in_at = NOW()
     RETURNING id, email, name, image, role, permissions, created_at, updated_at, last_sign_in_at`,
    [crypto.randomUUID(), normalizedEmail, input.name ?? null, input.image ?? null, role]
  );

  return mapUser(row);
}

export async function listAllUsers() {
  await ensureDatabase();
  const rows = await dbQuery<UserRow>(
    `SELECT id, email, name, image, role, permissions, created_at, updated_at, last_sign_in_at
     FROM users
     ORDER BY created_at DESC`
  );

  return rows.map(mapUser);
}

export async function updateUserRole(userId: string, role: UserRole, permissions: Permission[]) {
  await ensureDatabase();
  const [row] = await dbQuery<UserRow>(
    `UPDATE users
     SET role = $2,
         permissions = $3,
         updated_at = NOW()
     WHERE id = $1
     RETURNING id, email, name, image, role, permissions, created_at, updated_at, last_sign_in_at`,
    [userId, role, permissions]
  );

  return row ? mapUser(row) : null;
}
