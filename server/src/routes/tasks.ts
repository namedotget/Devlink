import { Router } from "express";
import { getAllTasks, getTasksByAssignee, getTaskById, createTask, updateTask, deleteTask } from "../lib/tasks.js";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import type { TaskStatus, TaskPriority } from "../types.js";
import { statusCodeFromError } from "../lib/errors.js";

export const tasksRouter = Router();

tasksRouter.use(requireAuth);

tasksRouter.get("/", async (_req, res) => {
  const tasks = await getAllTasks();
  res.json(tasks);
});

tasksRouter.get("/mine", async (req: AuthRequest, res) => {
  const tasks = await getTasksByAssignee(req.userId!);
  res.json(tasks);
});

tasksRouter.get("/:id", async (req, res) => {
  const id = parseInt(req.params["id"]!, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const task = await getTaskById(id);
  if (!task) { res.status(404).json({ error: "Not found" }); return; }
  res.json(task);
});

tasksRouter.post("/", async (req: AuthRequest, res) => {
  const { title, description, status, priority, assigned_to } = req.body as {
    title?: string;
    description?: string;
    status?: TaskStatus;
    priority?: TaskPriority;
    assigned_to?: number | null;
  };

  if (!title || !status || !priority) {
    res.status(400).json({ error: "title, status, and priority are required" });
    return;
  }

  try {
    const task = await createTask({
      title,
      description: description ?? "",
      status,
      priority,
      created_by: req.userId!,
      assigned_to: assigned_to ?? null,
    });
    res.status(201).json(task);
  } catch (err) {
    res.status(statusCodeFromError(err)).json({ error: (err as Error).message });
  }
});

tasksRouter.patch("/:id", async (req: AuthRequest, res) => {
  const id = parseInt(req.params["id"]!, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const { title, description, status, priority, assigned_to } = req.body as {
    title?: string;
    description?: string;
    status?: TaskStatus;
    priority?: TaskPriority;
    assigned_to?: number | null;
  };

  if (!title || !status || !priority) {
    res.status(400).json({ error: "title, status, and priority are required" });
    return;
  }

  try {
    const task = await updateTask(id, { title, description: description ?? "", status, priority, assigned_to: assigned_to ?? null }, req.userId!);
    res.json(task);
  } catch (err) {
    res.status(statusCodeFromError(err)).json({ error: (err as Error).message });
  }
});

tasksRouter.delete("/:id", async (req: AuthRequest, res) => {
  if (req.userRole !== "manager") {
    res.status(403).json({ error: "Only managers can delete tasks" });
    return;
  }
  const id = parseInt(req.params["id"]!, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  await deleteTask(id);
  res.status(204).end();
});
