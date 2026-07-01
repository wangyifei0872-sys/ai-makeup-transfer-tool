import { NextResponse } from "next/server";
import { AppApiError } from "@/lib/analyzeErrors";
import { createOpenAIClient } from "@/lib/openai";
import { sanitizeDebugText, toOpenAIApiError } from "@/lib/openaiErrorMapper";
import {
  buildMakeupAnalysisPrompt,
  MAKEUP_ANALYSIS_SCHEMA,
  MAKEUP_ANALYSIS_SYSTEM_PROMPT,
  type AnalyzeRequestSettings,
  type MakeupAnalysisResult
} from "@/lib/promptBuilder";
import { FIXED_GPT_MODEL, FIXED_RELAY_BASE_URL } from "@/lib/relayConfig";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const validIntensity = ["light", "medium", "strong"] as const;
const validEditAreas = ["fullFace", "eyes", "lips", "blush", "highlight"] as const;
const validPreserveLevel = ["strict", "normal", "softEnhance"] as const;
const validOutputCount = [1, 2, 4] as const;
const ANALYSIS_IMAGE_MAX_SIZE = 1024;
const ANALYSIS_IMAGE_QUALITY = 80;

type AnalysisImageDebug = {
  field: string;
  originalWidth?: number;
  originalHeight?: number;
  compressedWidth?: number;
  compressedHeight?: number;
  originalBytes: number;
  compressedBytes: number;
};

function isValidValue<T extends readonly string[]>(value: string, values: T): value is T[number] {
  return values.includes(value as T[number]);
}

function parseSettings(formData: FormData): AnalyzeRequestSettings {
  const makeupIntensity = String(formData.get("makeupIntensity") ?? "");
  const editAreas = String(formData.get("editAreas") ?? "");
  const preserveLevel = String(formData.get("preserveLevel") ?? "");
  const outputCount = Number(formData.get("outputCount"));

  if (!isValidValue(makeupIntensity, validIntensity)) {
    throw new AppApiError(
      "ANALYZE_REQUEST_INVALID",
      "请求参数 makeupIntensity 无效。",
      `Invalid makeupIntensity: ${makeupIntensity || "(empty)"}`
    );
  }

  if (!isValidValue(editAreas, validEditAreas)) {
    throw new AppApiError(
      "ANALYZE_REQUEST_INVALID",
      "请求参数 editAreas 无效。",
      `Invalid editAreas: ${editAreas || "(empty)"}`
    );
  }

  if (!isValidValue(preserveLevel, validPreserveLevel)) {
    throw new AppApiError(
      "ANALYZE_REQUEST_INVALID",
      "请求参数 preserveLevel 无效。",
      `Invalid preserveLevel: ${preserveLevel || "(empty)"}`
    );
  }

  if (!validOutputCount.includes(outputCount as AnalyzeRequestSettings["outputCount"])) {
    throw new AppApiError(
      "ANALYZE_REQUEST_INVALID",
      "请求参数 outputCount 无效。",
      `Invalid outputCount: ${Number.isNaN(outputCount) ? "(NaN)" : outputCount}`
    );
  }

  return {
    makeupIntensity,
    editAreas,
    preserveLevel,
    outputCount: outputCount as AnalyzeRequestSettings["outputCount"]
  };
}

function getImageFile(formData: FormData, key: string) {
  const value = formData.get(key);

  if (!(value instanceof File)) {
    throw new AppApiError(
      "ANALYZE_REQUEST_INVALID",
      `缺少必要图片：${key}。`,
      `FormData file field missing: ${key}`
    );
  }

  if (!value.type.startsWith("image/")) {
    throw new AppApiError(
      "ANALYZE_REQUEST_INVALID",
      `${key} 必须是图片文件。`,
      `Invalid file MIME type for ${key}: ${value.type || "(empty)"}`
    );
  }

  return value;
}

function formatAnalysisImageDebug(items: AnalysisImageDebug[]) {
  if (items.length === 0) {
    return "";
  }

  return items
    .map((item) =>
      [
        `${item.field}:`,
        `originalSize=${item.originalWidth ?? "unknown"}x${item.originalHeight ?? "unknown"}`,
        `compressedSize=${item.compressedWidth ?? "unknown"}x${item.compressedHeight ?? "unknown"}`,
        `originalBytes=${item.originalBytes}`,
        `compressedBytes=${item.compressedBytes}`
      ].join(" ")
    )
    .join("; ");
}

async function fileToAnalysisDataUrl(
  file: File,
  field: string
): Promise<{ dataUrl: string; debug: AnalysisImageDebug }> {
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const sharp = (await import("sharp")).default;
  const originalMetadata = await sharp(buffer).metadata();
  const compressedBuffer = await sharp(buffer)
    .rotate()
    .resize({
      width: ANALYSIS_IMAGE_MAX_SIZE,
      height: ANALYSIS_IMAGE_MAX_SIZE,
      fit: "inside",
      withoutEnlargement: true
    })
    .jpeg({ quality: ANALYSIS_IMAGE_QUALITY })
    .toBuffer();
  const compressedMetadata = await sharp(compressedBuffer).metadata();

  return {
    dataUrl: `data:image/jpeg;base64,${compressedBuffer.toString("base64")}`,
    debug: {
      field,
      originalWidth: originalMetadata.width,
      originalHeight: originalMetadata.height,
      compressedWidth: compressedMetadata.width,
      compressedHeight: compressedMetadata.height,
      originalBytes: buffer.byteLength,
      compressedBytes: compressedBuffer.byteLength
    }
  };
}

function parseModelJson(outputText: string): MakeupAnalysisResult {
  try {
    return JSON.parse(outputText) as MakeupAnalysisResult;
  } catch {
    throw new AppApiError(
      "GPT_JSON_PARSE_FAILED",
      "GPT-5.5 返回内容不是合法 JSON，请重试或检查 promptBuilder。",
      `JSON.parse failed. Output preview: ${sanitizeDebugText(outputText).slice(0, 500)}`
    );
  }
}

export async function POST(request: Request) {
  const analysisImageDebug: AnalysisImageDebug[] = [];

  try {
    const formData = await request.formData();
    const originalImage = getImageFile(formData, "originalImage");
    const referenceImage = getImageFile(formData, "referenceImage");
    const settings = parseSettings(formData);
    const relayApiKey = String(formData.get("relayApiKey") ?? "");

    if (!relayApiKey.trim()) {
      throw new AppApiError(
        "MISSING_OPENAI_API_KEY",
        "缺少 API Key，请在设置中填写。",
        "No relayApiKey FormData value was provided."
      );
    }

    const [originalAnalysisImage, referenceAnalysisImage] = await Promise.all([
      fileToAnalysisDataUrl(originalImage, "originalImage"),
      fileToAnalysisDataUrl(referenceImage, "referenceImage")
    ]);
    analysisImageDebug.push(originalAnalysisImage.debug, referenceAnalysisImage.debug);

    const openai = createOpenAIClient({
      apiKey: relayApiKey,
      baseUrl: FIXED_RELAY_BASE_URL
    });

    const response = await openai.responses.create({
      model: FIXED_GPT_MODEL,
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text: MAKEUP_ANALYSIS_SYSTEM_PROMPT
            }
          ]
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: buildMakeupAnalysisPrompt(settings)
            },
            {
              type: "input_image",
              image_url: originalAnalysisImage.dataUrl,
              detail: "high"
            },
            {
              type: "input_image",
              image_url: referenceAnalysisImage.dataUrl,
              detail: "high"
            }
          ]
        }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "makeup_transfer_analysis",
          strict: true,
          schema: MAKEUP_ANALYSIS_SCHEMA
        }
      }
    });

    const outputText = response.output_text;

    if (!outputText) {
      throw new Error("GPT-5.5 未返回分析结果。");
    }

    return NextResponse.json({
      ok: true,
      analysis: parseModelJson(outputText),
      debug: formatAnalysisImageDebug(analysisImageDebug)
    });
  } catch (error) {
    const apiError = toOpenAIApiError(error, "GPT-5.5 分析失败，请稍后重试。");
    const imageDebug = formatAnalysisImageDebug(analysisImageDebug);

    if (imageDebug) {
      apiError.debug = `${apiError.debug}; analysisImages=${imageDebug}`;
    }

    return NextResponse.json(
      {
        ok: false,
        error: apiError
      },
      { status: 400 }
    );
  }
}
