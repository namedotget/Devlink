import { sql } from "./db.js";
import type { Comment } from "../types.js";

function rowToComment(row: Record<string, unknown>, currentUserId?: number): Comment {
  return {
    id: row["id"] as number,
    task_id: row["task_id"] as number,
    user_id: row["user_id"] as number,
    username: row["username"] as string,
    content: row["content"] as string,
    created_at: row["created_at"] as string,
    likes_count: ((row["likes_count"] as number | null) ?? 0) as number,
    is_liked_by_current_user:
      currentUserId === undefined ? undefined : Boolean(row["liked_by_current_user"] as boolean | null),
  };
}

export async function getComments(taskId: number, currentUserId?: number): Promise<Comment[]> {
  const rows = await sql`
    SELECT
      c.id, c.task_id, c.user_id, c.content, c.created_at, u.username,
      COUNT(cl.comment_id)::INTEGER AS likes_count,
      BOOL_OR(cl.user_id = ${currentUserId ?? -1}) AS liked_by_current_user
    FROM comments c
    JOIN users u ON u.id = c.user_id
    LEFT JOIN comment_likes cl ON cl.comment_id = c.id
    WHERE c.task_id = ${taskId}
    GROUP BY c.id, c.task_id, c.user_id, c.content, c.created_at, u.username
    ORDER BY c.created_at ASC
  `;
  return rows.map((row) => rowToComment(row, currentUserId));
}

export async function addComment(
  taskId: number,
  userId: number,
  content: string
): Promise<Comment> {
  const rows = await sql`
    INSERT INTO comments (task_id, user_id, content)
    VALUES (${taskId}, ${userId}, ${content})
    RETURNING id, task_id, user_id, content, created_at
  `;
  const row = rows[0];
  const userRows = await sql`SELECT username FROM users WHERE id = ${userId} LIMIT 1`;

  return {
    id: row["id"] as number,
    task_id: row["task_id"] as number,
    user_id: row["user_id"] as number,
    username: userRows[0]["username"] as string,
    content: row["content"] as string,
    created_at: row["created_at"] as string,
    likes_count: 0,
    is_liked_by_current_user: false,
  };
}

export async function toggleCommentLike(commentId: number, userId: number): Promise<boolean> {
  const existingRows = await sql`
    SELECT comment_id
    FROM comment_likes
    WHERE comment_id = ${commentId} AND user_id = ${userId}
    LIMIT 1
  `;
  if (existingRows.length > 0) {
    await sql`
      DELETE FROM comment_likes
      WHERE comment_id = ${commentId} AND user_id = ${userId}
    `;
    return false;
  }
  await sql`
    INSERT INTO comment_likes (comment_id, user_id)
    VALUES (${commentId}, ${userId})
  `;
  return true;
}
