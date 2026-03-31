import Groq from "groq-sdk";
import type { User, Task, Comment, ChatMessage } from "../types.js";

const groq = new Groq({
  apiKey: process.env["GROQ_API_KEY"],
});

function userRoleSummary(user: User): string {
  return `${user.username} [${user.role}]`;
}

function buildManagerPrompt(user: User, tasks: Task[], teamMembers: User[]): string {
  const total = tasks.length;
  const byStatus = tasks.reduce(
    (acc, t) => {
      acc[t.status] = (acc[t.status] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );
  const byPriority = tasks.reduce(
    (acc, t) => {
      acc[t.priority] = (acc[t.priority] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );
  const unassigned = tasks.filter((t) => t.assigned_to === null).length;

  const taskList = tasks
    .slice(0, 20)
    .map(
      (t) =>
        `- [${t.status}] [${t.priority}] ${t.title} (assigned to: ${t.assignee_name ?? "nobody"})`
    )
    .join("\n");

  const teamRoster = teamMembers.map(userRoleSummary).join(", ");

  return `You are an AI assistant for ${user.username}, a project manager at a software development team.

Team roster: ${teamRoster || "none"}

Project overview:
- Total tasks: ${total}
- By status: todo=${byStatus["todo"] ?? 0}, in_progress=${byStatus["in_progress"] ?? 0}, done=${byStatus["done"] ?? 0}
- By priority: high=${byPriority["high"] ?? 0}, medium=${byPriority["medium"] ?? 0}, low=${byPriority["low"] ?? 0}
- Unassigned tasks: ${unassigned}

Recent tasks:
${taskList}

Provide a concise managerial summary: highlight blockers, progress, what needs attention, and any patterns you notice. Keep it under 200 words.`;
}

function buildDevPrompt(user: User, tasks: Task[], comments: Comment[]): string {
  const total = tasks.length;
  const byStatus = tasks.reduce(
    (acc, t) => {
      acc[t.status] = (acc[t.status] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const taskList = tasks
    .map(
      (t) =>
        `- [${t.status}] [${t.priority}] ${t.title}`
    )
    .join("\n");

  const recentComments = comments
    .slice(-5)
    .map((c) => `- ${c.username}: ${c.content}`)
    .join("\n");

  const roleLabels = user.role;

  return `You are an AI assistant for ${user.username}, a software developer (${roleLabels}).

Your assigned tasks (${total} total):
- Todo: ${byStatus["todo"] ?? 0}, In progress: ${byStatus["in_progress"] ?? 0}, Done: ${byStatus["done"] ?? 0}

Tasks:
${taskList || "No tasks assigned."}

Recent comments on your tasks:
${recentComments || "No recent comments."}

Give a focused personal summary: what to work on next, any high-priority items, and actionable next steps. Keep it under 150 words.`;
}

export async function getAISummary(
  user: User,
  tasks: Task[],
  comments: Comment[],
  teamMembers: User[] = []
): Promise<string> {
  const prompt =
    user.role === "manager"
      ? buildManagerPrompt(user, tasks, teamMembers)
      : buildDevPrompt(user, tasks, comments);

  const completion = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.7,
    max_tokens: 400,
  });

  return completion.choices[0]?.message?.content ?? "No summary available.";
}

function buildSystemPrompt(user: User, tasks: Task[], comments: Comment[], teamMembers: User[]): string {
  const taskList = tasks
    .map(
      (t) =>
        `- [${t.status}] [${t.priority}] ${t.title}${t.assignee_name ? ` (assigned to: ${t.assignee_name})` : ""}`
    )
    .join("\n");

  const recentComments = comments
    .slice(-10)
    .map((c) => `- ${c.username} on task ${c.task_id}: ${c.content}`)
    .join("\n");

  const roleLabel = user.role === "manager" ? "project manager" : user.role === "lead" ? "lead developer" : "software developer";
  const userRoles = user.role;

  const teamRoster = teamMembers
    .filter((m) => m.id !== user.id)
    .map(userRoleSummary)
    .join(", ");

  return `You are an AI assistant embedded in a developer task management TUI (terminal UI) for ${user.username}, a ${roleLabel} (${userRoles}).

Team: ${teamRoster || "none"}

Current tasks in the system (${tasks.length} total):
${taskList || "No tasks."}

Recent comments:
${recentComments || "No recent comments."}

Answer questions about tasks, priorities, blockers, or team progress. Be concise and direct. Responses will be displayed in a terminal so keep formatting plain text only — no markdown headers or bullet syntax.`;
}

export async function askAI(
  history: ChatMessage[],
  user: User,
  tasks: Task[],
  comments: Comment[],
  teamMembers: User[] = []
): Promise<string> {
  const systemPrompt = buildSystemPrompt(user, tasks, comments, teamMembers);

  const completion = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      { role: "system", content: systemPrompt },
      ...history.map((m) => ({ role: m.role, content: m.content })),
    ],
    temperature: 0.6,
    max_tokens: 500,
  });

  return completion.choices[0]?.message?.content ?? "No response.";
}
