export const PRIMARY = "#00D97E";
export const DIM = "#00A35C";
export const MUTED = "#007A44";
export const ERROR = "red";
export const WARN = "yellow";
export const TAG_COLOR = "#FFD700";
export const BORDER = "#004D2A";

export const GREEN_100 = "#D7FFE8";
export const GREEN_200 = "#A7F5CB";
export const GREEN_300 = "#71E9AA";
export const GREEN_400 = PRIMARY;
export const GREEN_500 = DIM;
export const GREEN_600 = MUTED;
export const GREEN_700 = "#005B32";
export const GREEN_800 = BORDER;
export const GREEN_900 = "#002E1A";

export const SURFACE_BG = GREEN_900;
export const SURFACE_PANEL = GREEN_800;
export const SURFACE_PANEL_ALT = GREEN_700;
export const BORDER_SUBTLE = GREEN_700;
export const BORDER_STRONG = GREEN_500;
export const TEXT_PRIMARY = GREEN_200;
export const TEXT_MUTED = GREEN_500;
export const TEXT_DIM = GREEN_600;
export const TEXT_HIGHLIGHT = GREEN_100;
export const FOCUS = GREEN_300;
export const ACCENT_SOFT = GREEN_400;
export const ACCENT_STRONG = GREEN_200;

export const STATUS_COLORS: Record<string, string> = {
  todo: "yellow",
  wip: PRIMARY,
  review: "#87CEEB",
  done: DIM,
};

export const PRIORITY_COLORS: Record<string, string> = {
  low: DIM,
  medium: "yellow",
  high: "red",
};

export const STATUS_LABELS: Record<string, string> = {
  todo: "TODO",
  wip: "WIP",
  review: "REVIEW",
  done: "DONE",
};

export const PRIORITY_LABELS: Record<string, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

export const CHAT_COLORS = [
  "#FF6B6B",
  "#FFB347",
  "#FFD700",
  "#98FB98",
  "#00CED1",
  "#87CEEB",
  "#DDA0DD",
  "#FF69B4",
  "#00FA9A",
  "#7B68EE",
  "#20B2AA",
  "#F4A460",
];

export const ROLE_COLORS: Record<string, string> = {
  manager: "#00D97E",
  lead: "#FFB347",
  dev: "#87CEEB",
};
