import "dotenv/config";
import express from "express";
import helmet from "helmet";
import { ensureSchema } from "./lib/db.js";
import { globalLimiter } from "./middleware/rate-limit.js";
import { authRouter } from "./routes/auth.js";
import { usersRouter } from "./routes/users.js";
import { tasksRouter } from "./routes/tasks.js";
import { commentsRouter } from "./routes/comments.js";
import { linqRouter } from "./routes/linq.js";
import { aiRouter } from "./routes/ai.js";
import { adminRouter } from "./routes/admin.js";

const app = express();
const PORT = Number(process.env["PORT"] ?? 3000);
const TITLE_BANNER = `
██████╗ ███████╗██╗   ██╗██╗     ██╗███╗   ██╗██╗  ██╗
██╔══██╗██╔════╝██║   ██║██║     ██║████╗  ██║██║ ██╔╝
██║  ██║█████╗  ██║   ██║██║     ██║██╔██╗ ██║█████╔╝
██║  ██║██╔══╝  ╚██╗ ██╔╝██║     ██║██║╚██╗██║██╔═██╗
██████╔╝███████╗ ╚████╔╝ ███████╗██║██║ ╚████║██║  ██╗
╚═════╝ ╚══════╝  ╚═══╝  ╚══════╝╚═╝╚═╝  ╚═══╝╚═╝  ╚═╝
`.trim();

function renderLandingPage(): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="description" content="Manage tasks and message team members from your terminal" />
    <meta name="author" content="Colin M. Foster" />
    <meta name="keywords" content="tui, terminal, project-management, ink" />
    <meta name="robots" content="noindex, nofollow" />
    <meta name="googlebot" content="noindex, nofollow" />
    <meta name="bingbot" content="noindex, nofollow" />
    <meta name="yandexbot" content="noindex, nofollow" />
    <meta name="duckduckbot" content="noindex, nofollow" />
    <meta name="baidu" content="noindex, nofollow" />
    <meta name="sogou" content="noindex, nofollow" />
    <meta name="360" content="noindex, nofollow" />

    <meta name="og:title" content="Devlink Server" />
    <meta name="og:description" content="Manage tasks and message team members from your terminal" />
    <meta name="og:url" content="https://devlink.fly.dev" />
    <meta name="og:type" content="website" />
    <meta name="og:locale" content="en_US" />
    <meta name="og:site_name" content="Devlink" />
    <meta name="og:image:width" content="1200" />
    <meta name="og:image:height" content="630" />
    <meta name="og:image:alt" content="Devlink Server" />
    <meta name="og:image:type" content="image/png" />
    <meta name="og:image:width" content="1200" />
    <meta name="og:image:height" content="630" />
    <meta name="og:image:alt" content="Devlink Server" /> 


    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="Devlink Server" />
    <meta name="twitter:description" content="Manage tasks and message team members from your terminal" />

    <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='6' fill='%2300D97E'/></svg>" />
    <title>Devlink Server</title>
    <style>
      *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

      body {
        background: #000;
        color: #00D97E;
        font-family: "Courier New", Courier, monospace;
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .window {
        border: 1px solid #004D2A;
        border-radius: 6px;
        overflow: hidden;
        width: min(760px, calc(100vw - 32px));
        box-shadow: 0 0 40px rgba(0, 217, 126, 0.08);
      }

      .titlebar {
        background: #002E1A;
        border-bottom: 1px solid #004D2A;
        padding: 10px 14px;
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .dot {
        width: 12px;
        height: 12px;
        border-radius: 50%;
      }

      .dot-red   { background: #3a1010; border: 1px solid #5a1818; }
      .dot-amber { background: #2e2200; border: 1px solid #4a3800; }
      .dot-green { background: #004D2A; border: 1px solid #007A44; }

      .titlebar-label {
        flex: 1;
        text-align: center;
        font-size: 12px;
        color: #007A44;
        letter-spacing: 0.08em;
        margin-right: 36px;
      }

      .body {
        background: #000;
        padding: 32px 24px 36px;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0;
      }

      .prompt-line {
        align-self: flex-start;
        font-size: 13px;
        color: #007A44;
        margin-bottom: 20px;
      }

      .prompt-line span { color: #00D97E; }

      pre {
        font-size: clamp(7px, 1.4vw, 13px);
        line-height: 1.25;
        color: #00D97E;
        white-space: pre;
        text-align: left;
      }

      .subtitle {
        margin-top: 8px;
        font-size: 12px;
        color: #007A44;
        letter-spacing: 0.12em;
        text-transform: uppercase;
      }

      .divider {
        width: 100%;
        border: none;
        border-top: 1px solid #004D2A;
        margin: 28px 0;
      }

      .instructions {
        width: 100%;
        display: flex;
        flex-direction: column;
        gap: 10px;
      }

      .instruction-line {
        font-size: 13px;
        color: #00A35C;
        display: flex;
        align-items: baseline;
        gap: 10px;
      }

      .instruction-line .step {
        color: #004D2A;
        min-width: 20px;
      }

      code {
        background: #002E1A;
        border: 1px solid #004D2A;
        color: #00D97E;
        padding: 2px 8px;
        border-radius: 3px;
        font-family: inherit;
        font-size: 13px;
      }

      .cursor {
        display: inline-block;
        width: 8px;
        height: 14px;
        background: #00D97E;
        vertical-align: text-bottom;
        animation: blink 1.1s step-end infinite;
      }

      @keyframes blink {
        0%, 100% { opacity: 1; }
        50%       { opacity: 0; }
      }
    </style>
  </head>
  <body>
    <div class="window">
      <div class="titlebar">
        <div class="dot dot-red"></div>
        <div class="dot dot-amber"></div>
        <div class="dot dot-green"></div>
        <span class="titlebar-label">devlink — server</span>
      </div>
      <div class="body">
        <div class="prompt-line"><span>~</span> devlink server</div>
        <pre>${TITLE_BANNER}</pre>
        <div class="subtitle">Developer Task Dashboard</div>
        <hr class="divider" />
        <div class="instructions">
          <div class="instruction-line">
            <span class="step">1.</span>
            <span>Make sure <code>Node.js</code> is installed on your machine.</span>
          </div>
          <div class="instruction-line">
            <span class="step">2.</span>
            <span>Run <code>npx dvlnk</code> in your terminal to launch the client.<span class="cursor"></span></span>
          </div>
        </div>
      </div>
    </div>
  </body>
</html>`;
}

app.set("trust proxy", 1);
app.use(helmet());
app.use(express.json());
app.use(globalLimiter);

app.get("/", (_req, res) => {
  res.type("html").send(renderLandingPage());
});

app.use("/auth", authRouter);
app.use("/users", usersRouter);
app.use("/tasks", tasksRouter);
app.use("/", commentsRouter);
app.use("/linq", linqRouter);
app.use("/ai", aiRouter);
app.use("/admin", adminRouter);

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

async function start() {
  await ensureSchema();
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`devlink server running on 0.0.0.0:${PORT}`);
  });
}

start().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
