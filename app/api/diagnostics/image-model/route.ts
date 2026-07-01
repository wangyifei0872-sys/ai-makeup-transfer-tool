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
    const apiError = toBananaRelayApiError(error);

    if (apiError.code === "IMAGE_RELAY_NO_IMAGE") {
      return NextResponse.json({
        ok: true,
        message: "生图接口连接成功。正式生图请上传原图和参考图后测试。",
        label: FIXED_IMAGE_MODEL.label,
        model: FIXED_IMAGE_MODEL.model,
        warning: {
          code: "IMAGE_MODEL_TEST_NO_IMAGE",
          message: "测试请求未返回图片，但接口已连接成功。正式生成请以上传图片后的结果为准。",
          debug: apiError.debug
        }
      });
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
