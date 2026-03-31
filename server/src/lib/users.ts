import { sql } from "./db.js";
import type { User, Role, CustomRole } from "../types.js";

function rowToCustomRole(row: Record<string, unknown>): CustomRole {
  return {
    id: row["role_id"] as number,
    name: row["role_name"] as string,
    color: row["role_color"] as string,
    can_assign_tasks: row["role_can_assign_tasks"] as boolean,
    is_system: row["role_is_system"] as boolean,
  };
}

function groupUsersWithRoles(rows: Record<string, unknown>[]): User[] {
  const usersMap = new Map<number, User>();

  for (const row of rows) {
    const id = row["id"] as number;

    if (!usersMap.has(id)) {
      usersMap.set(id, {
        id,
        username: row["username"] as string,
        email: row["email"] as string,
        role: row["role"] as Role,
        phone: (row["phone"] as string | null) ?? null,
        chat_color: (row["chat_color"] as string | null) ?? null,
        custom_roles: [],
        created_at: row["created_at"] as string,
      });
    }

    if (row["role_id"] !== null && row["role_id"] !== undefined) {
      usersMap.get(id)!.custom_roles!.push(rowToCustomRole(row));
    }
  }

  return Array.from(usersMap.values());
}

export async function getUsers(): Promise<User[]> {
  const rows = await sql`
    SELECT
      u.id, u.username, u.email, u.role, u.phone, u.chat_color, u.created_at,
      r.id AS role_id, r.name AS role_name, r.color AS role_color,
      r.can_assign_tasks AS role_can_assign_tasks, r.is_system AS role_is_system
    FROM users u
    LEFT JOIN user_roles ur ON ur.user_id = u.id
    LEFT JOIN roles r ON r.id = ur.role_id
    ORDER BY u.username ASC, r.name ASC
  `;
  return groupUsersWithRoles(rows);
}

export async function getDevs(): Promise<User[]> {
  const rows = await sql`
    SELECT
      u.id, u.username, u.email, u.role, u.phone, u.chat_color, u.created_at,
      r.id AS role_id, r.name AS role_name, r.color AS role_color,
      r.can_assign_tasks AS role_can_assign_tasks, r.is_system AS role_is_system
    FROM users u
    LEFT JOIN user_roles ur ON ur.user_id = u.id
    LEFT JOIN roles r ON r.id = ur.role_id
    WHERE u.role IN ('dev', 'lead')
    ORDER BY u.username ASC, r.name ASC
  `;
  return groupUsersWithRoles(rows);
}

export async function getUserById(id: number): Promise<User | null> {
  const rows = await sql`
    SELECT
      u.id, u.username, u.email, u.role, u.phone, u.chat_color, u.created_at,
      r.id AS role_id, r.name AS role_name, r.color AS role_color,
      r.can_assign_tasks AS role_can_assign_tasks, r.is_system AS role_is_system
    FROM users u
    LEFT JOIN user_roles ur ON ur.user_id = u.id
    LEFT JOIN roles r ON r.id = ur.role_id
    WHERE u.id = ${id}
    ORDER BY r.name ASC
  `;
  if (rows.length === 0) return null;
  const users = groupUsersWithRoles(rows);
  return users[0] ?? null;
}
