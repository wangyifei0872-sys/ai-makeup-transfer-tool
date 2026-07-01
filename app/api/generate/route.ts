import { NextResponse } from "next/server";
import sharp from "sharp";
import { AppApiError } from "@/lib/analyzeErrors";
import { generateWithGeminiRelay, toBananaRelayApiError } from "@/lib/nanoBananaRelay";
import type {
  FixedOutputAspectRatio,
  ImageDimensions,
  OriginalAspect,
  OutputAspectRatio,
  OutputResolution
} from "@/lib/mock";
import { FIXED_RELAY_BASE_URL } from "@/lib/relayConfig";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const validIntensity = ["light", "medium", "strong"] as const;
const validEditArea = ["fullFace", "eyes", "lips", "blush", "highlight"] as const;
const validPreserveLevel = ["strict", "normal", "softEnhance"] as const;
const validOutputCount = [1, 2, 4] as const;
const validOutputResolution = ["1K", "2K"] as const;
const validOutputAspectRatio = ["original", "1:1", "3:4", "4:3", "2:3", "3:2", "9:16", "16:9"] as const;
const fixedAspectRatios: Array<{ value: FixedOutputAspectRatio; ratio: number }> = [
  { value: "1:1", ratio: 1 },
  { value: "3:4", ratio: 3 / 4 },
  { value: "4:3", ratio: 4 / 3 },
  { value: "2:3", ratio: 2 / 3 },
  { value: "3:2", ratio: 3 / 2 },
  { value: "9:16", ratio: 9 / 16 },
  { value: "16:9", ratio: 16 / 9 }
];
const VERCEL_RESPONSE_BUDGET_MS = 55000;
const MIN_RELAY_ATTEMPT_MS = 10000;

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
      status:
        error.code === "IMAGE_RELAY_TIMEOUT"
          ? 504
          : error.code === "IMAGE_POSTPROCESS_FAILED"
            ? 500
            : 400,
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
        message: "生成接口失败，请查看 debug。",
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
  const outputAspectRatio = String(formData.get("outputAspectRatio") ?? "original");

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

  if (!validOutputAspectRatio.includes(outputAspectRatio as OutputAspectRatio)) {
    throw new AppApiError(
      "GENERATE_REQUEST_INVALID",
      "请求参数 outputAspectRatio 无效。",
      `Invalid outputAspectRatio: ${outputAspectRatio || "(empty)"}`
    );
  }

  return {
    makeupIntensity,
    editArea,
    preserveLevel,
    outputCount: outputCount as (typeof validOutputCount)[number],
    outputResolution: outputResolution as OutputResolution,
    outputAspectRatio: outputAspectRatio as OutputAspectRatio
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

function resolveOutputAspectRatio(
  outputAspectRatio: OutputAspectRatio,
  dimensions: ImageDimensions | null
): FixedOutputAspectRatio {
  if (outputAspectRatio !== "original") {
    return outputAspectRatio;
  }

  if (!dimensions?.width || !dimensions.height) {
    return "1:1";
  }

  const originalRatio = dimensions.width / dimensions.height;

  return fixedAspectRatios.reduce((closest, current) => {
    const closestDistance = Math.abs(originalRatio - closest.ratio);
    const currentDistance = Math.abs(originalRatio - current.ratio);
    return currentDistance < closestDistance ? current : closest;
  }).value;
}

function readUint24LE(buffer: Buffer, offset: number) {
  return buffer[offset] + (buffer[offset + 1] << 8) + (buffer[offset + 2] << 16);
}

function getPngDimensions(buffer: Buffer) {
  const pngSignature = "89504e470d0a1a0a";

  if (buffer.length >= 24 && buffer.subarray(0, 8).toString("hex") === pngSignature) {
    return {
      width: buffer.readUInt32BE(16),
      height: buffer.readUInt32BE(20)
    };
  }

  return null;
}

function getJpegDimensions(buffer: Buffer) {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) {
    return null;
  }

  let offset = 2;
  const sofMarkers = new Set([
    0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf
  ]);

  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    const marker = buffer[offset + 1];
    const segmentLength = buffer.readUInt16BE(offset + 2);

    if (sofMarkers.has(marker)) {
      return {
        height: buffer.readUInt16BE(offset + 5),
        width: buffer.readUInt16BE(offset + 7)
      };
    }

    if (segmentLength < 2) {
      return null;
    }

    offset += 2 + segmentLength;
  }

  return null;
}

function getWebpDimensions(buffer: Buffer) {
  if (
    buffer.length < 30 ||
    buffer.subarray(0, 4).toString("ascii") !== "RIFF" ||
    buffer.subarray(8, 12).toString("ascii") !== "WEBP"
  ) {
    return null;
  }

  let offset = 12;

  while (offset + 8 <= buffer.length) {
    const chunkType = buffer.subarray(offset, offset + 4).toString("ascii");
    const chunkSize = buffer.readUInt32LE(offset + 4);
    const dataOffset = offset + 8;

    if (dataOffset + chunkSize > buffer.length) {
      return null;
    }

    if (chunkType === "VP8X" && chunkSize >= 10) {
      return {
        width: readUint24LE(buffer, dataOffset + 4) + 1,
        height: readUint24LE(buffer, dataOffset + 7) + 1
      };
    }

    if (chunkType === "VP8 " && chunkSize >= 10) {
      return {
        width: buffer.readUInt16LE(dataOffset + 6) & 0x3fff,
        height: buffer.readUInt16LE(dataOffset + 8) & 0x3fff
      };
    }

    if (chunkType === "VP8L" && chunkSize >= 5 && buffer[dataOffset] === 0x2f) {
      const bits = buffer.readUInt32LE(dataOffset + 1);

      return {
        width: (bits & 0x3fff) + 1,
        height: ((bits >> 14) & 0x3fff) + 1
      };
    }

    offset = dataOffset + chunkSize + (chunkSize % 2);
  }

  return null;
}

function getImageDimensionsFromBuffer(buffer: Buffer) {
  return getPngDimensions(buffer) ?? getJpegDimensions(buffer) ?? getWebpDimensions(buffer);
}

async function readOriginalDimensions(file: File): Promise<ImageDimensions | null> {
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    return getImageDimensionsFromBuffer(buffer);
  } catch {
    return null;
  }
}

function getOptionalText(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function dataUrlToBuffer(dataUrl: string, fieldName: string) {
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)$/);

  if (!match) {
    throw new AppApiError(
      "IMAGE_POSTPROCESS_FAILED",
      "图片后处理失败，无法应用网页遮罩。",
      `${fieldName} is not a valid image data URL.`
    );
  }

  return {
    mimeType: match[1],
    buffer: Buffer.from(match[2].replace(/\s/g, ""), "base64")
  };
}

async function imageResultToBuffer(imageValue: string) {
  if (/^data:image\//i.test(imageValue)) {
    return dataUrlToBuffer(imageValue, "generatedImage").buffer;
  }

  if (/^https?:\/\//i.test(imageValue)) {
    const response = await fetch(imageValue);

    if (!response.ok) {
      throw new AppApiError(
        "IMAGE_POSTPROCESS_FAILED",
        "图片后处理失败，无法应用网页遮罩。",
        `Unable to fetch generated image for mask compositing. status=${response.status}; statusText=${response.statusText}`
      );
    }

    return Buffer.from(await response.arrayBuffer());
  }

  throw new AppApiError(
    "IMAGE_POSTPROCESS_FAILED",
    "图片后处理失败，无法应用网页遮罩。",
    "Generated image is neither a data URL nor an HTTP URL."
  );
}

async function compositeGeneratedImageWithMask({
  originalImageFile,
  generatedDataUrl,
  maskBase64
}: {
  originalImageFile: File;
  generatedDataUrl: string;
  maskBase64: string;
}) {
  try {
    const originalBuffer = Buffer.from(await originalImageFile.arrayBuffer());
    const generatedBuffer = await imageResultToBuffer(generatedDataUrl);
    const maskBuffer = dataUrlToBuffer(maskBase64, "maskBase64").buffer;
    const originalMetadata = await sharp(originalBuffer).metadata();
    const originalWidth = originalMetadata.width;
    const originalHeight = originalMetadata.height;

    if (!originalWidth || !originalHeight) {
      throw new Error("Unable to read original image dimensions for mask compositing.");
    }

    const baseBuffer = await sharp(originalBuffer)
      .resize(originalWidth, originalHeight, { fit: "fill" })
      .png()
      .toBuffer();
    const resizedGeneratedBuffer = await sharp(generatedBuffer)
      .resize(originalWidth, originalHeight, { fit: "fill" })
      .png()
      .toBuffer();
    const alphaMaskBuffer = await sharp(maskBuffer)
      .resize(originalWidth, originalHeight, { fit: "fill" })
      .removeAlpha()
      .grayscale()
      .toBuffer();
    const generatedWithMask = await sharp(resizedGeneratedBuffer)
      .removeAlpha()
      .joinChannel(alphaMaskBuffer)
      .png()
      .toBuffer();
    const compositedBuffer = await sharp(baseBuffer)
      .composite([{ input: generatedWithMask, blend: "over" }])
      .png()
      .toBuffer();

    return {
      dataUrl: `data:image/png;base64,${compositedBuffer.toString("base64")}`,
      mimeType: "image/png"
    };
  } catch (error) {
    if (error instanceof AppApiError) {
      throw error;
    }

    const debug = error instanceof Error ? `${error.name}: ${error.message}` : "Unknown mask compositing error.";

    throw new AppApiError(
      "IMAGE_POSTPROCESS_FAILED",
      "图片后处理失败，无法应用网页遮罩。",
      sanitizeDebugText(debug)
    );
  }
}

export async function POST(request: Request) {
  try {
    const deadline = Date.now() + VERCEL_RESPONSE_BUDGET_MS;
    const formData = await request.formData();
    const originalImageFile = getImageFile(formData, "originalImage");
    const referenceImageFile = getImageFile(formData, "referenceImage");
    const nanoPrompt = getRequiredText(formData, "nanoPrompt");
    const negativePrompt = getRequiredText(formData, "negativePrompt");
    const settings = parseSettings(formData);
    const apiKey = String(formData.get("relayApiKey") ?? "");
    const maskBase64 = getOptionalText(formData, "maskBase64");
    const originalDimensions = await readOriginalDimensions(originalImageFile);
    const originalAspect = getOriginalAspect(originalDimensions?.width, originalDimensions?.height);
    const resolvedAspectRatio = resolveOutputAspectRatio(settings.outputAspectRatio, originalDimensions);
    const generationSettings = {
      ...settings,
      originalAspect,
      resolvedAspectRatio
    };
    const images = [];

    for (let index = 0; index < settings.outputCount; index += 1) {
      const remainingMs = deadline - Date.now();

      if (remainingMs < MIN_RELAY_ATTEMPT_MS) {
        throw new AppApiError(
          "IMAGE_RELAY_TIMEOUT",
          "生图请求超时。请尝试选择 1K、输出 1 张，或上传更小的图片。",
          `Vercel function response budget nearly exhausted before variation ${index + 1}. remainingMs=${remainingMs}`
        );
      }

      const generated = await generateWithGeminiRelay({
        apiKey,
        baseUrl: FIXED_RELAY_BASE_URL,
        originalImageFile,
        referenceImageFile,
        nanoPrompt,
        negativePrompt,
        settings: generationSettings,
        variationIndex: index + 1,
        requestTimeoutMs: Math.min(50000, Math.max(MIN_RELAY_ATTEMPT_MS, remainingMs - 3000))
      });
      const finalImage = maskBase64
        ? await compositeGeneratedImageWithMask({
            originalImageFile,
            generatedDataUrl: generated.dataUrl,
            maskBase64
          })
        : generated;

      images.push({
        id: `result-${index + 1}`,
        dataUrl: finalImage.dataUrl,
        mimeType: finalImage.mimeType,
        outputResolution: settings.outputResolution,
        outputAspectRatio: settings.outputAspectRatio,
        resolvedAspectRatio,
        originalAspect
      });
    }

    return NextResponse.json({ ok: true, images });
  } catch (error) {
    const { body, status } = getGenerateErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
