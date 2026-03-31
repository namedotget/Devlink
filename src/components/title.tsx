import { Text, Box } from "ink";
import { useState, useEffect } from "react";
import { useTerminalSize } from "../lib/terminal-size.js";
import {
  ACCENT_STRONG,
  BORDER_SUBTLE,
  DIM,
  PRIMARY,
  TEXT_DIM,
} from "./theme.js";

const BANNER = `
██████╗ ███████╗██╗   ██╗██╗     ██╗███╗   ██╗██╗  ██╗
██╔══██╗██╔════╝██║   ██║██║     ██║████╗  ██║██║ ██╔╝
██║  ██║█████╗  ██║   ██║██║     ██║██╔██╗ ██║█████╔╝ 
██║  ██║██╔══╝  ╚██╗ ██╔╝██║     ██║██║╚██╗██║██╔═██╗ 
██████╔╝███████╗ ╚████╔╝ ███████╗██║██║ ╚████║██║  ██╗
╚═════╝ ╚══════╝  ╚═══╝  ╚══════╝╚═╝╚═╝  ╚═══╝╚═╝  ╚═╝
`.trim();

const BASE_LINES = BANNER.split("\n");
const BANNER_MAX_WIDTH = Math.max(0, ...BASE_LINES.map((l) => l.length));
/** Horizontal space reserved for parent padding (e.g. login `padding={2}`). */
const BANNER_COLUMN_GUARD = 4;

function compactTitleLabel(columns: number): string {
  if (columns >= 12) return "DEVLINQ";
  if (columns >= 6) return "Linq";
  return "L";
}

function projectBannerY(lines: string[], angleRad: number): string[] {
  const w = Math.max(0, ...lines.map((l) => l.length));
  if (w === 0) return lines;
  const padded = lines.map((l) => l.padEnd(w, " "));
  const cos = Math.cos(angleRad);
  const back = cos < 0;
  const scale = Math.abs(cos);
  const outW = Math.max(1, Math.round(w * scale));
  return padded.map((line) => {
    let row = "";
    for (let ox = 0; ox < outW; ox++) {
      const t = (ox + 0.5) / outW;
      let ix = Math.min(w - 1, Math.floor(t * w));
      if (back) ix = w - 1 - ix;
      row += line[ix] ?? " ";
    }
    // Keep a stable footprint so the container never resizes while rotating.
    const left = Math.floor((w - outW) / 2);
    const right = w - outW - left;
    return `${" ".repeat(left)}${row}${" ".repeat(right)}`;
  });
}

export function Title() {
  const { columns } = useTerminalSize();
  const useFullBanner = columns >= BANNER_MAX_WIDTH + BANNER_COLUMN_GUARD;
  const [displayLines, setDisplayLines] = useState<string[]>(() => [
    ...BASE_LINES,
  ]);

  useEffect(() => {
    if (!useFullBanner) return;

    setDisplayLines([...BASE_LINES]);

    const steps = 42;
    const durationMs = 1300;
    let step = 0;

    const id = setInterval(() => {
      step += 1;
      if (step >= steps) {
        setDisplayLines([...BASE_LINES]);
        clearInterval(id);
        return;
      }
      const angle = (step / steps) * Math.PI * 2;
      setDisplayLines(projectBannerY(BASE_LINES, angle));
    }, durationMs / steps);

    return () => clearInterval(id);
  }, [useFullBanner]);

  return (
    <Box flexDirection="column" alignItems="center" marginBottom={1}>
      {useFullBanner ? (
        <Box
          flexDirection="column"
          borderStyle="single"
          borderColor={BORDER_SUBTLE}
          paddingX={1}
        >
          <Text bold color={PRIMARY}>
            {displayLines.join("\n")}
          </Text>
          <Box justifyContent="center">
            <Text color={TEXT_DIM} dimColor>
              Developer Task Dashboard
            </Text>
            <Text color={DIM}> • </Text>
            <Text color={ACCENT_STRONG}>online</Text>
          </Box>
        </Box>
      ) : (
        <Box flexDirection="column" alignItems="center">
          <Text bold color={PRIMARY}>
            {compactTitleLabel(columns)}
          </Text>
          <Text color={TEXT_DIM} dimColor>
            Developer Task Dashboard
          </Text>
        </Box>
      )}
    </Box>
  );
}
