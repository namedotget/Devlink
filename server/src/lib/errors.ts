export type AppErrorCode = "FORBIDDEN" | "NOT_FOUND" | "BAD_REQUEST";

export type AppError = Error & {
  code?: AppErrorCode;
};

export function createAppError(code: AppErrorCode, message: string): AppError {
  const error = new Error(message) as AppError;
  error.code = code;
  return error;
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof Error && typeof (error as AppError).code === "string";
}

export function statusCodeFromError(error: unknown): number {
  if (!isAppError(error)) return 500;
  if (error.code === "FORBIDDEN") return 403;
  if (error.code === "NOT_FOUND") return 404;
  if (error.code === "BAD_REQUEST") return 400;
  return 500;
}
