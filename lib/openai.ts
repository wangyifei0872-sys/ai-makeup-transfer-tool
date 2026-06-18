import OpenAI from "openai";
import { ProxyAgent, fetch as undiciFetch } from "undici";
import { AppApiError } from "@/lib/analyzeErrors";

type OpenAIClientOptions = {
  apiKey?: string | null;
  baseUrl?: string | null;
  proxyUrl?: string | null;
};

function isPlaceholderApiKey(apiKey: string) {
  return apiKey.includes("你的 OpenAI API Key");
}

export function resolveOpenAIApiKey(apiKeyFromHeader?: string | null) {
  const headerKey = apiKeyFromHeader?.trim();

  if (headerKey) {
    return headerKey;
  }

  const envKey = process.env.OPENAI_API_KEY?.trim();

  if (envKey && !isPlaceholderApiKey(envKey)) {
    return envKey;
  }

  return "";
}

export function resolveOpenAIBaseUrl(baseUrlFromHeader?: string | null) {
  return baseUrlFromHeader?.trim() || process.env.OPENAI_BASE_URL?.trim() || "";
}

export function validateOpenAIBaseUrl(baseUrl: string) {
  const trimmed = baseUrl.trim();

  if (!trimmed) {
    return "";
  }

  let parsed: URL;

  try {
    parsed = new URL(trimmed);
  } catch {
    throw new AppApiError(
      "INVALID_OPENAI_BASE_URL",
      "OpenAI Base URL / 中转地址格式不正确，请填写类似 https://your-company-relay.com/v1 的地址。",
      `Invalid OpenAI base URL parse failure. Value length: ${trimmed.length}`
    );
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new AppApiError(
      "INVALID_OPENAI_BASE_URL",
      "OpenAI Base URL / 中转地址格式不正确，仅支持 http:// 或 https://。",
      `Unsupported OpenAI base URL protocol: ${parsed.protocol || "(empty)"}`
    );
  }

  return trimmed;
}

function getEnvProxyUrl() {
  return (
    process.env.OPENAI_PROXY_URL?.trim() ||
    process.env.HTTPS_PROXY?.trim() ||
    process.env.HTTP_PROXY?.trim() ||
    ""
  );
}

export function resolveOpenAIProxyUrl(proxyUrlFromHeader?: string | null) {
  return proxyUrlFromHeader?.trim() || getEnvProxyUrl();
}

export function validateProxyUrl(proxyUrl: string) {
  const trimmed = proxyUrl.trim();

  if (!trimmed) {
    return "";
  }

  let parsed: URL;

  try {
    parsed = new URL(trimmed);
  } catch {
    throw new AppApiError(
      "INVALID_PROXY_URL",
      "代理地址格式不正确，请使用类似 http://127.0.0.1:7890 的格式。目前仅支持 http:// 或 https:// 代理。",
      `Invalid proxy URL parse failure. Value length: ${trimmed.length}`
    );
  }

  if (parsed.protocol === "socks5:") {
    throw new AppApiError(
      "INVALID_PROXY_URL",
      "代理地址格式不正确，请使用类似 http://127.0.0.1:7890 的格式。目前仅支持 http:// 或 https:// 代理。",
      "Unsupported proxy protocol: socks5. undici ProxyAgent is configured here for http/https proxy URLs only."
    );
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new AppApiError(
      "INVALID_PROXY_URL",
      "代理地址格式不正确，请使用类似 http://127.0.0.1:7890 的格式。目前仅支持 http:// 或 https:// 代理。",
      `Unsupported proxy protocol: ${parsed.protocol || "(empty)"}`
    );
  }

  return trimmed;
}

export function createOpenAIClient({ apiKey, baseUrl, proxyUrl }: OpenAIClientOptions) {
  const resolvedApiKey = resolveOpenAIApiKey(apiKey);

  if (!resolvedApiKey) {
    throw new Error("MISSING_OPENAI_API_KEY");
  }

  const resolvedBaseUrl = validateOpenAIBaseUrl(resolveOpenAIBaseUrl(baseUrl));
  const resolvedProxyUrl = validateProxyUrl(resolveOpenAIProxyUrl(proxyUrl));
  const clientOptions: ConstructorParameters<typeof OpenAI>[0] = {
    apiKey: resolvedApiKey
  };

  if (resolvedBaseUrl) {
    clientOptions.baseURL = resolvedBaseUrl;
  }

  if (!resolvedProxyUrl) {
    return new OpenAI(clientOptions);
  }

  const dispatcher = new ProxyAgent(resolvedProxyUrl);
  const proxyFetch: typeof fetch = (url, init) =>
    undiciFetch(url as Parameters<typeof undiciFetch>[0], {
      ...(init as Parameters<typeof undiciFetch>[1]),
      dispatcher
    } as Parameters<typeof undiciFetch>[1]) as unknown as ReturnType<typeof fetch>;

  return new OpenAI({
    ...clientOptions,
    fetch: proxyFetch
  });
}

export function getOpenAIClient(apiKeyFromHeader?: string | null, proxyUrlFromHeader?: string | null) {
  return createOpenAIClient({
    apiKey: apiKeyFromHeader,
    proxyUrl: proxyUrlFromHeader
  });
}

export function getReasoningModel(modelFromHeader?: string | null) {
  return modelFromHeader?.trim() || process.env.OPENAI_REASONING_MODEL?.trim() || "gpt-5.5";
}

export function getResolvedOpenAIConfig({
  apiKey,
  baseUrl,
  proxyUrl,
  model
}: OpenAIClientOptions & { model?: string | null }) {
  return {
    hasApiKey: Boolean(resolveOpenAIApiKey(apiKey)),
    baseUrl: validateOpenAIBaseUrl(resolveOpenAIBaseUrl(baseUrl)),
    proxyUrl: validateProxyUrl(resolveOpenAIProxyUrl(proxyUrl)),
    model: getReasoningModel(model)
  };
}
