import { sql } from "./db.js";
import type { LinqMessage, User } from "../types.js";

const BASE_URL = "https://api.linqapp.com/api/partner";

function authHeader(): Record<string, string> {
  const key = process.env["LINQ_API_KEY"];
  if (!key) throw new Error("LINQ_API_KEY is not set.");
  return {
    "Authorization": `Bearer ${key}`,
    "Content-Type": "application/json",
  };
}

function toE164(phone: string): string {
  const stripped = phone.replace(/[^\d+]/g, "").replace(/(?!^\+)\+/g, "");
  if (!stripped.startsWith("+")) return `+${stripped}`;
  return stripped;
}

function fromNumber(): string {
  const num = process.env["LINQ_FROM_NUMBER"];
  if (!num) throw new Error("LINQ_FROM_NUMBER is not set.");
  return toE164(num);
}

async function linqFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: { ...authHeader(), ...(options.headers ?? {}) },
  });

  if (!res.ok) {
    throw new Error(`Linq API error (${res.status})`);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

async function ensureConfigTable(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS app_config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `;
}

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

export async function getOrCreateTeamChat(memberPhones: string[]): Promise<string> {
  await ensureConfigTable();

  const cached = await sql`
    SELECT value FROM app_config WHERE key = 'linq_team_chat_id' LIMIT 1
  `;
  if (cached.length > 0) return cached[0]!["value"] as string;

  const validPhones = [...new Set(memberPhones.filter(Boolean).map(toE164))];
  if (validPhones.length === 0) {
    throw new Error("No team members with phone numbers found. Add phone numbers in Settings or Team Management.");
  }

  const result = await linqFetch<{ chat: { id: string } }>("/v3/chats", {
    method: "POST",
    body: JSON.stringify({
      from: fromNumber(),
      to: validPhones,
      message: {
        parts: [{ type: "text", value: TEAM_CHAT_BOOTSTRAP }],
      },
    }),
  });

  const chatId = result.chat.id;

  await sql`
    INSERT INTO app_config (key, value)
    VALUES ('linq_team_chat_id', ${chatId})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `;

  return chatId;
}

export async function sendLinqMessage(chatId: string, text: string): Promise<void> {
  await linqFetch(`/v3/chats/${chatId}/messages`, {
    method: "POST",
    body: JSON.stringify({
      message: {
        parts: [{ type: "text", value: text }],
      },
    }),
  });
}

export async function getLinqMessages(chatId: string, limit = 30): Promise<LinqMessage[]> {
  const result = await linqFetch<{
    messages: Array<{
      id: string;
      is_from_me: boolean;
      from_handle: { handle: string } | null;
      sent_at: string | null;
      created_at: string;
      parts: Array<{ type: string; value?: string }> | null;
    }>;
  }>(`/v3/chats/${chatId}/messages?limit=${limit}`);

  return result.messages
    .filter((m) => m.parts && m.parts.length > 0)
    .map((m) => {
      const textChunks = (m.parts ?? [])
        .filter((p) => p.type === "text")
        .map((p) => p.value ?? "");
      const text =
        textChunks.length > 0 ? textChunks.join("") : "[media]";
      return {
        id: m.id,
        text,
        isFromMe: m.is_from_me,
        fromHandle: m.from_handle?.handle ?? null,
        sentAt: m.sent_at ?? m.created_at,
      };
    })
    .sort((a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime());
}

export async function deleteLinqMessage(messageId: string): Promise<void> {
  await linqFetch(`/v3/messages/${messageId}`, {
    method: "DELETE",
  });
}

export async function clearLinqChatMessages(chatId: string): Promise<number> {
  const messages = await getLinqMessages(chatId, 200);
  await Promise.all(messages.map((m) => deleteLinqMessage(m.id)));
  return messages.length;
}
