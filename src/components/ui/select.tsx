import { Box, Text, useInput } from "ink";
import { FOCUS, SURFACE_PANEL_ALT, TEXT_DIM, TEXT_MUTED } from "../theme.js";

export interface SelectOption<T extends string = string> {
  label: string;
  value: T;
}

interface SelectProps<T extends string> {
  options: SelectOption<T>[];
  value: T;
  onChange: (value: T) => void;
  isFocused?: boolean;
}

export function Select<T extends string>({
  options,
  value,
  onChange,
  isFocused = true,
}: SelectProps<T>) {
  const currentIndex = options.findIndex((o) => o.value === value);

  useInput(
    (_, key) => {
      if (key.upArrow) {
        const prev = (currentIndex - 1 + options.length) % options.length;
        onChange(options[prev]!.value);
      }
      if (key.downArrow) {
        const next = (currentIndex + 1) % options.length;
        onChange(options[next]!.value);
      }
    },
    { isActive: isFocused },
  );

  const selectedLabel = options[currentIndex]?.label ?? value;

  if (!isFocused) {
    return <Text color={TEXT_MUTED}>{selectedLabel}</Text>;
  }

  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor={FOCUS}
      paddingX={1}
    >
      {options.map((opt) => {
        const isSelected = opt.value === value;
        return (
          <Box key={opt.value}>
            <Text color={isSelected ? FOCUS : TEXT_MUTED} bold={isSelected}>
              {isSelected ? "▶ " : "  "}
              {opt.label}
            </Text>
          </Box>
        );
      })}
    </Box>
  );
}
