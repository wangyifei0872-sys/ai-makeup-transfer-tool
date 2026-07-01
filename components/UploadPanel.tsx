"use client";

import { Brush, Check, Eraser, ImagePlus, RefreshCw, RotateCcw, X } from "lucide-react";
import { useRef, useState, type ChangeEvent, type PointerEvent } from "react";
import type { UploadedImage } from "@/lib/mock";

type UploadFieldKey = "source" | "reference" | "mask";
type MaskTool = "brush" | "eraser";

type UploadPanelProps = {
  sourceImage: UploadedImage | null;
  referenceImage: UploadedImage | null;
  maskImage: UploadedImage | null;
  maskBase64: string | null;
  error: string | null;
  onUpload: (key: UploadFieldKey, file: File) => void;
  onRemove: (key: UploadFieldKey) => void;
  onMaskChange: (maskBase64: string | null) => void;
};

type UploadBoxProps = {
  id: UploadFieldKey;
  title: string;
  description: string;
  image: UploadedImage | null;
  hasError?: boolean;
  onUpload: (key: UploadFieldKey, file: File) => void;
  onRemove: (key: UploadFieldKey) => void;
};

type MaskEditorProps = {
  sourceImage: UploadedImage;
  maskBase64: string | null;
  onConfirm: (maskBase64: string) => void;
  onCancel: () => void;
};

function UploadBox({
  id,
  title,
  description,
  image,
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
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <label htmlFor={inputId} className="text-sm font-semibold text-gray-900">
            {title}
          </label>
          <p className="mt-1 text-xs leading-5 text-gray-500">{description}</p>
        </div>
      </div>

      <div
        className={`relative overflow-hidden rounded-2xl border bg-white transition ${
          hasError
            ? "border-red-300 ring-4 ring-red-50"
            : image
              ? "border-[#6D5DF6]/45"
              : "border-dashed border-gray-200 hover:border-[#6D5DF6]/60"
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
          className="group flex h-[160px] cursor-pointer flex-col items-center justify-center p-4 text-center"
        >
          {image ? (
            <div className="relative h-full w-full overflow-hidden rounded-xl bg-[#F8FAFC]">
              <img src={image.url} alt={title} className="h-full w-full object-cover" />
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 bg-white/90 px-3 py-2 backdrop-blur">
                <span className="min-w-0 truncate text-left text-xs font-medium text-gray-900">
                  {image.fileName}
                </span>
                <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-[#6D5DF6]">
                  <RefreshCw className="h-3.5 w-3.5" />
                  重新上传
                </span>
              </div>
            </div>
          ) : (
            <>
              <div className="grid h-12 w-12 place-items-center rounded-full bg-white text-[#6D5DF6] shadow-sm ring-1 ring-gray-100 transition group-hover:bg-[#6D5DF6] group-hover:text-white">
                <ImagePlus className="h-5 w-5" />
              </div>
              <p className="mt-4 text-sm font-semibold text-gray-900">点击或拖拽上传图片</p>
              <p className="mt-1 text-xs text-gray-500">支持 JPG、PNG、WEBP，≤ 3MB</p>
            </>
          )}
        </label>

        {image ? (
          <button
            type="button"
            aria-label={`移除${title}`}
            onClick={() => onRemove(id)}
            className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full bg-white/95 text-gray-500 shadow-sm transition hover:text-[#6D5DF6]"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      {id === "source" && image?.dimensions ? (
        <p className="text-xs font-medium text-gray-500">
          原图尺寸：{image.dimensions.width} x {image.dimensions.height}
        </p>
      ) : null}
      {id === "source" && image?.dimensionsError ? (
        <p className="text-xs font-medium text-amber-700">
          无法读取原图尺寸，将使用默认比例生成。
        </p>
      ) : null}
    </div>
  );
}

function fillMaskBlack(canvas: HTMLCanvasElement) {
  const context = canvas.getContext("2d");
  if (!context) {
    return;
  }

  context.save();
  context.globalCompositeOperation = "source-over";
  context.fillStyle = "#000000";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.restore();
}

function MaskEditor({ sourceImage, maskBase64, onConfirm, onCancel }: MaskEditorProps) {
  const imageRef = useRef<HTMLImageElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const [tool, setTool] = useState<MaskTool>("brush");
  const [brushSize, setBrushSize] = useState(42);

  const initializeCanvas = () => {
    const image = imageRef.current;
    const canvas = canvasRef.current;

    if (!image || !canvas) {
      return;
    }

    const width = image.naturalWidth || sourceImage.dimensions?.width || 1024;
    const height = image.naturalHeight || sourceImage.dimensions?.height || 1024;
    canvas.width = width;
    canvas.height = height;
    fillMaskBlack(canvas);

    if (maskBase64) {
      const maskImage = new Image();
      maskImage.onload = () => {
        const context = canvas.getContext("2d");
        if (!context) {
          return;
        }
        context.drawImage(maskImage, 0, 0, width, height);
      };
      maskImage.src = maskBase64;
    }
  };

  const paintAtPointer = (event: PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");

    if (!canvas || !context) {
      return;
    }

    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((event.clientY - rect.top) / rect.height) * canvas.height;

    context.save();
    context.globalCompositeOperation = "source-over";
    context.fillStyle = tool === "brush" ? "#ffffff" : "#000000";
    context.beginPath();
    context.arc(x, y, brushSize / 2, 0, Math.PI * 2);
    context.fill();
    context.restore();
  };

  const handlePointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
    drawingRef.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    paintAtPointer(event);
  };

  const handlePointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) {
      return;
    }
    paintAtPointer(event);
  };

  const handlePointerUp = (event: PointerEvent<HTMLCanvasElement>) => {
    drawingRef.current = false;
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      fillMaskBlack(canvas);
    }
  };

  const handleConfirm = () => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    onConfirm(canvas.toDataURL("image/png"));
  };

  return (
    <div className="rounded-2xl border border-[#6D5DF6]/25 bg-[#F8FAFC] p-3">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setTool("brush")}
          className={`inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-xs font-semibold transition ${
            tool === "brush"
              ? "bg-[#6D5DF6] text-white"
              : "border border-gray-200 bg-white text-gray-600 hover:text-[#6D5DF6]"
          }`}
        >
          <Brush className="h-3.5 w-3.5" />
          白色画笔
        </button>
        <button
          type="button"
          onClick={() => setTool("eraser")}
          className={`inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-xs font-semibold transition ${
            tool === "eraser"
              ? "bg-gray-900 text-white"
              : "border border-gray-200 bg-white text-gray-600 hover:text-gray-900"
          }`}
        >
          <Eraser className="h-3.5 w-3.5" />
          黑色橡皮
        </button>
        <label className="ml-auto flex items-center gap-2 text-xs font-semibold text-gray-500">
          笔刷
          <input
            type="range"
            min={12}
            max={96}
            value={brushSize}
            onChange={(event) => setBrushSize(Number(event.target.value))}
            className="w-24 accent-[#6D5DF6]"
          />
          <span className="w-7 text-right">{brushSize}</span>
        </label>
      </div>

      <div className="relative overflow-hidden rounded-xl border border-gray-200 bg-white">
        <img
          ref={imageRef}
          src={sourceImage.url}
          alt="遮罩编辑原图"
          onLoad={initializeCanvas}
          className="block h-auto w-full select-none"
          draggable={false}
        />
        <canvas
          ref={canvasRef}
          className="absolute inset-0 h-full w-full cursor-crosshair touch-none opacity-45"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs leading-5 text-gray-500">
          白色区域允许 AI 修改，黑色区域保护原图。
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleClear}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-600 transition hover:text-[#6D5DF6]"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            清空
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex h-9 items-center rounded-xl border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-600 transition hover:text-gray-900"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#6D5DF6] px-3 text-xs font-semibold text-white transition hover:opacity-95"
          >
            <Check className="h-3.5 w-3.5" />
            确认
          </button>
        </div>
      </div>
    </div>
  );
}

export function UploadPanel({
  sourceImage,
  referenceImage,
  maskBase64,
  error,
  onUpload,
  onRemove,
  onMaskChange
}: UploadPanelProps) {
  const [maskEditorOpen, setMaskEditorOpen] = useState(false);

  return (
    <section className="flex h-full min-h-[calc(100vh-112px)] flex-col rounded-[20px] border border-gray-200 bg-white p-6 shadow-sm">
      <div className="mb-7 flex items-start gap-4">
        <div className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-[#3B82F6] to-[#6D5DF6] text-sm font-bold text-white shadow-sm shadow-[#6D5DF6]/25">
          1
        </div>
        <div>
          <h2 className="text-lg font-semibold text-gray-900">上传素材</h2>
          <p className="mt-1 text-sm leading-5 text-gray-500">
            上传原图、参考妆容，并可直接涂抹遮罩
          </p>
        </div>
      </div>

      {error ? (
        <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </div>
      ) : null}

      <div className="flex-1 space-y-5">
        <UploadBox
          id="source"
          title="原始插画（必填）"
          description="需要迁移妆容的原始图片"
          image={sourceImage}
          hasError={Boolean(error && !sourceImage)}
          onUpload={onUpload}
          onRemove={onRemove}
        />

        {sourceImage ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-gray-900">遮罩编辑（可选）</div>
                <p className="mt-1 text-xs leading-5 text-gray-500">
                  默认全黑保护原图，涂白区域允许 AI 修改。
                </p>
              </div>
              {maskBase64 ? (
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                  已生成遮罩
                </span>
              ) : null}
            </div>

            {maskEditorOpen ? (
              <MaskEditor
                sourceImage={sourceImage}
                maskBase64={maskBase64}
                onCancel={() => setMaskEditorOpen(false)}
                onConfirm={(nextMaskBase64) => {
                  onMaskChange(nextMaskBase64);
                  setMaskEditorOpen(false);
                }}
              />
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setMaskEditorOpen(true)}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#6D5DF6] px-3 text-sm font-semibold text-white shadow-sm shadow-[#6D5DF6]/20 transition hover:opacity-95"
                >
                  <Brush className="h-4 w-4" />
                  涂抹遮罩编辑
                </button>
                <button
                  type="button"
                  onClick={() => onMaskChange(null)}
                  disabled={!maskBase64}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-600 transition hover:border-[#6D5DF6]/50 hover:text-[#6D5DF6] disabled:opacity-50"
                >
                  清除遮罩
                </button>
              </div>
            )}
          </div>
        ) : null}

        <UploadBox
          id="reference"
          title="妆容参考图（必填）"
          description="用于分析眼妆、唇色、腮红和整体风格"
          image={referenceImage}
          hasError={Boolean(error && !referenceImage)}
          onUpload={onUpload}
          onRemove={onRemove}
        />
      </div>

      <p className="mt-6 rounded-xl border border-gray-200 bg-[#F8FAFC] px-3.5 py-2.5 text-xs leading-5 text-gray-500">
        建议上传 3MB 以下图片，线上环境更稳定。
      </p>
    </section>
  );
}
