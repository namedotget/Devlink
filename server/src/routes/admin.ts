import { Router } from "express";
import { createUser } from "../lib/auth.js";
import { requireAdmin } from "../middleware/auth.js";
import type { Role } from "../types.js";

export const adminRouter = Router();

adminRouter.post("/users", requireAdmin, async (req, res) => {
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
