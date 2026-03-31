import { Router } from "express";
import { askAI, getAISummary } from "../lib/ai.js";
import { getAllTasks, getTasksByAssignee } from "../lib/tasks.js";
import { getComments } from "../lib/comments.js";
import { getUserById, getUsers } from "../lib/users.js";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import type { ChatMessage } from "../types.js";

export const aiRouter = Router();

aiRouter.use(requireAuth);

aiRouter.post("/chat", async (req: AuthRequest, res) => {
  const { history } = req.body as { history?: ChatMessage[] };
  if (!history || !Array.isArray(history)) {
    res.status(400).json({ error: "history array is required" });
    return;
  }

  const user = await getUserById(req.userId!);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const tasks = user.role === "manager" ? await getAllTasks() : await getTasksByAssignee(user.id);
  const taskIds = tasks.map((t) => t.id);

  const allComments = await Promise.all(taskIds.map((id) => getComments(id, user.id)));
  const comments = allComments.flat();

  const teamMembers = user.role === "manager" ? await getUsers() : [];

  const reply = await askAI(history, user, tasks, comments, teamMembers);
  res.json({ reply });
});

aiRouter.post("/summary", async (req: AuthRequest, res) => {
  const user = await getUserById(req.userId!);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const tasks = user.role === "manager" ? await getAllTasks() : await getTasksByAssignee(user.id);
  const taskIds = tasks.map((t) => t.id);

  const allComments = await Promise.all(taskIds.map((id) => getComments(id, user.id)));
  const comments = allComments.flat();

  const teamMembers = user.role === "manager" ? await getUsers() : [];

  const summary = await getAISummary(user, tasks, comments, teamMembers);
  res.json({ summary });
});
