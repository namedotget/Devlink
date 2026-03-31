import { sql } from "./db.js";
import type { CustomRole } from "../types.js";

function rowToRole(row: Record<string, unknown>): CustomRole {
  return {
    id: row["id"] as number,
    name: row["name"] as string,
    color: row["color"] as string,
    can_assign_tasks: row["can_assign_tasks"] as boolean,
    is_system: row["is_system"] as boolean,
  };
}

export async function getRoles(): Promise<CustomRole[]> {
  const rows = await sql`
    SELECT id, name, color, can_assign_tasks, is_system
    FROM roles
    ORDER BY is_system DESC, name ASC
  `;
  return rows.map(rowToRole);
}

export async function createRole(
  name: string,
  color: string,
  canAssignTasks: boolean,
): Promise<CustomRole> {
  const rows = await sql`
    INSERT INTO roles (name, color, can_assign_tasks, is_system)
    VALUES (${name}, ${color}, ${canAssignTasks}, false)
    RETURNING id, name, color, can_assign_tasks, is_system
  `;
  return rowToRole(rows[0]);
}

export async function updateRole(
  id: number,
  patch: { name?: string; color?: string; can_assign_tasks?: boolean },
): Promise<void> {
  if (patch.name !== undefined) {
    await sql`UPDATE roles SET name = ${patch.name} WHERE id = ${id} AND is_system = false`;
  }
  if (patch.color !== undefined) {
    await sql`UPDATE roles SET color = ${patch.color} WHERE id = ${id} AND is_system = false`;
  }
  if (patch.can_assign_tasks !== undefined) {
    await sql`UPDATE roles SET can_assign_tasks = ${patch.can_assign_tasks} WHERE id = ${id} AND is_system = false`;
  }
}

export async function deleteRole(id: number): Promise<void> {
  const rows = await sql`SELECT is_system FROM roles WHERE id = ${id} LIMIT 1`;
  if (rows.length === 0) return;
  if (rows[0]["is_system"]) throw new Error("Cannot delete a system role.");
  await sql`DELETE FROM roles WHERE id = ${id}`;
}

export async function getUserRoles(userId: number): Promise<CustomRole[]> {
  const rows = await sql`
    SELECT r.id, r.name, r.color, r.can_assign_tasks, r.is_system
    FROM roles r
    JOIN user_roles ur ON ur.role_id = r.id
    WHERE ur.user_id = ${userId}
    ORDER BY r.is_system DESC, r.name ASC
  `;
  return rows.map(rowToRole);
}

export async function assignRole(userId: number, roleId: number): Promise<void> {
  await sql`
    INSERT INTO user_roles (user_id, role_id)
    VALUES (${userId}, ${roleId})
    ON CONFLICT DO NOTHING
  `;
}

export async function removeRole(userId: number, roleId: number): Promise<void> {
  await sql`
    DELETE FROM user_roles WHERE user_id = ${userId} AND role_id = ${roleId}
  `;
}
