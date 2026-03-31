import { useStdout } from "ink";
import { useState, useEffect } from "react";

function getColsRows(stdout: { columns?: number; rows?: number }) {
  const c = stdout.columns;
  const r = stdout.rows;
  return {
    columns: typeof c === "number" && c > 0 ? c : 80,
    rows: typeof r === "number" && r > 0 ? r : 24,
  };
}

export function useTerminalSize(): { columns: number; rows: number } {
  const { stdout } = useStdout();
  const [size, setSize] = useState(() => getColsRows(stdout));

  useEffect(() => {
    function sync() {
      setSize(getColsRows(stdout));
    }
    stdout.on("resize", sync);
    process.on("SIGWINCH", sync);
    return () => {
      stdout.off("resize", sync);
      process.off("SIGWINCH", sync);
    };
  }, [stdout]);

  return size;
}

export function chatPanelHeight(rows: number, reservedLines: number): number {
  return Math.max(6, rows - reservedLines);
}
