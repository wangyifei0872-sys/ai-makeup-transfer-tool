"use client";

import { Eye, EyeOff, KeyRound, Loader2, PlugZap, Save, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { AnalyzeApiError } from "@/lib/analyzeErrors";
import {
  clearApiKeys,
  getStoredApiKeys,
  saveApiKeys,
  type StoredApiKeys
} from "@/lib/apiKeys";
import { FIXED_GPT_MODEL, FIXED_IMAGE_MODEL, FIXED_RELAY_SERVICE_NAME } from "@/lib/relayConfig";

type ApiKeySettingsModalProps = {
  open: boolean;
  message?: string | null;
  onClose: () => void;
  onSaved: () => void;
  onCleared: () => void;
};

type TestResult = {
  ok: boolean;
  message: string;
  code?: string;
  debug?: string;
};

const emptyKeys: StoredApiKeys = {
  relayApiKey: ""
};

function TestResultCard({ result }: { result: TestResult }) {
  return (
    <div
      className={`rounded-xl border px-3 py-2 text-xs font-medium ${
        result.ok
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-red-200 bg-red-50 text-red-700"
      }`}
    >
      <div>{result.message}</div>
      {!result.ok && result.code ? (
        <div className="mt-2 inline-flex rounded-full bg-white/80 px-2 py-1 font-mono">
          {result.code}
        </div>
      ) : null}
      {!result.ok && result.debug ? (
        <details className="mt-2">
          <summary className="cursor-pointer select-none font-semibold">展开 debug</summary>
          <pre className="mt-2 max-h-28 overflow-auto whitespace-pre-wrap break-words rounded-xl border border-red-100 bg-white p-2 leading-5 text-red-900">
            {result.debug}
          </pre>
        </details>
      ) : null}
    </div>
  );
}

export function ApiKeySettingsModal({
  open,
  message,
  onClose,
  onSaved,
  onCleared
}: ApiKeySettingsModalProps) {
  const [apiKeys, setApiKeys] = useState<StoredApiKeys>(emptyKeys);
  const [showRelayKey, setShowRelayKey] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [gptTestResult, setGptTestResult] = useState<TestResult | null>(null);
  const [imageTestResult, setImageTestResult] = useState<TestResult | null>(null);
  const [testingTarget, setTestingTarget] = useState<"gpt" | "image" | null>(null);

  useEffect(() => {
    if (open) {
      setApiKeys(getStoredApiKeys());
      setShowRelayKey(false);
      setStatus(null);
      setGptTestResult(null);
      setImageTestResult(null);
      setTestingTarget(null);
    }
  }, [open]);

  if (!open) {
    return null;
  }

  const handleSave = () => {
    saveApiKeys(apiKeys);
    setStatus("API Key 已保存到本机");
    onSaved();
  };

  const handleClear = () => {
    clearApiKeys();
    setApiKeys(emptyKeys);
    setStatus("API Key 已清除");
    setGptTestResult(null);
    setImageTestResult(null);
    onCleared();
  };

  const validateApiKey = () => {
    if (!apiKeys.relayApiKey.trim()) {
      return {
        ok: false,
        message: "请先填写 API Key。",
        code: "MISSING_RELAY_API_KEY"
      };
    }

    return null;
  };

  const handleTestGpt = async () => {
    const validationError = validateApiKey();

    if (validationError) {
      setGptTestResult(validationError);
      return;
    }

    setTestingTarget("gpt");
    setGptTestResult(null);

    try {
      const response = await fetch("/api/diagnostics/openai", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          relayApiKey: apiKeys.relayApiKey
        })
      });
      const data = (await response.json()) as
        | { ok: true; message: string; model: string; baseUrl: string }
        | { ok: false; error: AnalyzeApiError };

      if (response.ok && data.ok) {
        setGptTestResult({
          ok: true,
          message: `GPT 分析连接成功，模型：${data.model}`
        });
        return;
      }

      if (!data.ok) {
        setGptTestResult({
          ok: false,
          message: data.error.message,
          code: data.error.code,
          debug: data.error.debug
        });
      }
    } catch (error) {
      setGptTestResult({
        ok: false,
        message: "GPT 分析连接测试失败，请检查本地服务是否正在运行。",
        code: "OPENAI_RELAY_CONNECTION_FAILED",
        debug: error instanceof Error ? error.message : "Unknown frontend GPT diagnostics error."
      });
    } finally {
      setTestingTarget(null);
    }
  };

  const handleTestImageModel = async () => {
    const validationError = validateApiKey();

    if (validationError) {
      setImageTestResult(validationError);
      return;
    }

    setTestingTarget("image");
    setImageTestResult(null);

    try {
      const response = await fetch("/api/diagnostics/image-model", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          relayApiKey: apiKeys.relayApiKey
        })
      });
      const data = (await response.json()) as
        | { ok: true; message: string; label: string; model: string }
        | { ok: false; error: AnalyzeApiError };

      if (response.ok && data.ok) {
        setImageTestResult({
          ok: true,
          message: `生图模型连接成功：${data.model}`
        });
        return;
      }

      if (!data.ok) {
        setImageTestResult({
          ok: false,
          message: data.error.message,
          code: data.error.code,
          debug: data.error.debug
        });
      }
    } catch (error) {
      setImageTestResult({
        ok: false,
        message: "生图模型连接测试失败，请检查本地服务是否正在运行。",
        code: "IMAGE_RELAY_CONNECTION_FAILED",
        debug: error instanceof Error ? error.message : "Unknown frontend image diagnostics error."
      });
    } finally {
      setTestingTarget(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#111827]/30 px-4 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-[560px] overflow-hidden rounded-2xl border border-app-border bg-white shadow-2xl shadow-[#111827]/15">
        <div className="flex items-start justify-between gap-4 border-b border-app-border px-6 py-5">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-[#F4F6FF] text-app-primary">
              <KeyRound className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-app-text">API Key 设置</h2>
              <p className="mt-1 text-sm leading-6 text-app-muted">
                请输入你自己的中转 API Key。Key 只保存在当前浏览器本机，不会写入项目代码。
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label="关闭"
            onClick={onClose}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-app-border bg-white text-app-muted transition hover:border-app-primary/50 hover:text-app-primary"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[calc(92vh-178px)] space-y-5 overflow-y-auto px-6 py-5">
          {message ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
              {message}
            </div>
          ) : null}

          <section className="rounded-2xl border border-app-border bg-[#FAFBFF] p-4">
            <label htmlFor="relay-api-key" className="text-sm font-semibold text-app-text">
              API Key
            </label>
            <div className="mt-2 flex h-12 overflow-hidden rounded-2xl border border-app-border bg-white transition focus-within:border-app-primary focus-within:ring-4 focus-within:ring-app-primary/10">
              <input
                id="relay-api-key"
                type={showRelayKey ? "text" : "password"}
                value={apiKeys.relayApiKey}
                onChange={(event) =>
                  setApiKeys({
                    relayApiKey: event.target.value
                  })
                }
                placeholder="请输入你的 API Key"
                className="min-w-0 flex-1 border-0 px-4 text-sm text-app-text outline-none placeholder:text-app-muted"
              />
              <button
                type="button"
                aria-label={showRelayKey ? "隐藏 API Key" : "显示 API Key"}
                onClick={() => setShowRelayKey((current) => !current)}
                className="grid w-12 place-items-center text-app-muted transition hover:text-app-primary"
              >
                {showRelayKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {apiKeys.relayApiKey ? <p className="mt-2 text-xs text-app-muted">Key 已配置</p> : null}
          </section>

          <section className="rounded-2xl border border-app-border bg-[#FAFBFF] p-4">
            <h3 className="text-sm font-semibold text-app-text">固定模型配置</h3>
            <dl className="mt-3 space-y-2 text-xs">
              <div className="flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-2">
                <dt className="font-semibold text-app-muted">中转服务</dt>
                <dd className="font-medium text-app-text">{FIXED_RELAY_SERVICE_NAME}</dd>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-2">
                <dt className="font-semibold text-app-muted">GPT 分析模型</dt>
                <dd className="font-mono text-app-text">{FIXED_GPT_MODEL}</dd>
              </div>
              <div className="rounded-xl bg-white px-3 py-2">
                <dt className="font-semibold text-app-muted">生图模型</dt>
                <dd className="mt-1 break-all font-mono text-app-text">{FIXED_IMAGE_MODEL.model}</dd>
              </div>
            </dl>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={handleTestGpt}
                disabled={testingTarget !== null}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-app-border bg-white px-4 text-sm font-semibold text-app-text transition hover:border-app-primary/50 hover:text-app-primary disabled:opacity-60"
              >
                {testingTarget === "gpt" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <PlugZap className="h-4 w-4" />
                )}
                {testingTarget === "gpt" ? "测试中..." : "测试 GPT 分析连接"}
              </button>
              <button
                type="button"
                onClick={handleTestImageModel}
                disabled={testingTarget !== null}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-app-border bg-white px-4 text-sm font-semibold text-app-text transition hover:border-app-primary/50 hover:text-app-primary disabled:opacity-60"
              >
                {testingTarget === "image" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <PlugZap className="h-4 w-4" />
                )}
                {testingTarget === "image" ? "测试中..." : "测试生图模型连接"}
              </button>
            </div>

            {gptTestResult ? <div className="mt-3"><TestResultCard result={gptTestResult} /></div> : null}
            {imageTestResult ? <div className="mt-3"><TestResultCard result={imageTestResult} /></div> : null}
          </section>

          {status ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
              {status}
            </div>
          ) : null}

          <p className="text-xs leading-5 text-app-muted">
            API Key 只保存在当前浏览器 localStorage 中。请不要在公共电脑或公开部署的网站中保存 Key。
          </p>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-app-border px-6 py-5">
          <button
            type="button"
            onClick={handleClear}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-app-border bg-white px-4 text-sm font-semibold text-app-muted transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
          >
            <Trash2 className="h-4 w-4" />
            清除
          </button>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-11 items-center justify-center rounded-xl border border-app-border bg-white px-4 text-sm font-semibold text-app-text transition hover:border-app-primary/50 hover:text-app-primary"
            >
              关闭
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-app-primary to-app-blue px-5 text-sm font-semibold text-white shadow-lg shadow-app-primary/15 transition hover:opacity-95"
            >
              <Save className="h-4 w-4" />
              保存
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
