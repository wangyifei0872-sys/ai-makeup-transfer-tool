import { NextResponse } from "next/server";
import { AppApiError } from "@/lib/analyzeErrors";
import { createOpenAIClient } from "@/lib/openai";
import { toOpenAIApiError } from "@/lib/openaiErrorMapper";
import { FIXED_GPT_MODEL, FIXED_RELAY_BASE_URL } from "@/lib/relayConfig";

export const runtime = "nodejs";

type DiagnosticsBody = {
  relayApiKey?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as DiagnosticsBody;

    if (!body.relayApiKey?.trim()) {
      throw new AppApiError(
        "MISSING_OPENAI_API_KEY",
        "缺少 API Key，请在设置中填写。",
        "No relayApiKey JSON body value was provided."
      );
    }

    const openai = createOpenAIClient({
      apiKey: body.relayApiKey,
      baseUrl: FIXED_RELAY_BASE_URL
    });

    await openai.responses.create({
      model: FIXED_GPT_MODEL,
      input: "Connection test. Reply with OK.",
      max_output_tokens: 16
    });

    return NextResponse.json({
      ok: true,
      message: "GPT 分析连接成功",
      model: FIXED_GPT_MODEL,
      baseUrl: FIXED_RELAY_BASE_URL
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: toOpenAIApiError(error, "GPT 分析连接测试失败，请检查 API Key。")
      },
      { status: 400 }
    );
  }
}
