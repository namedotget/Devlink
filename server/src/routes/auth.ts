import { Router } from "express";
import jwt from "jsonwebtoken";
import { login } from "../lib/auth.js";
import { authLimiter } from "../middleware/rate-limit.js";

export const authRouter = Router();

authRouter.post("/login", authLimiter, async (req, res) => {
  const { username, password } = req.body as { username?: string; password?: string };
  if (!username || !password) {
    res.status(400).json({ error: "username and password are required" });
    return;
  }

  const user = await login(username, password);
  if (!user) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const secret = process.env["JWT_SECRET"];
  if (!secret) {
    res.status(500).json({ error: "Server misconfiguration" });
    return;
  }

  const token = jwt.sign({ userId: user.id, role: user.role }, secret, { expiresIn: "7d" });
  res.json({ token, user });
});
