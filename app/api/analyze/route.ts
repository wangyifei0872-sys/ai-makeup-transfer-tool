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

const validIntensity = ["light", "medium", "strong"] as const;
const validEditAreas = ["fullFace", "eyes", "lips", "blush", "highlight"] as const;
const validPreserveLevel = ["strict", "normal", "softEnhance"] as const;
const validOutputCount = [1, 2, 4] as const;

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

async function fileToDataUrl(file: File) {
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  return `data:${file.type};base64,${buffer.toString("base64")}`;
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

    const [originalImageUrl, referenceImageUrl] = await Promise.all([
      fileToDataUrl(originalImage),
      fileToDataUrl(referenceImage)
    ]);

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
              image_url: originalImageUrl,
              detail: "high"
            },
            {
              type: "input_image",
              image_url: referenceImageUrl,
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
      analysis: parseModelJson(outputText)
    });
  } catch (error) {
    const apiError = toOpenAIApiError(error, "GPT-5.5 分析失败，请稍后重试。");

    return NextResponse.json(
      {
        ok: false,
        error: apiError
      },
      { status: 400 }
    );
  }
}
