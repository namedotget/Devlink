import "dotenv/config";
import express from "express";
import helmet from "helmet";
import { randomBytes } from "node:crypto";
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

function renderLandingPage(scriptNonce: string): string {
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

      .transcript {
        width: 100%;
        display: flex;
        flex-direction: column;
        gap: 8px;
        min-height: clamp(300px, 42vh, 340px);
      }

      .terminal-line {
        font-size: 13px;
        color: #00A35C;
        display: flex;
        align-items: baseline;
        gap: 8px;
        line-height: 1.45;
        min-height: 20px;
      }

      .line-prompt {
        color: #007A44;
        white-space: nowrap;
      }

      .line-command {
        color: #00D97E;
      }

      .line-output {
        color: #00A35C;
      }

      .line-faint {
        color: #007A44;
      }

      .line-link {
        color: #3cf8a5;
        text-decoration: none;
        border-bottom: 1px dotted #007A44;
      }

      .line-link:hover,
      .line-link:focus-visible {
        color: #7fffc4;
        border-bottom-color: #00D97E;
        text-shadow: 0 0 8px rgba(0, 217, 126, 0.45);
      }

      .line-index {
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

      .line-cursor {
        display: inline-block;
        width: 8px;
        height: 14px;
        background: #00D97E;
        vertical-align: text-bottom;
        margin-left: 2px;
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
        <div id="terminal-transcript" class="transcript" aria-live="polite"></div>
      </div>
    </div>
    <script nonce="${scriptNonce}">
      (function terminalIntro() {
        var transcriptRoot = document.getElementById("terminal-transcript");
        if (!transcriptRoot) return;

        var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        var skipAnimation = window.location.search.indexOf("reduceMotion=1") !== -1 && reducedMotion;
        var steps = [
          { type: "command", text: "npx dvlnk", speed: 68, after: 700 },
          { type: "output", text: "Booting Devlink TUI...", style: "line-faint", after: 450 },
          { type: "output", text: "Connected to workspace and synced team context.", style: "line-output", after: 700 },
          { type: "command", text: "help", speed: 62, after: 520 },
          { type: "output", text: "Devlink is a terminal first command center for engineering teams.", style: "line-output", after: 780 },
          { type: "output", text: "Plan tasks, track ownership, and collaborate without leaving your shell.", style: "line-output", after: 780 },
          { type: "command", text: "status", speed: 54, after: 560 },
          { type: "output", text: "Everything important. One screen. No context switching.", style: "line-faint", after: 760 },
          { type: "command", text: "sync", speed: 58, after: 620 },
          { type: "output", text: "Team updates aligned in real time.", style: "line-output", after: 760 },
          { type: "command", text: "run", speed: 62, after: 420 },
          { type: "output", text: "Efficient. Intuitive. Developer-first.", style: "line-output", after: 540 },
          {
            type: "link",
            text: "npm package",
            label: "npmjs.com/package/dvlnk",
            href: "https://www.npmjs.com/package/dvlnk",
            after: 0
          }
        ];

        function createLine(type, text, lineClass) {
          var line = document.createElement("div");
          line.className = "terminal-line";

          if (type === "command") {
            var prompt = document.createElement("span");
            prompt.className = "line-prompt";
            prompt.textContent = "devlink ~";
            line.appendChild(prompt);

            var command = document.createElement("span");
            command.className = "line-command";
            command.textContent = text;
            line.appendChild(command);
            return line;
          }

          var index = document.createElement("span");
          index.className = "line-index";
          index.textContent = ">";
          line.appendChild(index);

          if (type === "link") {
            var link = document.createElement("a");
            link.className = "line-link";
            link.href = lineClass || "#";
            link.target = "_blank";
            link.rel = "noreferrer noopener";
            link.textContent = text;
            line.appendChild(link);
            return line;
          }

          var output = document.createElement("span");
          output.className = lineClass || "line-output";
          output.textContent = text;
          line.appendChild(output);
          return line;
        }

        function appendStaticLine(step) {
          if (step.type === "link") {
            transcriptRoot.appendChild(createLine("link", step.text + " " + (step.label || ""), step.href));
            return;
          }
          transcriptRoot.appendChild(createLine(step.type, step.text, step.style));
        }

        if (skipAnimation) {
          for (var i = 0; i < steps.length; i += 1) appendStaticLine(steps[i]);
          var reducedCursor = document.createElement("span");
          reducedCursor.className = "line-cursor";
          transcriptRoot.lastElementChild && transcriptRoot.lastElementChild.appendChild(reducedCursor);
          return;
        }

        var activeCursor = document.createElement("span");
        activeCursor.className = "line-cursor";
        var currentStep = 0;

        function typeCommand(step, done) {
          var line = createLine("command", "", "");
          var commandNode = line.querySelector(".line-command");
          if (!commandNode) {
            done();
            return;
          }

          transcriptRoot.appendChild(line);
          commandNode.appendChild(activeCursor);
          var index = 0;
          var speed = step.speed || 58;

          function tick() {
            if (index < step.text.length) {
              commandNode.insertBefore(document.createTextNode(step.text.charAt(index)), activeCursor);
              index += 1;
              window.setTimeout(tick, speed);
              return;
            }
            done();
          }

          tick();
        }

        function showOutput(step, done) {
          var line = step.type === "link"
            ? createLine("link", step.text + " " + (step.label || ""), step.href)
            : createLine("output", step.text, step.style);
          transcriptRoot.appendChild(line);
          line.appendChild(activeCursor);
          done();
        }

        function runNextStep() {
          var step = steps[currentStep];
          if (!step) return;

          var onComplete = function () {
            currentStep += 1;
            window.setTimeout(runNextStep, step.after || 0);
          };

          if (step.type === "command") {
            typeCommand(step, onComplete);
            return;
          }

          showOutput(step, onComplete);
        }

        runNextStep();
      })();
    </script>
  </body>
</html>`;
}

app.set("trust proxy", 1);
app.use((_req, res, next) => {
  res.locals["cspNonce"] = randomBytes(16).toString("base64");
  next();
});
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        scriptSrc: [
          "'self'",
          (_req, res: any) => `'nonce-${res.locals["cspNonce"]}'`,
        ],
      },
    },
  }),
);
app.use(express.json());
app.use(globalLimiter);

app.get("/", (_req, res) => {
  res.type("html").send(renderLandingPage(res.locals["cspNonce"]));
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
