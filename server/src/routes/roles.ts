import { Router } from "express";
import { getRoles, createRole, updateRole, deleteRole } from "../lib/roles.js";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";

export const rolesRouter = Router();

rolesRouter.use(requireAuth);

rolesRouter.get("/", async (_req, res) => {
  const roles = await getRoles();
  res.json(roles);
});

rolesRouter.post("/", async (req: AuthRequest, res) => {
  if (req.userRole !== "manager") {
    res.status(403).json({ error: "Only managers can create roles" });
    return;
  }
  const { name, color, can_assign_tasks } = req.body as {
    name?: string;
    color?: string;
    can_assign_tasks?: boolean;
  };
  if (!name || !color) { res.status(400).json({ error: "name and color are required" }); return; }
  const role = await createRole(name, color, can_assign_tasks ?? false);
  res.status(201).json(role);
});

rolesRouter.patch("/:id", async (req: AuthRequest, res) => {
  if (req.userRole !== "manager") {
    res.status(403).json({ error: "Only managers can update roles" });
    return;
  }
  const id = parseInt(req.params["id"]!, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const { name, color, can_assign_tasks } = req.body as {
    name?: string;
    color?: string;
    can_assign_tasks?: boolean;
  };
  await updateRole(id, { name, color, can_assign_tasks });
  res.status(204).end();
});

rolesRouter.delete("/:id", async (req: AuthRequest, res) => {
  if (req.userRole !== "manager") {
    res.status(403).json({ error: "Only managers can delete roles" });
    return;
  }
  const id = parseInt(req.params["id"]!, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  try {
    await deleteRole(id);
    res.status(204).end();
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});
