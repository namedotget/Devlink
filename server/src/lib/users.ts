import { sql } from "./db.js";
import type { User, Role } from "../types.js";

function rowToUser(row: Record<string, unknown>): User {
  return {
    id: row["id"] as number,
    username: row["username"] as string,
    email: row["email"] as string,
    role: row["role"] as Role,
    phone: (row["phone"] as string | null) ?? null,
    chat_color: (row["chat_color"] as string | null) ?? null,
    created_at: row["created_at"] as string,
  };
}

export async function getUsers(): Promise<User[]> {
  const rows = await sql`
    SELECT id, username, email, role, phone, chat_color, created_at
    FROM users
    ORDER BY username ASC
  `;
  return rows.map(rowToUser);
}

export async function getDevs(): Promise<User[]> {
  const rows = await sql`
    SELECT id, username, email, role, phone, chat_color, created_at
    FROM users
    WHERE role IN ('dev', 'lead')
    ORDER BY username ASC
  `;
  return rows.map(rowToUser);
}

export async function getUserById(id: number): Promise<User | null> {
  const rows = await sql`
    SELECT id, username, email, role, phone, chat_color, created_at
    FROM users
    WHERE id = ${id}
    LIMIT 1
  `;
  if (rows.length === 0) return null;
  return rowToUser(rows[0]);
}
