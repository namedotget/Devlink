import "dotenv/config";
import express from "express";
import helmet from "helmet";
import { ensureSchema } from "./lib/db.js";
import { globalLimiter } from "./middleware/rate-limit.js";
import { authRouter } from "./routes/auth.js";
import { usersRouter } from "./routes/users.js";
import { tasksRouter } from "./routes/tasks.js";
import { commentsRouter } from "./routes/comments.js";
import { rolesRouter } from "./routes/roles.js";
import { linqRouter } from "./routes/linq.js";
import { aiRouter } from "./routes/ai.js";
import { adminRouter } from "./routes/admin.js";

const app = express();
const PORT = Number(process.env["PORT"] ?? 3000);

app.set("trust proxy", 1);
app.use(helmet());
app.use(express.json());
app.use(globalLimiter);

app.use("/auth", authRouter);
app.use("/users", usersRouter);
app.use("/tasks", tasksRouter);
app.use("/", commentsRouter);
app.use("/roles", rolesRouter);
app.use("/linq", linqRouter);
app.use("/ai", aiRouter);
app.use("/admin", adminRouter);

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

async function start() {
  await ensureSchema();
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`devlink server running on 0.0.0.0:${PORT}`);
  });
}

start().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
