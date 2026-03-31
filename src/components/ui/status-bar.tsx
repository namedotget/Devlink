import { Text, Box } from "ink";
import { BORDER_SUBTLE, ERROR, FOCUS, PRIMARY, SURFACE_PANEL_ALT, TEXT_DIM, TEXT_MUTED } from "../theme.js";

interface Binding {
  key: string;
  label: string;
}

interface StatusBarProps {
  bindings: Binding[];
  message?: string;
  error?: string;
}

export function StatusBar({ bindings, message, error }: StatusBarProps) {
  const trimmedMessage = (message ?? "").trim();
  const trimmedError = (error ?? "").trim();
  const panelText = trimmedError || trimmedMessage;

  return (
    <Box flexDirection="column" marginTop={1}>
      {panelText ? (
        <Box marginBottom={1} borderStyle="single" borderColor={trimmedError ? ERROR : BORDER_SUBTLE} paddingX={1}>
          <Text color={trimmedError ? ERROR : PRIMARY} bold>
            {panelText}
          </Text>
        </Box>
      ) : null}
      <Box gap={2} flexWrap="wrap" borderStyle="single" borderColor={SURFACE_PANEL_ALT} paddingX={1}>
        {bindings.map((b) => (
          <Box key={b.key}>
            <Text bold color={FOCUS}>
              [{b.key}]
            </Text>
            <Text color={TEXT_MUTED}> </Text>
            <Text color={TEXT_DIM}>{b.label}</Text>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
