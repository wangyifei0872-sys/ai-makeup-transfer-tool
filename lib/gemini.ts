import {
  ApiError,
  createPartFromBase64,
  createPartFromText,
  createUserContent,
  GoogleGenAI,
  Modality
} from "@google/genai";
import { AppApiError, type AnalyzeApiError } from "@/lib/analyzeErrors";

export const NANO_BANANA_MODEL_ID = "gemini-3.1-flash-image";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const SUPPORTED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

type GenerateMakeupImageOptions = {
  originalImageFile: File;
  referenceImageFile: File;
  nanoPrompt: string;
  negativePrompt: string;
  settings: {
    makeupIntensity: string;
    editArea: string;
    preserveLevel: string;
    outputCount: number;
  };
  variationIndex: number;
  apiKey?: string | null;
};

function isPlaceholderGoogleApiKey(apiKey: string) {
  return apiKey.includes("你的 Google API Key");
}

function sanitizeDebugText(value: string) {
  return value
    .replace(/sk-[^\s"',;:]+/g, "sk-****")
    .replace(/AIza[^\s"',;:]+/g, "AIza****");
}

export function resolveGoogleApiKey(apiKeyFromHeader?: string | null) {
  const headerKey = apiKeyFromHeader?.trim();

  if (headerKey) {
    return headerKey;
  }

  const envKey = process.env.GOOGLE_API_KEY?.trim();

  if (envKey && !isPlaceholderGoogleApiKey(envKey)) {
    return envKey;
  }

  return "";
}

export function createGoogleGenAIClient(apiKeyFromHeader?: string | null) {
  const apiKey = resolveGoogleApiKey(apiKeyFromHeader);

  if (!apiKey) {
    throw new AppApiError(
      "MISSING_GOOGLE_API_KEY",
      "缺少 Google API Key，请在右上角设置中填写。",
      "No Google API key was provided from request header or GOOGLE_API_KEY env fallback."
    );
  }

  return new GoogleGenAI({ apiKey });
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
      "GOOGLE_REQUEST_TOO_LARGE",
      "上传图片太大，请先压缩图片或降低图片尺寸。",
      `Image too large for ${fieldName}: ${file.size} bytes. Limit: ${MAX_IMAGE_BYTES} bytes.`
    );
  }
}

async function fileToBase64(file: File) {
  const buffer = Buffer.from(await file.arrayBuffer());
  return buffer.toString("base64");
}

function buildNanoBananaPrompt({
  nanoPrompt,
  negativePrompt,
  variationIndex
}: {
  nanoPrompt: string;
  negativePrompt: string;
  variationIndex: number;
}) {
  return `You are editing the original illustration using the makeup reference image.

Use the first image as the original base illustration.
Use the second image only as the makeup style reference.

Main instruction:
${nanoPrompt}

Negative rules:
${negativePrompt}

Important rules:
- Preserve the original character identity.
- Preserve the original face shape, eye shape, lip shape, hairstyle, expression, pose, composition, art style, line quality, lighting, brightness, contrast, and saturation.
- Only modify makeup-related areas.
- Do not change the background.
- Do not add text.
- Do not redesign the character.
- Do not distort the eyes, nose, lips, or face.
- Return only the edited image.

Variation index:
${variationIndex}`;
}

export async function generateMakeupImage({
  originalImageFile,
  referenceImageFile,
  nanoPrompt,
  negativePrompt,
  variationIndex,
  apiKey
}: GenerateMakeupImageOptions) {
  assertSupportedImage(originalImageFile, "originalImage");
  assertSupportedImage(referenceImageFile, "referenceImage");

  const ai = createGoogleGenAIClient(apiKey);
  const [originalImageBase64, referenceImageBase64] = await Promise.all([
    fileToBase64(originalImageFile),
    fileToBase64(referenceImageFile)
  ]);

  const response = await ai.models.generateContent({
    model: NANO_BANANA_MODEL_ID,
    contents: createUserContent([
      createPartFromBase64(originalImageBase64, originalImageFile.type),
      createPartFromBase64(referenceImageBase64, referenceImageFile.type),
      createPartFromText(
        buildNanoBananaPrompt({
          nanoPrompt,
          negativePrompt,
          variationIndex
        })
      )
    ]),
    config: {
      responseModalities: [Modality.IMAGE]
    }
  });

  const imagePart = response.candidates?.[0]?.content?.parts?.find((part) => part.inlineData);
  const imageBase64 = imagePart?.inlineData?.data ?? response.data ?? "";
  const mimeType = imagePart?.inlineData?.mimeType ?? "image/png";

  if (!imageBase64) {
    throw new AppApiError(
      "NANO_BANANA_NO_IMAGE",
      "Nano Banana 2 没有返回图片，请稍后重试或调整提示词。",
      `No inline image data returned. Text preview: ${sanitizeDebugText(response.text ?? "").slice(0, 500)}`
    );
  }

  return {
    imageBase64,
    mimeType
  };
}

function getErrorStatus(error: unknown) {
  if (error instanceof ApiError) {
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

export function toGoogleApiError(error: unknown): AnalyzeApiError {
  if (error instanceof AppApiError) {
    return {
      message: error.message,
      code: error.code,
      debug: sanitizeDebugText(error.debug)
    };
  }

  const status = getErrorStatus(error);
  const message = error instanceof Error ? error.message : "";
  const debug = [`status=${status ?? "none"}`, `model=${NANO_BANANA_MODEL_ID}`, getErrorDebug(error)].join(
    "; "
  );

  if (/MISSING_GOOGLE_API_KEY/i.test(message)) {
    return {
      code: "MISSING_GOOGLE_API_KEY",
      message: "缺少 Google API Key，请在右上角设置中填写。",
      debug
    };
  }

  if (status === 401 || /api key not valid|invalid api key|unauthorized/i.test(message)) {
    return {
      code: "GOOGLE_AUTH_FAILED",
      message: "Google API Key 无效或已失效，请检查 key 是否复制完整。",
      debug
    };
  }

  if (status === 403 || /permission|forbidden|denied/i.test(message)) {
    return {
      code: "GOOGLE_PERMISSION_DENIED",
      message: "当前 Google API Key 没有访问 Nano Banana 2 的权限，或账户权限不足。",
      debug
    };
  }

  if (status === 413) {
    return {
      code: "GOOGLE_REQUEST_TOO_LARGE",
      message: "上传图片太大，请先压缩图片或降低图片尺寸。",
      debug
    };
  }

  if (/timeout|timed out|etimedout/i.test(message)) {
    return {
      code: "GOOGLE_TIMEOUT",
      message: "Nano Banana 2 请求超时，请稍后重试，或检查网络代理。",
      debug
    };
  }

  if (/fetch failed|network|connection|econnreset|enotfound|econnrefused/i.test(message)) {
    return {
      code: "GOOGLE_CONNECTION_ERROR",
      message: "无法连接 Google GenAI 服务，请检查网络、代理或 Google API 服务可用性。",
      debug
    };
  }

  if (status) {
    return {
      code: "GOOGLE_API_ERROR",
      message: "Google GenAI API 返回错误，请稍后重试或检查请求参数。",
      debug
    };
  }

  return {
    code: "GOOGLE_UNKNOWN_ERROR",
    message: "Nano Banana 2 生图失败，请稍后重试。",
    debug
  };
}
