import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";
import { useRef, useState } from "react";
import { login } from "../../lib/api.js";
import { saveSession } from "../../lib/session.js";
import { Title } from "../title.js";
import { Loader } from "../ui/loader.js";
import { ACCENT_SOFT, BORDER_SUBTLE, ERROR, FOCUS, PRIMARY, SURFACE_PANEL_ALT, TEXT_DIM, TEXT_MUTED } from "../theme.js";
import { useTerminalSize } from "../../lib/terminal-size.js";
import type { User } from "../../types/index.js";

interface LoginProps {
  onLogin: (user: User) => void;
}

type Field = "username" | "password";

export function Login({ onLogin }: LoginProps) {
  const { columns } = useTerminalSize();
  const formWidth = Math.min(50, Math.max(28, columns - 6));
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [field, setField] = useState<Field>("username");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fieldRef = useRef<Field>("username");
  const loadingRef = useRef(false);
  const usernameRef = useRef("");
  const passwordRef = useRef("");

  function syncUsername(v: string) {
    setUsername(v);
    usernameRef.current = v;
  }

  function syncPassword(v: string) {
    setPassword(v);
    passwordRef.current = v;
  }

  function focusPassword() {
    fieldRef.current = "password";
    setField("password");
  }

  function focusUsername() {
    fieldRef.current = "username";
    setField("username");
  }

  function attemptLogin(user: string, pass: string) {
    if (loadingRef.current) return;
    const u = user.trim();
    const p = pass;
    if (!u || !p) {
      setError("Username and password are required.");
      return;
    }
    loadingRef.current = true;
    setLoading(true);
    setError("");
    login(u, p)
      .then((result) => {
        if (!result) {
          setError("Invalid username or password.");
          loadingRef.current = false;
          setLoading(false);
          return;
        }
        saveSession(result.token);
        onLogin(result.user);
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        const looksNetwork =
          /fetch|network|ECONNREFUSED|ENOTFOUND|ETIMEDOUT|TLS|SSL/i.test(msg);
        setError(
          looksNetwork
            ? `Connection error. Check API server and network. ${msg}`
            : `API error: ${msg}`,
        );
        loadingRef.current = false;
        setLoading(false);
      });
  }

  useInput((_, key) => {
    if (loadingRef.current) return;

    if (key.tab || key.downArrow) {
      if (fieldRef.current === "username") focusPassword();
      else focusUsername();
      return;
    }

    if (key.upArrow) {
      if (fieldRef.current === "password") focusUsername();
      else focusPassword();
      return;
    }
  });

  if (loading) {
    return (
      <Box flexDirection="column" padding={2} alignItems="center" width="100%">
        <Title />
        <Loader label="Signing in..." />
      </Box>
    );
  }

  return (
    <Box flexDirection="column" padding={2} width="100%">
      <Title />

      <Box flexDirection="column" alignItems="center" width="100%">
        <Box
          flexDirection="column"
          borderStyle="round"
          borderColor={BORDER_SUBTLE}
          padding={1}
          width={formWidth}
        >
          <Box marginBottom={1} justifyContent="center" borderStyle="single" borderColor={SURFACE_PANEL_ALT} paddingX={1}>
            <Text bold color={FOCUS}>
              Sign In
            </Text>
          </Box>

          <Box flexDirection="column" gap={1}>
            <Box flexDirection="column">
              <Text color={field === "username" ? FOCUS : TEXT_MUTED} bold={field === "username"}>
                Username
              </Text>
              <Box>
                <Text color={ACCENT_SOFT}>› </Text>
                <TextInput
                  value={username}
                  onChange={syncUsername}
                  focus={field === "username"}
                  placeholder="enter username"
                  onSubmit={() => focusPassword()}
                />
              </Box>
            </Box>

            <Box flexDirection="column">
              <Text color={field === "password" ? FOCUS : TEXT_MUTED} bold={field === "password"}>
                Password
              </Text>
              <Box>
                <Text color={ACCENT_SOFT}>› </Text>
                <TextInput
                  value={password}
                  onChange={syncPassword}
                  focus={field === "password"}
                  mask="*"
                  placeholder="enter password"
                  onSubmit={(val) => attemptLogin(usernameRef.current, val)}
                />
              </Box>
            </Box>
          </Box>

          {error && (
            <Box marginTop={1}>
              <Text color={ERROR}>{error}</Text>
            </Box>
          )}

          <Box marginTop={1} justifyContent="center">
            <Text color={TEXT_DIM} dimColor>
              [Tab] switch field  [Enter] confirm
            </Text>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
