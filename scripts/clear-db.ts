import "dotenv/config";
import { neon } from "@neondatabase/serverless";

const connectionString = process.env["DATABASE_URL"];
if (!connectionString) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const sql = neon(connectionString);

async function clear() {
  const confirmed = process.argv.includes("--confirm");
  if (!confirmed) {
    console.error(
      "This will delete ALL data (users, tasks, comments).\nRun with --confirm to proceed: npx tsx scripts/clear-db.ts --confirm"
    );
    process.exit(1);
  }

  console.log("Clearing database...");

  await sql`TRUNCATE TABLE comments, tasks, users RESTART IDENTITY CASCADE`;

  console.log("Database cleared. All rows deleted, sequences reset.");
}

clear().catch((err) => {
  console.error("Clear failed:", err);
  process.exit(1);
});
