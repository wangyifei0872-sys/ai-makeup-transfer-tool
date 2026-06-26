"use client";

import { ImagePlus, RefreshCw, ShieldCheck, X } from "lucide-react";
import type { ChangeEvent } from "react";
import type { UploadedImage } from "@/lib/mock";

type UploadFieldKey = "source" | "reference" | "mask";

type UploadPanelProps = {
  sourceImage: UploadedImage | null;
  referenceImage: UploadedImage | null;
  maskImage: UploadedImage | null;
  error: string | null;
  onUpload: (key: UploadFieldKey, file: File) => void;
  onRemove: (key: UploadFieldKey) => void;
};

type UploadBoxProps = {
  id: UploadFieldKey;
  title: string;
  description: string;
  image: UploadedImage | null;
  optionalHint?: string;
  hasError?: boolean;
  onUpload: (key: UploadFieldKey, file: File) => void;
  onRemove: (key: UploadFieldKey) => void;
};

function UploadBox({
  id,
  title,
  description,
  image,
  optionalHint,
  hasError,
  onUpload,
  onRemove
}: UploadBoxProps) {
  const inputId = `${id}-upload`;

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onUpload(id, file);
    }
    event.target.value = "";
  };

  return (
    <div className="space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div>
          <label htmlFor={inputId} className="text-sm font-semibold text-app-text">
            {title}
          </label>
          <p className="mt-1 text-xs leading-5 text-app-muted">{description}</p>
        </div>
        {optionalHint ? (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#F4F6FF] px-2.5 py-1 text-xs font-medium text-app-primary">
            <ShieldCheck className="h-3.5 w-3.5" />
            可选
          </span>
        ) : null}
      </div>

      <div
        className={`relative overflow-hidden rounded-2xl border bg-white transition ${
          hasError
            ? "border-red-300 ring-4 ring-red-50"
            : image
              ? "border-app-primary/45"
              : "border-dashed border-app-border hover:border-app-primary/60"
        }`}
      >
        <input
          id={inputId}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={handleChange}
        />

        <label
          htmlFor={inputId}
          className="group flex min-h-[168px] cursor-pointer flex-col items-center justify-center p-4 text-center"
        >
          {image ? (
            <div className="relative h-[168px] w-full overflow-hidden rounded-xl bg-[#F3F4F8]">
              <img src={image.url} alt={title} className="h-full w-full object-cover" />
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 bg-white/92 px-3 py-2 backdrop-blur">
                <span className="min-w-0 truncate text-left text-xs font-medium text-app-text">
                  {image.fileName}
                </span>
                <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-app-primary">
                  <RefreshCw className="h-3.5 w-3.5" />
                  重新上传
                </span>
              </div>
            </div>
          ) : (
            <>
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#F4F6FF] text-app-primary transition group-hover:bg-app-primary group-hover:text-white">
                <ImagePlus className="h-5 w-5" />
              </div>
              <p className="mt-4 text-sm font-semibold text-app-text">点击上传图片</p>
              <p className="mt-1 text-xs text-app-muted">支持 JPG、PNG、WEBP</p>
            </>
          )}
        </label>

        {image ? (
          <button
            type="button"
            aria-label={`移除${title}`}
            onClick={() => onRemove(id)}
            className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full bg-white/95 text-app-muted shadow-sm transition hover:text-app-primary"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      {id === "source" && image?.dimensions ? (
        <p className="text-xs font-medium text-app-muted">
          原图尺寸：{image.dimensions.width} × {image.dimensions.height}
        </p>
      ) : null}
      {id === "source" && image?.dimensionsError ? (
        <p className="text-xs font-medium text-amber-700">
          无法读取原图尺寸，将使用默认比例生成。
        </p>
      ) : null}
      {optionalHint ? <p className="text-xs leading-5 text-app-muted">{optionalHint}</p> : null}
    </div>
  );
}

export function UploadPanel({
  sourceImage,
  referenceImage,
  maskImage,
  error,
  onUpload,
  onRemove
}: UploadPanelProps) {
  return (
    <section className="rounded-2xl border border-app-border bg-app-card p-5 shadow-card">
      <div className="mb-5">
        <h2 className="text-base font-semibold text-app-text">上传图片</h2>
        <p className="mt-1 text-sm text-app-muted">上传原图、参考妆容和可选遮罩。</p>
        <p className="mt-2 rounded-xl bg-[#F8FAFF] px-3 py-2 text-xs leading-5 text-app-muted">
          建议上传 3MB 以下图片，线上环境更稳定。
        </p>
      </div>

      {error ? (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </div>
      ) : null}

      <div className="space-y-5">
        <UploadBox
          id="source"
          title="原始插画"
          description="需要换妆的插画原图。"
          image={sourceImage}
          hasError={Boolean(error && !sourceImage)}
          onUpload={onUpload}
          onRemove={onRemove}
        />
        <UploadBox
          id="reference"
          title="妆容参考图"
          description="用于 GPT-5.5 分析的妆容风格参考。"
          image={referenceImage}
          hasError={Boolean(error && !referenceImage)}
          onUpload={onUpload}
          onRemove={onRemove}
        />
        <UploadBox
          id="mask"
          title="遮罩图"
          description="保护区域或重点修改区域的辅助输入。"
          image={maskImage}
          optionalHint="可选，用于后续保护区域或重点修改区域。"
          onUpload={onUpload}
          onRemove={onRemove}
        />
      </div>
    </section>
  );
}
