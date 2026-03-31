import { Router } from "express";
import { getUsers, getDevs, getUserById } from "../lib/users.js";
import { createUser, updateUserPhone, updateUserChatColor, updateUserRole, deleteUser } from "../lib/auth.js";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import type { Role } from "../types.js";
import { statusCodeFromError } from "../lib/errors.js";

export const usersRouter = Router();

usersRouter.use(requireAuth);

usersRouter.get("/", async (_req, res) => {
  const users = await getUsers();
  res.json(users);
});

usersRouter.get("/devs", async (_req, res) => {
  const devs = await getDevs();
  res.json(devs);
});

usersRouter.get("/:id", async (req, res) => {
  const id = parseInt(req.params["id"]!, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const user = await getUserById(id);
  if (!user) { res.status(404).json({ error: "Not found" }); return; }
  res.json(user);
});

usersRouter.post("/", async (req: AuthRequest, res) => {
  if (req.userRole !== "manager") {
    res.status(403).json({ error: "Only managers can create users" });
    return;
  }
  const { username, email, password, role, phone } = req.body as {
    username?: string;
    email?: string;
    password?: string;
    role?: Role;
    phone?: string;
  };
  if (!username || !email || !password || !role) {
    res.status(400).json({ error: "username, email, password, and role are required" });
    return;
  }
  if (!["dev", "lead", "manager"].includes(role)) {
    res.status(400).json({ error: "role must be dev, lead, or manager" });
    return;
  }
  try {
    const user = await createUser(username, email, password, role, phone);
    res.status(201).json(user);
  } catch (err) {
    res.status(409).json({ error: (err as Error).message });
  }
});

usersRouter.patch("/:id", async (req: AuthRequest, res) => {
  const id = parseInt(req.params["id"]!, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const { phone, chat_color, role } = req.body as {
    phone?: string | null;
    chat_color?: string | null;
    role?: Role;
  };

  if (role !== undefined && !["dev", "lead", "manager"].includes(role)) {
    res.status(400).json({ error: "role must be dev, lead, or manager" });
    return;
  }

  try {
    const actorRole = req.userRole as Role;
    const actorUserId = req.userId!;
    if (phone !== undefined) await updateUserPhone(id, phone, actorUserId, actorRole);
    if (chat_color !== undefined) await updateUserChatColor(id, chat_color, actorUserId, actorRole);
    if (role !== undefined) await updateUserRole(id, role, actorUserId, actorRole);
    const updated = await getUserById(id);
    res.json(updated);
  } catch (err) {
    res.status(statusCodeFromError(err)).json({ error: (err as Error).message });
  }
});

usersRouter.delete("/:id", async (req: AuthRequest, res) => {
  if (req.userRole !== "manager") {
    res.status(403).json({ error: "Only managers can delete users" });
    return;
  }
  const id = parseInt(req.params["id"]!, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  await deleteUser(id);
  res.status(204).end();
});
