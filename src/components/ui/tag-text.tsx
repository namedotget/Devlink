import { Text } from "ink";
import { TAG_COLOR, TEXT_MUTED } from "../theme.js";

interface TagTextProps {
  content: string;
  color?: string;
}

export function TagText({ content, color }: TagTextProps) {
  const parts = content.split(/(@\w+)/g);
  const baseColor = color ?? TEXT_MUTED;

  return (
    <Text color={baseColor}>
      {parts.map((part, i) => {
        if (part.startsWith("@")) {
          return (
            <Text key={i} color={TAG_COLOR} bold>
              {part}
            </Text>
          );
        }
        return <Text key={i} color={baseColor}>{part}</Text>;
      })}
    </Text>
  );
}
