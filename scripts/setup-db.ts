import "dotenv/config";
import { ensureSchema } from "../src/lib/db.js";

async function setup() {
  console.log("Setting up database...");
  await ensureSchema();
  console.log("Database setup complete.");
}

setup().catch((err) => {
  console.error("Setup failed:", err);
  process.exit(1);
});
