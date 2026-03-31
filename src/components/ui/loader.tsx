import { Text, Box } from "ink";
import { useState, useEffect } from "react";
import { FOCUS, PRIMARY, SURFACE_PANEL_ALT, TEXT_DIM } from "../theme.js";

const FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

interface LoaderProps {
  label?: string;
}

export function Loader({ label = "Loading..." }: LoaderProps) {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setFrame((f) => (f + 1) % FRAMES.length);
    }, 80);
    return () => clearInterval(timer);
  }, []);

  return (
    <Box borderStyle="single" borderColor={SURFACE_PANEL_ALT} paddingX={1}>
      <Text color={FOCUS} bold>
        {FRAMES[frame]}{" "}
      </Text>
      <Text color={PRIMARY}>{label}</Text>
      <Text color={TEXT_DIM} dimColor>
        {" "}please wait
      </Text>
    </Box>
  );
}
