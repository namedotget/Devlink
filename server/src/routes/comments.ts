import { Router } from "express";
import { getComments, addComment, toggleCommentLike } from "../lib/comments.js";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";

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
  const liked = await toggleCommentLike(id, req.userId!);
  res.json({ liked });
});

commentsRouter.delete("/comments/:id/like", async (req: AuthRequest, res) => {
  const id = parseInt(req.params["id"]!, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  await toggleCommentLike(id, req.userId!);
  res.status(204).end();
});
