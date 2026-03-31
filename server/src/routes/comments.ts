import { Router } from "express";
import {
  getComments,
  addComment,
  addCommentLike,
  removeCommentLike,
  updateComment,
  deleteComment,
} from "../lib/comments.js";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { statusCodeFromError } from "../lib/errors.js";
import type { Role } from "../types.js";

export const commentsRouter = Router();

commentsRouter.use(requireAuth);

commentsRouter.get("/tasks/:taskId/comments", async (req: AuthRequest, res) => {
  const taskId = parseInt(req.params["taskId"]!, 10);
  if (isNaN(taskId)) { res.status(400).json({ error: "Invalid taskId" }); return; }
  const comments = await getComments(taskId, req.userId!);
  res.json(comments);
});

commentsRouter.post("/tasks/:taskId/comments", async (req: AuthRequest, res) => {
  const taskId = parseInt(req.params["taskId"]!, 10);
  if (isNaN(taskId)) { res.status(400).json({ error: "Invalid taskId" }); return; }
  const { content } = req.body as { content?: string };
  if (!content?.trim()) { res.status(400).json({ error: "content is required" }); return; }
  const comment = await addComment(taskId, req.userId!, content);
  res.status(201).json(comment);
});

commentsRouter.post("/comments/:id/like", async (req: AuthRequest, res) => {
  const id = parseInt(req.params["id"]!, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  await addCommentLike(id, req.userId!);
  res.json({ liked: true });
});

commentsRouter.delete("/comments/:id/like", async (req: AuthRequest, res) => {
  const id = parseInt(req.params["id"]!, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  await removeCommentLike(id, req.userId!);
  res.status(204).end();
});

commentsRouter.patch("/comments/:id", async (req: AuthRequest, res) => {
  const id = parseInt(req.params["id"]!, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const { content } = req.body as { content?: string };
  if (!content?.trim()) { res.status(400).json({ error: "content is required" }); return; }

  try {
    const updated = await updateComment(id, content, req.userId!, req.userRole as Role);
    res.json(updated);
  } catch (err) {
    res.status(statusCodeFromError(err)).json({ error: (err as Error).message });
  }
});

commentsRouter.delete("/comments/:id", async (req: AuthRequest, res) => {
  const id = parseInt(req.params["id"]!, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  try {
    await deleteComment(id, req.userId!, req.userRole as Role);
    res.status(204).end();
  } catch (err) {
    res.status(statusCodeFromError(err)).json({ error: (err as Error).message });
  }
});
