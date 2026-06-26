import { AppApiError, type AnalyzeApiError } from "@/lib/analyzeErrors";
import { FIXED_IMAGE_MODEL } from "@/lib/imageModels";
import type { OriginalAspect, OutputResolution } from "@/lib/mock";

const REQUEST_TIMEOUT_MS = 50000;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const SUPPORTED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

type ImageRelaySettings = {
  makeupIntensity: string;
  editArea: string;
  preserveLevel: string;
  outputCount: number;
  outputResolution: OutputResolution;
  originalAspect: OriginalAspect;
};

type GenerateViaRelayOptions = {
  apiKey?: string | null;
  baseUrl?: string | null;
  originalImageFile: File;
  referenceImageFile: File;
  nanoPrompt: string;
  negativePrompt: string;
  settings: ImageRelaySettings;
  variationIndex: number;
  requestTimeoutMs?: number;
};

type RelayImageResult = {
  dataUrl: string;
  mimeType: string;
};

type ImageGenerationRequest = {
  apiKey?: string | null;
  baseUrl?: string | null;
  actualModelName: string;
  outputResolution: OutputResolution;
  requestTimeoutMs?: number;
  retryOnProhibited?: boolean;
  safetyRetryPrompt?: string;
  content: Array<
    | {
        type: "text";
        text: string;
      }
    | {
        type: "image_url";
        image_url: {
          url: string;
        };
      }
  >;
};

function sanitizeDebugText(value: string) {
  return value
    .replace(/Bearer\s+[^\s"',;:]+/gi, "Bearer ****")
    .replace(/sk-[^\s"',;:]+/g, "sk-****")
    .replace(/AIza[^\s"',;:]+/g, "AIza****");
}

function getApiKey(apiKey?: string | null) {
  const trimmed = apiKey?.trim() ?? "";

  if (!trimmed) {
    throw new AppApiError(
      "MISSING_RELAY_API_KEY",
      "缺少 API Key，请在设置中填写。",
      "No relayApiKey value was provided."
    );
  }

  return trimmed;
}

export function normalizeRelayBaseUrl(baseUrl?: string | null) {
  const trimmed = baseUrl?.trim() ?? "";

  if (!trimmed) {
    throw new AppApiError(
      "MISSING_RELAY_BASE_URL",
      "缺少 Base URL / 中转地址，请在设置中填写。",
      "No relayBaseUrl value was provided."
    );
  }

  let parsed: URL;

  try {
    parsed = new URL(trimmed);
  } catch {
    throw new AppApiError(
      "INVALID_RELAY_BASE_URL",
      "Base URL / 中转地址格式不正确，请检查固定中转地址配置。",
      `Invalid relay base URL parse failure. Value length: ${trimmed.length}`
    );
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new AppApiError(
      "INVALID_RELAY_BASE_URL",
      "Base URL / 中转地址格式不正确，仅支持 http:// 或 https://。",
      `Unsupported relay base URL protocol: ${parsed.protocol || "(empty)"}`
    );
  }

  if (
    parsed.hostname.toLowerCase() === "openrouter.ai" &&
    !/^\/api\/v1(?:\/chat\/completions)?\/?$/i.test(parsed.pathname)
  ) {
    throw new AppApiError(
      "INVALID_RELAY_BASE_URL",
      "固定中转地址配置不正确，请检查 Base URL。",
      `OpenRouter model page URL was provided instead of API base URL. Path: ${parsed.pathname}`
    );
  }

  return trimmed.replace(/\/+$/, "").replace(/\/chat\/completions$/i, "");
}

function getChatCompletionsUrl(baseUrl?: string | null) {
  return `${normalizeRelayBaseUrl(baseUrl)}/chat/completions`;
}

function assertSupportedImage(file: File, fieldName: string) {
  if (!SUPPORTED_IMAGE_TYPES.has(file.type)) {
    throw new AppApiError(
      "UNSUPPORTED_IMAGE_FORMAT",
      "图片格式不支持，请上传 PNG、JPG/JPEG 或 WebP 图片。",
      `Unsupported image MIME type for ${fieldName}: ${file.type || "(empty)"}`
    );
  }

  if (file.size > MAX_IMAGE_BYTES) {
    throw new AppApiError(
      "REQUEST_TOO_LARGE",
      "上传图片太大，请先压缩图片或降低图片尺寸。",
      `Image too large for ${fieldName}: ${file.size} bytes. Limit: ${MAX_IMAGE_BYTES} bytes.`
    );
  }
}

async function fileToDataUrl(file: File, fieldName: string) {
  assertSupportedImage(file, fieldName);
  const buffer = Buffer.from(await file.arrayBuffer());
  return `data:${file.type};base64,${buffer.toString("base64")}`;
}

function buildFinalPrompt({
  nanoPrompt,
  negativePrompt,
  variationIndex
}: Pick<GenerateViaRelayOptions, "nanoPrompt" | "negativePrompt" | "variationIndex">) {
  return `This is a non-sexual cosmetic makeup transfer task on an adult stylized female portrait illustration.
Focus only on face makeup editing.
Do not change body, clothing, pose, skin exposure, or background.
Use the first image as the original base stylized portrait illustration.
Use the second image only as the fashion makeup reference.
Apply the cosmetic makeup style from the reference image to the adult female character in the original illustration.
Preserve the original identity, face shape, eye shape, facial proportions, hairstyle, expression, pose, composition, art style, lighting, brightness, contrast, saturation and background.
Only modify makeup-related areas: eye makeup, eyebrow tone, cheek blush, lip color and subtle lip highlight, facial highlights and eye color if requested.
Keep the output in the same aspect ratio as the original image.
Do not crop the face incorrectly.
Do not stretch or squash the image.
Do not make the image sexualized.
Do not alter clothing or body.
Do not increase skin exposure.
Do not change the age of the character.
Do not make the character look younger.
Only edit cosmetic makeup on the face.
Do not add text.
Do not redesign the character.
Do not distort the eyes, nose, lips or face.

Main instruction:
${nanoPrompt}

Negative rules:
${negativePrompt}

Variation index:
${variationIndex}`;
}

function buildSaferPrompt({ variationIndex }: Pick<GenerateViaRelayOptions, "variationIndex">) {
  return `This is a safe, non-sexual face makeup editing task for an adult stylized portrait illustration.
Use the first image as the base portrait.
Use the second image only as a cosmetic makeup reference.
Only adjust eye makeup, cheek blush, eyebrow tone, and lip color.
Preserve the adult character identity, face shape, facial proportions, hairstyle, expression, clothing, pose, background, art style, lighting, brightness, contrast, and saturation.
Do not alter the body, clothing, shoulders, neckline, skin exposure, or age.
Do not sexualize the character.
Do not add text.
Keep the output in the same aspect ratio as the original image.
Do not crop the face incorrectly.
Do not stretch or squash the image.
Return only the edited portrait image.

Variation index:
${variationIndex}`;
}

function normalizeImageUrl(value: string): RelayImageResult | null {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  const dataUrlMatch = trimmed.match(/data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)/);

  if (dataUrlMatch) {
    return {
      dataUrl: `data:${dataUrlMatch[1]};base64,${dataUrlMatch[2].replace(/\s/g, "")}`,
      mimeType: dataUrlMatch[1]
    };
  }

  if (/^[A-Za-z0-9+/=\s]+$/.test(trimmed) && trimmed.length > 100) {
    return {
      dataUrl: `data:image/png;base64,${trimmed.replace(/\s/g, "")}`,
      mimeType: "image/png"
    };
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return {
      dataUrl: trimmed,
      mimeType: "image/png"
    };
  }

  return null;
}

function getNestedImageUrl(value: unknown): string | null {
  if (typeof value === "string") {
    return value;
  }

  if (typeof value !== "object" || value === null) {
    return null;
  }

  const record = value as Record<string, unknown>;

  if (typeof record.url === "string") {
    return record.url;
  }

  if (typeof record.b64_json === "string") {
    return record.b64_json;
  }

  if (typeof record.image_url === "string") {
    return record.image_url;
  }

  if (typeof record.imageUrl === "string") {
    return record.imageUrl;
  }

  if (record.image_url) {
    return getNestedImageUrl(record.image_url);
  }

  if (record.imageUrl) {
    return getNestedImageUrl(record.imageUrl);
  }

  return null;
}

function parseContentForImage(content: unknown): RelayImageResult | null {
  if (typeof content === "string") {
    return normalizeImageUrl(content);
  }

  if (!Array.isArray(content)) {
    return null;
  }

  for (const part of content) {
    const imageUrl = getNestedImageUrl(part);

    if (imageUrl) {
      const parsed = normalizeImageUrl(imageUrl);

      if (parsed) {
        return parsed;
      }
    }
  }

  return null;
}

function getFinishReasonText(payload: unknown) {
  const response = payload as Record<string, unknown>;
  const choices = Array.isArray(response.choices) ? response.choices : [];
  const firstChoice = choices[0] as Record<string, unknown> | undefined;
  const values = [
    firstChoice?.native_finish_reason,
    firstChoice?.finish_reason,
    firstChoice?.finishReason,
    firstChoice?.stop_reason,
    firstChoice?.message
  ];

  return sanitizeDebugText(JSON.stringify(values));
}

function isProhibitedContentResponse(payload: unknown) {
  const text = sanitizeDebugText(JSON.stringify(payload));
  const finishText = getFinishReasonText(payload);

  return (
    /IMAGE_PROHIBITED_CONTENT/i.test(text) ||
    /prohibited|safety|blocked/i.test(finishText)
  );
}

export function parseRelayImageResponse(payload: unknown): RelayImageResult {
  if (isProhibitedContentResponse(payload)) {
    throw new AppApiError(
      "IMAGE_PROHIBITED_CONTENT",
      "生图模型因安全策略拒绝生成图片。请尝试使用更安全的原图、减少暴露肩颈区域，或使用更中性的妆容描述。",
      `Image generation blocked by model safety policy. Finish reason: ${getFinishReasonText(payload)}`
    );
  }

  const response = payload as Record<string, unknown>;
  const choices = Array.isArray(response.choices) ? response.choices : [];
  const firstChoice = choices[0] as Record<string, unknown> | undefined;
  const message =
    typeof firstChoice?.message === "object" && firstChoice.message !== null
      ? (firstChoice.message as Record<string, unknown>)
      : null;

  const messageImages = Array.isArray(message?.images) ? message.images : [];
  const firstMessageImage = messageImages[0];
  const messageImageUrl = getNestedImageUrl(firstMessageImage);

  if (messageImageUrl) {
    const parsed = normalizeImageUrl(messageImageUrl);

    if (parsed) {
      return parsed;
    }
  }

  const contentImage = parseContentForImage(message?.content);

  if (contentImage) {
    return contentImage;
  }

  const data = Array.isArray(response.data) ? response.data : [];
  const firstData = data[0];
  const dataImageUrl = getNestedImageUrl(firstData);

  if (dataImageUrl) {
    const parsed = normalizeImageUrl(dataImageUrl);

    if (parsed) {
      return parsed;
    }
  }

  throw new AppApiError(
    "IMAGE_RELAY_NO_IMAGE",
    "生图接口没有返回可识别的图片，请检查模型是否支持 image output。",
    `Unable to find image in relay response. Preview: ${sanitizeDebugText(JSON.stringify(payload)).slice(0, 1000)}`
  );
}

async function readResponseDebug(response: Response) {
  const text = await response.text().catch(() => "");
  return sanitizeDebugText(text).slice(0, 1000);
}

export async function requestOpenRouterImageGeneration({
  apiKey,
  baseUrl,
  actualModelName,
  outputResolution,
  requestTimeoutMs,
  retryOnProhibited,
  safetyRetryPrompt,
  content
}: ImageGenerationRequest) {
  const resolvedApiKey = getApiKey(apiKey);
  const url = getChatCompletionsUrl(baseUrl);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), requestTimeoutMs ?? REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resolvedApiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: actualModelName,
        messages: [
          {
            role: "user",
            content
          }
        ],
        modalities: ["image", "text"],
        image_config: {
          image_size: outputResolution
        },
        stream: false
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      const responseDebug = await readResponseDebug(response);
      const debug = [
        `status=${response.status}`,
        `statusText=${response.statusText}`,
        `url=${url}`,
        `model=${actualModelName}`,
        `body=${responseDebug}`
      ].join("; ");

      if (/IMAGE_PROHIBITED_CONTENT|prohibited|safety|blocked/i.test(responseDebug)) {
        throw new AppApiError(
          "IMAGE_PROHIBITED_CONTENT",
          "生图模型因安全策略拒绝生成图片。请尝试使用更安全的原图、减少暴露肩颈区域，或使用更中性的妆容描述。",
          debug
        );
      }

      if (response.status === 401 || response.status === 403) {
        throw new AppApiError(
          "IMAGE_MODEL_AUTH_FAILED",
          "生图模型认证失败，请检查 API Key 是否正确，或该 Key 是否适用于当前 Base URL。",
          debug
        );
      }

      if (response.status === 404) {
        throw new AppApiError(
          "IMAGE_MODEL_NOT_FOUND",
          "生图模型不存在或接口路径不正确，请检查固定中转地址配置。",
          debug
        );
      }

      throw new AppApiError(
        "IMAGE_RELAY_CONNECTION_FAILED",
        "生图中转请求失败，请检查 Base URL、API Key 和当前生图模型。",
        debug
      );
    }

    const payload = await response.json();

    try {
      return parseRelayImageResponse(payload);
    } catch (error) {
      if (
        retryOnProhibited &&
        error instanceof AppApiError &&
        error.code === "IMAGE_PROHIBITED_CONTENT"
      ) {
        const textPart = content.find((part) => part.type === "text");
        const imageParts = content.filter((part) => part.type === "image_url");
        const saferContent =
          textPart && imageParts.length > 0
            ? [
                {
                  type: "text" as const,
                  text: safetyRetryPrompt ?? buildSaferPrompt({ variationIndex: 1 })
                },
                ...imageParts
              ]
            : content;

        return requestOpenRouterImageGeneration({
          apiKey,
          baseUrl,
          actualModelName,
          outputResolution,
          requestTimeoutMs,
          retryOnProhibited: false,
          safetyRetryPrompt,
          content: saferContent
        });
      }

      throw error;
    }
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function generateNanoBananaRelayImage({
  apiKey,
  baseUrl,
  originalImageFile,
  referenceImageFile,
  nanoPrompt,
  negativePrompt,
  settings,
  variationIndex,
  requestTimeoutMs
}: GenerateViaRelayOptions) {
  const [originalImageDataUrl, referenceImageDataUrl] = await Promise.all([
    fileToDataUrl(originalImageFile, "originalImage"),
    fileToDataUrl(referenceImageFile, "referenceImage")
  ]);

  return requestOpenRouterImageGeneration({
    apiKey,
    baseUrl,
    actualModelName: FIXED_IMAGE_MODEL.model,
    outputResolution: settings.outputResolution,
    requestTimeoutMs,
    retryOnProhibited: true,
    safetyRetryPrompt: buildSaferPrompt({ variationIndex }),
    content: [
      {
        type: "text",
        text: buildFinalPrompt({
          nanoPrompt,
          negativePrompt,
          variationIndex
        })
      },
      {
        type: "image_url",
        image_url: {
          url: originalImageDataUrl
        }
      },
      {
        type: "image_url",
        image_url: {
          url: referenceImageDataUrl
        }
      }
    ]
  });
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

export function toBananaRelayApiError(error: unknown): AnalyzeApiError {
  if (error instanceof AppApiError) {
    return {
      code: error.code,
      message: error.message,
      debug: sanitizeDebugText(error.debug)
    };
  }

  if (error instanceof Error && error.name === "AbortError") {
    return {
      code: "IMAGE_RELAY_TIMEOUT",
      message: "生图请求超时。请尝试选择 1K、输出 1 张，或上传更小的图片。",
      debug: "AbortController timed out while calling image relay generation."
    };
  }

  const message = error instanceof Error ? error.message : "";
  const debug = getErrorDebug(error);

  if (/timeout|timed out|etimedout/i.test(message)) {
    return {
      code: "IMAGE_RELAY_TIMEOUT",
      message: "生图请求超时。请尝试选择 1K、输出 1 张，或上传更小的图片。",
      debug
    };
  }

  if (/fetch failed|network|connection|econnreset|enotfound|econnrefused/i.test(message)) {
    return {
      code: "IMAGE_RELAY_CONNECTION_FAILED",
      message: "生图中转连接失败，请检查 Base URL、API Key 和当前生图模型。",
      debug
    };
  }

  return {
    code: "IMAGE_RELAY_CONNECTION_FAILED",
    message: "生图中转连接失败，请检查 Base URL、API Key 和当前生图模型。",
    debug
  };
}
