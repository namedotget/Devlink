import "dotenv/config";
import { render } from "ink";
import { App } from "./app.js";

async function main() {
  render(<App />);
}

void main().catch((err) => {
  console.error(err);
  process.exit(1);
});
