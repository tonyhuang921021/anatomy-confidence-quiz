export type LaoZhaoLocalErrorCode =
  | "unavailable"
  | "private-mode"
  | "quota"
  | "blocked"
  | "not-found"
  | "invalid-data"
  | "operation-failed";

export type LaoZhaoLocalOperation =
  | "open"
  | "read"
  | "write"
  | "delete"
  | "export"
  | "clear";

export class LaoZhaoLocalError extends Error {
  readonly code: LaoZhaoLocalErrorCode;
  readonly operation: LaoZhaoLocalOperation;
  readonly cause?: unknown;

  constructor(
    code: LaoZhaoLocalErrorCode,
    operation: LaoZhaoLocalOperation,
    message: string,
    cause?: unknown
  ) {
    super(message);
    this.name = "LaoZhaoLocalError";
    this.code = code;
    this.operation = operation;
    this.cause = cause;
  }
}

function getErrorName(error: unknown) {
  if (typeof error === "object" && error !== null && "name" in error) {
    const name = (error as { name?: unknown }).name;
    return typeof name === "string" ? name : "";
  }
  return "";
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: unknown }).message;
    return typeof message === "string" ? message : "";
  }
  return String(error ?? "");
}

export function mapLaoZhaoStorageError(
  error: unknown,
  operation: LaoZhaoLocalOperation
): LaoZhaoLocalError {
  if (error instanceof LaoZhaoLocalError) return error;

  const name = getErrorName(error);
  const message = getErrorMessage(error);
  const lowerMessage = message.toLowerCase();

  if (name === "QuotaExceededError" || lowerMessage.includes("quota")) {
    return new LaoZhaoLocalError(
      operation === "open" ? "private-mode" : "quota",
      operation,
      operation === "open"
        ? "瀏覽器拒絕啟用本機資料庫，可能是 Safari 私密瀏覽模式或本機儲存空間限制。"
        : "本機資料庫空間不足，這次資料沒有成功保存。",
      error
    );
  }

  if (operation === "open" && (name === "InvalidStateError" || name === "UnknownError")) {
    return new LaoZhaoLocalError(
      "private-mode",
      operation,
      "瀏覽器無法建立本機資料庫，可能是 Safari 私密瀏覽模式。",
      error
    );
  }

  if (name === "SecurityError" || name === "NotSupportedError" || name === "NotAllowedError") {
    return new LaoZhaoLocalError(
      "unavailable",
      operation,
      "這個瀏覽器目前不允許使用本機資料庫。",
      error
    );
  }

  if (name === "AbortError" && operation === "open") {
    return new LaoZhaoLocalError(
      "blocked",
      operation,
      "本機資料庫開啟被瀏覽器中止，請重新載入頁面後再試。",
      error
    );
  }

  return new LaoZhaoLocalError(
    "operation-failed",
    operation,
    "本機學習紀錄操作失敗，原有資料未以較短紀錄覆蓋。",
    error
  );
}

export function createLaoZhaoInvalidDataError(
  message: string,
  operation: LaoZhaoLocalOperation = "write"
) {
  return new LaoZhaoLocalError("invalid-data", operation, message);
}

export function createLaoZhaoNotFoundError(
  entity: "書籤" | "筆記",
  id: string
) {
  return new LaoZhaoLocalError(
    "not-found",
    "write",
    `找不到要修改的${entity}（${id}）。`
  );
}
