import { Box, useApp, useInput } from "ink";
import { useState } from "react";
import { Login } from "./components/screens/login.js";
import { ManagerDashboard } from "./components/screens/manager-dashboard.js";
import { DevDashboard } from "./components/screens/dev-dashboard.js";
import { TaskDetail } from "./components/screens/task-detail.js";
import { TaskForm } from "./components/screens/task-form.js";
import { TeamManagement } from "./components/screens/team-management.js";
import { Settings } from "./components/screens/settings.js";
import { MessageThread } from "./components/screens/message-thread.js";
import { canAssignTasks } from "./lib/api.js";
import { clearSession } from "./lib/session.js";
import type { User, Screen } from "./types/index.js";

export function App() {
  const { exit } = useApp();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [screen, setScreen] = useState<Screen>("login");
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null);

  function navigate(next: Screen) {
    process.stdout.write("\x1B[2J\x1B[H");
    setScreen(next);
  }

  useInput((input, key) => {
    if ((input === "q" || key.escape) && screen === "login") {
      exit();
    }
  });

  function clearAndSet(next: Screen) {
    process.stdout.write("\x1B[2J\x1B[H");
    setScreen(next);
  }

  function handleLogin(user: User) {
    setCurrentUser(user);
    clearAndSet(user.role === "manager" ? "manager-dashboard" : "dev-dashboard");
  }

  function handleLogout() {
    clearSession();
    setCurrentUser(null);
    setSelectedTaskId(null);
    setEditingTaskId(null);
    clearAndSet("login");
  }

  function handleUserUpdated(updated: User) {
    setCurrentUser(updated);
  }

  function handleViewTask(taskId: number) {
    setSelectedTaskId(taskId);
    clearAndSet("task-detail");
  }

  function handleNewTask() {
    setEditingTaskId(null);
    clearAndSet("task-form");
  }

  function handleEditTask(taskId: number) {
    setEditingTaskId(taskId);
    clearAndSet("task-form");
  }

  function handleTaskSaved() {
    navigate(dashboardScreen());
  }

  function handleBackFromTask() {
    navigate(dashboardScreen());
  }

  function handleBackFromTaskWithEdit() {
    setEditingTaskId(selectedTaskId);
    clearAndSet("task-form");
  }

  function dashboardScreen(): Screen {
    if (!currentUser) return "login";
    return currentUser.role === "manager" ? "manager-dashboard" : "dev-dashboard";
  }

  if (!currentUser) {
    return (
      <Box>
        <Login onLogin={handleLogin} />
      </Box>
    );
  }

  if (screen === "manager-dashboard" && currentUser.role === "manager") {
    return (
      <ManagerDashboard
        currentUser={currentUser}
        onViewTask={handleViewTask}
        onNewTask={handleNewTask}
        onEditTask={handleEditTask}
        onTeam={() => navigate("team-management")}
        onMessaging={() => navigate("message-thread")}
        onSettings={() => navigate("settings")}
      />
    );
  }

  if (screen === "dev-dashboard" && (currentUser.role === "dev" || currentUser.role === "lead")) {
    return (
      <DevDashboard
        currentUser={currentUser}
        onViewTask={handleViewTask}
        onNewTask={canAssignTasks(currentUser) ? handleNewTask : undefined}
        onMessaging={() => navigate("message-thread")}
        onSettings={() => navigate("settings")}
      />
    );
  }

  if (screen === "task-detail" && selectedTaskId !== null) {
    return (
      <TaskDetail
        taskId={selectedTaskId}
        currentUser={currentUser}
        onBack={handleBackFromTask}
        onEdit={
          currentUser.role === "manager" || currentUser.role === "lead"
            ? handleBackFromTaskWithEdit
            : undefined
        }
      />
    );
  }

  if (screen === "task-form" && canAssignTasks(currentUser)) {
    return (
      <TaskForm
        currentUser={currentUser}
        editingTaskId={editingTaskId}
        onSave={handleTaskSaved}
        onCancel={() => navigate(dashboardScreen())}
      />
    );
  }

  if (screen === "team-management" && currentUser.role === "manager") {
    return (
      <TeamManagement
        onBack={() => navigate("manager-dashboard")}
      />
    );
  }

  if (screen === "message-thread") {
    return (
      <MessageThread
        currentUser={currentUser}
        onBack={() => navigate(dashboardScreen())}
      />
    );
  }

  if (screen === "settings") {
    return (
      <Settings
        currentUser={currentUser}
        onLogout={handleLogout}
        onBack={() => navigate(dashboardScreen())}
        onUserUpdated={handleUserUpdated}
      />
    );
  }

  return null;
}
