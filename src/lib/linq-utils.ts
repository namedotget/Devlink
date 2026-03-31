import type { User } from "../types/index.js";

function roleSegment(user: User): string {
  const extras = (user.custom_roles ?? []).map((r) => r.name).filter(Boolean);
  if (extras.length === 0) return user.role;
  return `${user.role} · ${extras.join(" · ")}`;
}

export function formatOutgoing(user: User, text: string): string {
  const who = `${user.username} · ${roleSegment(user)}`;
  return `[${who}]: ${text}`;
}

export function parseSender(text: string): {
  sender: string | null;
  body: string;
  username: string | null;
} {
  const match = text.match(/^\[([^\]]+)\]:\s*([\s\S]*)$/);
  if (!match) return { sender: null, body: text, username: null };
  const label = match[1]!;
  const body = match[2]!;
  if (label === "System") {
    return { sender: "System", body, username: null };
  }
  const username = label.includes(" · ") ? label.split(" · ")[0]!.trim() : label.trim();
  return { sender: label, body, username };
}

const TEAM_CHAT_BOOTSTRAP = "\u200B";

export function isTeamChatBootstrapMessage(text: string): boolean {
  const t = text.trim();
  if (t === TEAM_CHAT_BOOTSTRAP) return true;
  if (t === "[System]: Team chat initialized.") return true;
  return false;
}
