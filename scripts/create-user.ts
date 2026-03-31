import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import bcrypt from "bcryptjs";

const connectionString = process.env["DATABASE_URL"];
if (!connectionString) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const sql = neon(connectionString);

function parseArgs(args: string[]): Record<string, string> {
  return args.reduce(
    (acc, arg) => {
      const match = arg.match(/^--(\w+)=(.+)$/);
      if (match) acc[match[1]!] = match[2]!;
      return acc;
    },
    {} as Record<string, string>
  );
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const { username, email, password, role } = args;

  if (!username || !email || !password || !role) {
    console.error(
      "Usage: npx tsx scripts/create-user.ts --username=<name> --email=<email> --password=<pass> --role=<dev|manager>"
    );
    process.exit(1);
  }

  if (role !== "dev" && role !== "manager") {
    console.error("Role must be 'dev' or 'manager'.");
    process.exit(1);
  }

  const hash = await bcrypt.hash(password, 12);

  try {
    const rows = await sql`
      INSERT INTO users (username, email, password_hash, role)
      VALUES (${username}, ${email}, ${hash}, ${role})
      RETURNING id, username, email, role
    `;
    const user = rows[0];
    console.log(`User created: id=${user!["id"]} username=${user!["username"]} email=${user!["email"]} role=${user!["role"]}`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("unique") || msg.includes("duplicate")) {
      console.error("A user with that username or email already exists.");
    } else {
      console.error("Failed to create user:", msg);
    }
    process.exit(1);
  }
}

main();
