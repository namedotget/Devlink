import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { homedir } from "os";
import { join } from "path";

const SESSION_DIR = join(homedir(), ".devlink");
const SESSION_FILE = join(SESSION_DIR, "session.json");

interface Session {
  token: string;
}

export function saveSession(token: string): void {
  if (!existsSync(SESSION_DIR)) {
    mkdirSync(SESSION_DIR, { recursive: true });
  }
  writeFileSync(SESSION_FILE, JSON.stringify({ token }), { mode: 0o600 });
}

export function loadSession(): string | null {
  try {
    if (!existsSync(SESSION_FILE)) return null;
    const raw = readFileSync(SESSION_FILE, "utf8");
    const parsed = JSON.parse(raw) as Session;
    return parsed.token ?? null;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  try {
    if (existsSync(SESSION_FILE)) {
      writeFileSync(SESSION_FILE, JSON.stringify({}));
    }
  } catch {
    // ignore
  }
}
