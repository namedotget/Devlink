import { Router } from "express";
import {
  getOrCreateTeamChat,
  sendLinqMessage,
  getLinqMessages,
  deleteLinqMessage,
  clearLinqChatMessages,
  formatOutgoing,
  parseSender,
  isTeamChatBootstrapMessage,
} from "../lib/linq.js";
import { getUsers, getUserById } from "../lib/users.js";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";

export const linqRouter = Router();

linqRouter.use(requireAuth);

linqRouter.get("/team-chat/messages", async (req: AuthRequest, res) => {
  const users = await getUsers();
  const phones = users.map((u) => u.phone).filter((p): p is string => Boolean(p));
  const chatId = await getOrCreateTeamChat(phones);
  const raw = await getLinqMessages(chatId, 50);
  const messages = raw.filter((m) => !isTeamChatBootstrapMessage(m.text));
  res.json({ chatId, messages });
});

linqRouter.post("/team-chat/messages", async (req: AuthRequest, res) => {
  const { text } = req.body as { text?: string };
  if (!text?.trim()) { res.status(400).json({ error: "text is required" }); return; }

  const user = await getUserById(req.userId!);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const users = await getUsers();
  const phones = users.map((u) => u.phone).filter((p): p is string => Boolean(p));
  const chatId = await getOrCreateTeamChat(phones);
  const formatted = formatOutgoing(user, text);
  await sendLinqMessage(chatId, formatted);
  res.status(204).end();
});

linqRouter.delete("/messages/:id", async (req, res) => {
  const messageId = req.params["id"]!;
  await deleteLinqMessage(messageId);
  res.status(204).end();
});

linqRouter.post("/team-chat/clear", async (req: AuthRequest, res) => {
  if (req.userRole !== "manager") {
    res.status(403).json({ error: "Only managers can clear the chat" });
    return;
  }
  const users = await getUsers();
  const phones = users.map((u) => u.phone).filter((p): p is string => Boolean(p));
  const chatId = await getOrCreateTeamChat(phones);
  await clearLinqChatMessages(chatId);
  res.status(204).end();
});

export { parseSender };
