import bcrypt from "bcryptjs";
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

export async function login(
  username: string,
  password: string
): Promise<User | null> {
  const rows = await sql`
    SELECT id, username, email, role, phone, chat_color, password_hash, created_at
    FROM users
    WHERE username = ${username}
    LIMIT 1
  `;

  if (rows.length === 0) return null;

  const row = rows[0];
  const hash = row["password_hash"] as string;

  const valid = await bcrypt.compare(password, hash);
  if (!valid) return null;

  return rowToUser(row);
}

export async function createUser(
  username: string,
  email: string,
  password: string,
  role: Role,
  phone?: string
): Promise<User> {
  const hash = await bcrypt.hash(password, 12);
  const rows = await sql`
    INSERT INTO users (username, email, password_hash, role, phone)
    VALUES (${username}, ${email}, ${hash}, ${role}, ${phone ?? null})
    RETURNING id, username, email, role, phone, chat_color, created_at
  `;
  return rowToUser(rows[0]);
}

export async function updateUserPhone(userId: number, phone: string | null): Promise<void> {
  await sql`UPDATE users SET phone = ${phone} WHERE id = ${userId}`;
}

export async function updateUserChatColor(userId: number, color: string | null): Promise<void> {
  await sql`UPDATE users SET chat_color = ${color} WHERE id = ${userId}`;
}

export async function updateUserRole(userId: number, role: Role): Promise<void> {
  await sql`UPDATE users SET role = ${role} WHERE id = ${userId}`;
}

export async function deleteUser(userId: number): Promise<void> {
  await sql`DELETE FROM comments WHERE user_id = ${userId}`;
  await sql`DELETE FROM linq_chats WHERE from_user_id = ${userId} OR to_user_id = ${userId}`;
  await sql`DELETE FROM tasks WHERE created_by = ${userId}`;
  await sql`UPDATE tasks SET assigned_to = NULL WHERE assigned_to = ${userId}`;
  await sql`DELETE FROM users WHERE id = ${userId}`;
}
