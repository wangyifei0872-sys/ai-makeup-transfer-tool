import { NextResponse } from "next/server";
import { AppApiError } from "@/lib/analyzeErrors";
import { requestOpenRouterImageGeneration, toBananaRelayApiError } from "@/lib/nanoBananaRelay";
import { FIXED_IMAGE_MODEL, FIXED_RELAY_BASE_URL } from "@/lib/relayConfig";

export const runtime = "nodejs";

type DiagnosticsBody = {
  relayApiKey?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as DiagnosticsBody;

    if (!body.relayApiKey?.trim()) {
      throw new AppApiError(
        "MISSING_RELAY_API_KEY",
        "缺少 API Key，请在设置中填写。",
        "No relayApiKey JSON body value was provided."
      );
    }

    await requestOpenRouterImageGeneration({
      apiKey: body.relayApiKey,
      baseUrl: FIXED_RELAY_BASE_URL,
      actualModelName: FIXED_IMAGE_MODEL.model,
      outputResolution: "1K",
      resolvedAspectRatio: "1:1",
      content: [
        {
          type: "text",
          text: "Generate a simple test image of a red circle on a white background."
        }
      ]
    });

    return NextResponse.json({
      ok: true,
      message: "生图模型连接成功",
      label: FIXED_IMAGE_MODEL.label,
      model: FIXED_IMAGE_MODEL.model
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: toBananaRelayApiError(error)
      },
      { status: 400 }
    );
  }
}
