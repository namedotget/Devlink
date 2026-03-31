export type Role = "dev" | "lead" | "manager";
export type TaskStatus = "todo" | "wip" | "review" | "done";
export type TaskPriority = "low" | "medium" | "high";

export interface User {
  id: number;
  username: string;
  email: string;
  role: Role;
  phone?: string | null;
  chat_color?: string | null;
  created_at: string;
}

export interface LinqMessage {
  id: string;
  text: string;
  isFromMe: boolean;
  fromHandle: string | null;
  sentAt: string;
}

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface Task {
  id: number;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  created_by: number;
  assigned_to: number | null;
  creator_name: string;
  assignee_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface Comment {
  id: number;
  task_id: number;
  user_id: number;
  username: string;
  content: string;
  created_at: string;
  likes_count?: number;
  is_liked_by_current_user?: boolean;
}
