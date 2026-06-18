import { NextResponse } from "next/server";
import sharp from "sharp";
import { AppApiError } from "@/lib/analyzeErrors";
import { generateNanoBananaRelayImage, toBananaRelayApiError } from "@/lib/nanoBananaRelay";
import type { OriginalAspect, OutputResolution } from "@/lib/mock";
import { FIXED_RELAY_BASE_URL } from "@/lib/relayConfig";

export const runtime = "nodejs";

const validIntensity = ["light", "medium", "strong"] as const;
const validEditArea = ["fullFace", "eyes", "lips", "blush", "highlight"] as const;
const validPreserveLevel = ["strict", "normal", "softEnhance"] as const;
const validOutputCount = [1, 2, 4] as const;
const validOutputResolution = ["1K", "2K"] as const;

function sanitizeDebugText(value: string) {
  return value
    .replace(/Bearer\s+[^\s"',;:]+/gi, "Bearer ****")
    .replace(/sk-[^\s"',;:]+/g, "sk-****")
    .replace(/AIza[^\s"',;:]+/g, "AIza****")
    .replace(/(relayApiKey|apiKey|authorization)["'\s:=]+[^"',;\s}]+/gi, "$1=****");
}

function getSafeErrorDebug(error: unknown) {
  if (error instanceof Error) {
    const cause =
      typeof error.cause === "object" && error.cause !== null
        ? `; cause=${sanitizeDebugText(JSON.stringify(error.cause, Object.getOwnPropertyNames(error.cause))).slice(0, 600)}`
        : "";

    return sanitizeDebugText(`${error.name}: ${error.message}${cause}`);
  }

  return "Unknown non-Error value thrown.";
}

function getGenerateErrorResponse(error: unknown) {
  if (error instanceof AppApiError) {
    return {
      status: 400,
      body: {
        ok: false,
        error: toBananaRelayApiError(error)
      }
    };
  }

  return {
    status: 500,
    body: {
      ok: false,
      error: {
        code: "GENERATE_API_ERROR" as const,
        message: "生成接口内部错误，请查看 debug。",
        debug: getSafeErrorDebug(error)
      }
    }
  };
}

function isValidValue<T extends readonly string[]>(value: string, values: T): value is T[number] {
  return values.includes(value as T[number]);
}

function getImageFile(formData: FormData, key: string) {
  const value = formData.get(key);

  if (!(value instanceof File)) {
    throw new AppApiError(
      "GENERATE_REQUEST_INVALID",
      `缺少必要图片：${key}。`,
      `FormData file field missing: ${key}`
    );
  }

  if (!value.type.startsWith("image/")) {
    throw new AppApiError(
      "UNSUPPORTED_IMAGE_FORMAT",
      "图片格式不支持，请上传 PNG、JPG/JPEG 或 WebP 图片。",
      `Invalid file MIME type for ${key}: ${value.type || "(empty)"}`
    );
  }

  return value;
}

function getRequiredText(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();

  if (!value) {
    throw new AppApiError(
      "GENERATE_REQUEST_INVALID",
      `缺少必要参数：${key}。`,
      `FormData text field missing: ${key}`
    );
  }

  return value;
}

function parseSettings(formData: FormData) {
  const makeupIntensity = String(formData.get("makeupIntensity") ?? "");
  const editArea = String(formData.get("editArea") ?? "");
  const preserveLevel = String(formData.get("preserveLevel") ?? "");
  const outputCount = Number(formData.get("outputCount"));
  const outputResolution = String(formData.get("outputResolution") ?? "1K");

  if (!isValidValue(makeupIntensity, validIntensity)) {
    throw new AppApiError(
      "GENERATE_REQUEST_INVALID",
      "请求参数 makeupIntensity 无效。",
      `Invalid makeupIntensity: ${makeupIntensity || "(empty)"}`
    );
  }

  if (!isValidValue(editArea, validEditArea)) {
    throw new AppApiError(
      "GENERATE_REQUEST_INVALID",
      "请求参数 editArea 无效。",
      `Invalid editArea: ${editArea || "(empty)"}`
    );
  }

  if (!isValidValue(preserveLevel, validPreserveLevel)) {
    throw new AppApiError(
      "GENERATE_REQUEST_INVALID",
      "请求参数 preserveLevel 无效。",
      `Invalid preserveLevel: ${preserveLevel || "(empty)"}`
    );
  }

  if (!validOutputCount.includes(outputCount as (typeof validOutputCount)[number])) {
    throw new AppApiError(
      "GENERATE_REQUEST_INVALID",
      "请求参数 outputCount 无效。",
      `Invalid outputCount: ${Number.isNaN(outputCount) ? "(NaN)" : outputCount}`
    );
  }

  if (!validOutputResolution.includes(outputResolution as OutputResolution)) {
    throw new AppApiError(
      "GENERATE_REQUEST_INVALID",
      "请求参数 outputResolution 无效。",
      `Invalid outputResolution: ${outputResolution || "(empty)"}`
    );
  }

  return {
    makeupIntensity,
    editArea,
    preserveLevel,
    outputCount: outputCount as (typeof validOutputCount)[number],
    outputResolution: outputResolution as OutputResolution
  };
}

function getOriginalAspect(width?: number, height?: number): OriginalAspect {
  if (!width || !height) {
    return "unknown";
  }

  if (width === height) {
    return "square";
  }

  return width > height ? "landscape" : "portrait";
}

async function readOriginalAspect(file: File): Promise<OriginalAspect> {
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const metadata = await sharp(buffer).metadata();
    return getOriginalAspect(metadata.width, metadata.height);
  } catch {
    return "unknown";
  }
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const originalImageFile = getImageFile(formData, "originalImage");
    const referenceImageFile = getImageFile(formData, "referenceImage");
    const nanoPrompt = getRequiredText(formData, "nanoPrompt");
    const negativePrompt = getRequiredText(formData, "negativePrompt");
    const settings = parseSettings(formData);
    const apiKey = String(formData.get("relayApiKey") ?? "");
    const originalAspect = await readOriginalAspect(originalImageFile);
    const generationSettings = {
      ...settings,
      originalAspect
    };
    const images = [];

    for (let index = 0; index < settings.outputCount; index += 1) {
      const generated = await generateNanoBananaRelayImage({
        apiKey,
        baseUrl: FIXED_RELAY_BASE_URL,
        originalImageFile,
        referenceImageFile,
        nanoPrompt,
        negativePrompt,
        settings: generationSettings,
        variationIndex: index + 1
      });

      images.push({
        id: `result-${index + 1}`,
        dataUrl: generated.dataUrl,
        mimeType: generated.mimeType,
        outputResolution: settings.outputResolution,
        originalAspect
      });
    }

    return NextResponse.json({ ok: true, images });
  } catch (error) {
    const { body, status } = getGenerateErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
