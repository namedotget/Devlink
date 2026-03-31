import "dotenv/config";
import { createInterface } from "readline";
import { neon } from "@neondatabase/serverless";
import bcrypt from "bcryptjs";

const connectionString = process.env["DATABASE_URL"];
if (!connectionString) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const sql = neon(connectionString);

const username = process.argv[2];
if (!username) {
  console.error("Usage: npx tsx scripts/reset-password.ts <username>");
  process.exit(1);
}

const rows = await sql`SELECT id, username FROM users WHERE username = ${username} LIMIT 1`;
if (rows.length === 0) {
  console.error(`No user found with username "${username}".`);
  process.exit(1);
}

console.log(`Resetting password for: ${rows[0]!["username"]}`);

const rl = createInterface({ input: process.stdin, output: process.stdout });

function prompt(question: string): Promise<string> {
  return new Promise((resolve) => rl.question(question, resolve));
}

const newPassword = await prompt("New password: ");
rl.close();

if (!newPassword.trim()) {
  console.error("Password cannot be empty.");
  process.exit(1);
}

const hash = await bcrypt.hash(newPassword, 12);
await sql`UPDATE users SET password_hash = ${hash} WHERE username = ${username}`;

console.log(`Password updated for "${username}". You can now log in with the password you just typed.`);
