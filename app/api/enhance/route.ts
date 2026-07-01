import { NextResponse } from "next/server";
import { AppApiError } from "@/lib/analyzeErrors";
import { requestOpenRouterImageGeneration, toBananaRelayApiError } from "@/lib/nanoBananaRelay";
import type { EnhanceStrength, OutputResolution } from "@/lib/mock";
import { FIXED_IMAGE_MODEL, FIXED_RELAY_BASE_URL } from "@/lib/relayConfig";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const validEnhanceStrength = ["light", "standard", "strong"] as const;
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

function parseEnhanceStrength(value: string): EnhanceStrength {
  if (!validEnhanceStrength.includes(value as EnhanceStrength)) {
    throw new AppApiError(
      "GENERATE_REQUEST_INVALID",
      "请求参数 enhanceStrength 无效。",
      `Invalid enhanceStrength: ${value || "(empty)"}`
    );
  }

  return value as EnhanceStrength;
}

function parseOutputResolution(value: string): OutputResolution {
  if (!validOutputResolution.includes(value as OutputResolution)) {
    throw new AppApiError(
      "GENERATE_REQUEST_INVALID",
      "请求参数 outputResolution 无效。",
      `Invalid outputResolution: ${value || "(empty)"}`
    );
  }

  return value as OutputResolution;
}

function validateGeneratedImageUrl(value: string) {
  if (/^data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=\s]+$/.test(value)) {
    return value;
  }

  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  throw new AppApiError(
    "GENERATE_REQUEST_INVALID",
    "generatedImage 必须是已生成结果图的 data URL 或图片 URL。",
    `Invalid generatedImage value. Length: ${value.length}`
  );
}

function getStrengthInstruction(strength: EnhanceStrength) {
  if (strength === "light") {
    return "Use a subtle enhancement. Keep changes minimal and natural.";
  }

  if (strength === "strong") {
    return "Use a stronger enhancement while still preserving the original identity, makeup, composition, colors, and art style.";
  }

  return "Use a balanced standard enhancement.";
}

function buildEnhancePrompt(strength: EnhanceStrength) {
  return `This is a non-sexual image quality enhancement task for an already generated stylized portrait result.
Only improve clarity, fine details, edge definition, hair strands, eyelashes, eye makeup, lip color detail, and accessory material texture.
Do not change the character identity, face shape, facial proportions, expression, makeup design, composition, color palette, lighting, background, or art style.
Do not redesign the character.
Do not alter clothing or body.
Do not add text.
Do not crop, stretch, or distort the image.
Return only the enhanced image.

Enhancement strength:
${getStrengthInstruction(strength)}`;
}

function getEnhanceErrorResponse(error: unknown) {
  if (error instanceof AppApiError) {
    return {
      status: error.code === "IMAGE_RELAY_TIMEOUT" ? 504 : 400,
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
        message: "画质增强接口失败，请查看 debug。",
        debug: getSafeErrorDebug(error)
      }
    }
  };
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const relayApiKey = getRequiredText(formData, "relayApiKey");
    const generatedImage = validateGeneratedImageUrl(getRequiredText(formData, "generatedImage"));
    const enhanceStrength = parseEnhanceStrength(
      String(formData.get("enhanceStrength") ?? "standard")
    );
    const outputResolution = parseOutputResolution(String(formData.get("outputResolution") ?? "1K"));

    const enhanced = await requestOpenRouterImageGeneration({
      apiKey: relayApiKey,
      baseUrl: FIXED_RELAY_BASE_URL,
      actualModelName: FIXED_IMAGE_MODEL.model,
      outputResolution,
      content: [
        {
          type: "text",
          text: buildEnhancePrompt(enhanceStrength)
        },
        {
          type: "image_url",
          image_url: {
            url: generatedImage
          }
        }
      ]
    });

    return NextResponse.json({
      ok: true,
      image: {
        id: `enhanced-${Date.now()}`,
        dataUrl: enhanced.dataUrl,
        mimeType: enhanced.mimeType,
        outputResolution,
        enhanceStrength
      }
    });
  } catch (error) {
    const { body, status } = getEnhanceErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
