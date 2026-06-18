import {
  APIConnectionError,
  APIConnectionTimeoutError,
  APIError,
  AuthenticationError,
  NotFoundError,
  PermissionDeniedError
} from "openai";
import { AppApiError, type AnalyzeApiError } from "@/lib/analyzeErrors";
import { getReasoningModel } from "@/lib/openai";

export function sanitizeDebugText(value: string) {
  return value
    .replace(/sk-[^\s"',;:]+/g, "sk-****")
    .replace(/AIza[^\s"',;:]+/g, "AIza****");
}

function getErrorStatus(error: unknown) {
  if (error instanceof APIError) {
    return error.status;
  }

  if (typeof error === "object" && error !== null && "status" in error) {
    return (error as { status?: number }).status;
  }

  return undefined;
}

function getErrorDebug(error: unknown) {
  if (error instanceof Error) {
    const cause =
      typeof error.cause === "object" && error.cause !== null
        ? `; cause=${sanitizeDebugText(JSON.stringify(error.cause, Object.getOwnPropertyNames(error.cause)))}`
        : "";

    return sanitizeDebugText(`${error.name}: ${error.message}${cause}`);
  }

  return "Unknown non-Error value thrown.";
}

export function toOpenAIApiError(error: unknown, fallbackMessage: string): AnalyzeApiError {
  if (error instanceof AppApiError) {
    return {
      message: error.message,
      code: error.code,
      debug: sanitizeDebugText(error.debug)
    };
  }

  const message = error instanceof Error ? error.message : "";
  const status = getErrorStatus(error);
  const debug = [
    `status=${status ?? "none"}`,
    `model=${getReasoningModel()}`,
    getErrorDebug(error)
  ].join("; ");

  if (/MISSING_OPENAI_API_KEY/i.test(message)) {
    return {
      code: "MISSING_OPENAI_API_KEY",
      message: "缺少 OpenAI API Key，请在右上角设置中填写。",
      debug
    };
  }

  if (/INVALID_OPENAI_BASE_URL/i.test(message)) {
    return {
      code: "INVALID_OPENAI_BASE_URL",
      message: "OpenAI Base URL / 中转地址格式不正确，请填写类似 https://your-company-relay.com/v1 的地址。",
      debug
    };
  }

  if (/INVALID_PROXY_URL/i.test(message)) {
    return {
      code: "INVALID_PROXY_URL",
      message: "代理地址格式不正确，请使用类似 http://127.0.0.1:7890 的格式。目前仅支持 http:// 或 https:// 代理。",
      debug
    };
  }

  if (error instanceof AuthenticationError || status === 401) {
    return {
      code: "OPENAI_AUTH_FAILED",
      message: "API Key 无效，或当前 Key 不适用于这个中转地址。",
      debug
    };
  }

  if (error instanceof PermissionDeniedError || status === 403) {
    return {
      code: "OPENAI_PERMISSION_DENIED",
      message: "当前 OpenAI API Key 没有访问该模型的权限，或账户权限不足。",
      debug
    };
  }

  if (error instanceof NotFoundError || status === 404) {
    return {
      code: "OPENAI_MODEL_NOT_FOUND",
      message: "模型不存在或接口路径不正确。请检查模型名和 Base URL 是否正确。",
      debug
    };
  }

  if (status === 413) {
    return {
      code: "REQUEST_TOO_LARGE",
      message: "上传图片太大，请先压缩图片或降低图片尺寸。",
      debug
    };
  }

  if (error instanceof APIConnectionTimeoutError || /timeout|timed out|etimedout/i.test(message)) {
    return {
      code: "OPENAI_TIMEOUT",
      message: "OpenAI API 请求超时，请稍后重试，或检查网络代理。",
      debug
    };
  }

  if (
    error instanceof APIConnectionError ||
    /connection error|fetch failed|network|econnreset|enotfound|econnrefused|etimedout/i.test(message)
  ) {
    return {
      code: "OPENAI_RELAY_CONNECTION_FAILED",
      message:
        "无法连接 OpenAI 或中转服务。请检查 OpenAI Base URL / 中转地址是否正确，是否需要以 /v1 结尾，以及网络是否可访问。",
      debug
    };
  }

  if (error instanceof APIError) {
    return {
      code: "OPENAI_API_ERROR",
      message: "OpenAI API 返回错误，请稍后重试或检查请求参数。",
      debug
    };
  }

  return {
    code: "OPENAI_UNKNOWN_ERROR",
    message: fallbackMessage,
    debug
  };
}
