"use client";

import { Download, ImageIcon, Loader2, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  clearAllHistoryImages,
  clearHistoryByDate,
  deleteHistoryImage,
  getAllHistoryImages,
  getHistoryDateLabel,
  type HistoryImageRecord
} from "@/lib/historyDb";

type HistoryLibraryModalProps = {
  open: boolean;
  onClose: () => void;
};

type GroupedHistory = Array<{
  dateKey: string;
  label: string;
  records: HistoryImageRecord[];
}>;

function formatTime(createdAt: string) {
  return new Date(createdAt).toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function getTypeLabel(type: HistoryImageRecord["type"]) {
  return type === "enhanced" ? "增强" : "生成";
}

function downloadHistoryImage(record: HistoryImageRecord) {
  const link = document.createElement("a");
  link.href = record.imageDataUrl;
  link.download = `${record.title.replace(/\s+/g, "-")}-${record.id}.png`;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function groupHistory(records: HistoryImageRecord[]): GroupedHistory {
  const groups = new Map<string, HistoryImageRecord[]>();

  records.forEach((record) => {
    const current = groups.get(record.dateKey) ?? [];
    current.push(record);
    groups.set(record.dateKey, current);
  });

  return Array.from(groups.entries()).map(([dateKey, groupRecords]) => ({
    dateKey,
    label: getHistoryDateLabel(dateKey),
    records: groupRecords
  }));
}

export function HistoryLibraryModal({ open, onClose }: HistoryLibraryModalProps) {
  const [records, setRecords] = useState<HistoryImageRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewRecord, setPreviewRecord] = useState<HistoryImageRecord | null>(null);

  const groupedHistory = useMemo(() => groupHistory(records), [records]);

  const loadHistory = async () => {
    setLoading(true);
    setError(null);

    try {
      setRecords(await getAllHistoryImages());
    } catch (historyError) {
      setError(historyError instanceof Error ? historyError.message : "读取历史记录失败。");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      void loadHistory();
    }
  }, [open]);

  if (!open) {
    return null;
  }

  const handleDelete = async (record: HistoryImageRecord) => {
    if (!window.confirm(`确定删除「${record.title}」吗？`)) {
      return;
    }

    await deleteHistoryImage(record.id);
    setRecords((current) => current.filter((item) => item.id !== record.id));
    setPreviewRecord((current) => (current?.id === record.id ? null : current));
  };

  const handleClearByDate = async (dateKey: string, label: string) => {
    if (!window.confirm(`确定清空「${label}」的历史记录吗？`)) {
      return;
    }

    await clearHistoryByDate(dateKey);
    setRecords((current) => current.filter((item) => item.dateKey !== dateKey));
  };

  const handleClearAll = async () => {
    if (!window.confirm("确定清空全部历史记录吗？此操作不可恢复。")) {
      return;
    }

    await clearAllHistoryImages();
    setRecords([]);
    setPreviewRecord(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#111827]/30 px-4 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-[1080px] flex-col overflow-hidden rounded-[24px] border border-gray-200 bg-white shadow-2xl shadow-[#111827]/15">
        <div className="flex items-start justify-between gap-4 border-b border-gray-200 px-6 py-5">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">历史生成图片库</h2>
            <p className="mt-1 text-sm text-gray-500">按日期查看本机保存的生成结果。</p>
          </div>
          <div className="flex items-center gap-2">
            {records.length > 0 ? (
              <button
                type="button"
                onClick={handleClearAll}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-red-200 bg-white px-3 text-sm font-semibold text-red-600 transition hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4" />
                清空全部历史
              </button>
            ) : null}
            <button
              type="button"
              aria-label="关闭历史记录"
              onClick={onClose}
              className="grid h-10 w-10 place-items-center rounded-xl border border-gray-200 bg-white text-gray-500 transition hover:border-[#6D5DF6]/50 hover:text-[#6D5DF6]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto bg-[#F6F7FB] px-6 py-5">
          {loading ? (
            <div className="grid min-h-[420px] place-items-center rounded-2xl border border-gray-200 bg-white">
              <div className="text-center">
                <Loader2 className="mx-auto h-7 w-7 animate-spin text-[#6D5DF6]" />
                <p className="mt-3 text-sm font-semibold text-gray-700">正在读取历史记录...</p>
              </div>
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
              {error}
            </div>
          ) : records.length === 0 ? (
            <div className="grid min-h-[420px] place-items-center rounded-2xl border border-dashed border-gray-200 bg-white text-center">
              <div>
                <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-[#F8FAFC] text-[#6D5DF6]">
                  <ImageIcon className="h-7 w-7" />
                </div>
                <h3 className="mt-5 text-sm font-semibold text-gray-900">暂无历史记录</h3>
                <p className="mt-2 text-sm text-gray-500">生成或增强成功后，图片会自动保存到这里。</p>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {groupedHistory.map((group) => (
                <section key={group.dateKey} className="rounded-2xl border border-gray-200 bg-white p-4">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900">{group.label}</h3>
                      <p className="mt-1 text-xs text-gray-500">{group.records.length} 张图片</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleClearByDate(group.dateKey, group.label)}
                      className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      清空当天
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-4">
                    {group.records.map((record) => (
                      <article
                        key={record.id}
                        className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm"
                      >
                        <button
                          type="button"
                          onClick={() => setPreviewRecord(record)}
                          className="block aspect-[4/5] w-full bg-[#F8FAFC]"
                        >
                          <img
                            src={record.thumbnailDataUrl ?? record.imageDataUrl}
                            alt={record.title}
                            className="h-full w-full object-contain"
                          />
                        </button>
                        <div className="space-y-2 p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="truncate text-sm font-semibold text-gray-900">
                                {record.title}
                              </div>
                              <div className="text-xs text-gray-500">{formatTime(record.createdAt)}</div>
                            </div>
                            <span
                              className={`shrink-0 rounded-full px-2 py-1 text-xs font-semibold ${
                                record.type === "enhanced"
                                  ? "bg-emerald-50 text-emerald-700"
                                  : "bg-[#F4F3FF] text-[#6D5DF6]"
                              }`}
                            >
                              {getTypeLabel(record.type)}
                            </span>
                          </div>

                          <div className="space-y-0.5 text-xs leading-5 text-gray-500">
                            {record.outputResolution ? <p>输出分辨率：{record.outputResolution}</p> : null}
                            {record.outputAspectRatio ? (
                              <p>
                                输出比例：
                                {record.outputAspectRatio === "original" && record.mappedAspectRatio
                                  ? `原图比例（映射为 ${record.mappedAspectRatio}）`
                                  : record.outputAspectRatio}
                              </p>
                            ) : null}
                            {record.model ? <p className="truncate">模型：{record.model}</p> : null}
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => downloadHistoryImage(record)}
                              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-white text-xs font-semibold text-gray-700 transition hover:border-[#6D5DF6]/50 hover:text-[#6D5DF6]"
                            >
                              <Download className="h-3.5 w-3.5" />
                              下载
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(record)}
                              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-white text-xs font-semibold text-gray-700 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              删除
                            </button>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-gray-200 bg-white px-6 py-4 text-xs leading-5 text-gray-500">
          历史记录只保存在当前浏览器本机。清理浏览器数据后，历史记录可能会被删除。
        </div>
      </div>

      {previewRecord ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#111827]/70 px-4">
          <div className="max-h-[92vh] w-full max-w-[920px] overflow-hidden rounded-[24px] bg-white shadow-2xl">
            <div className="flex items-center justify-between gap-3 border-b border-gray-200 px-5 py-4">
              <div className="min-w-0">
                <h3 className="truncate text-sm font-semibold text-gray-900">{previewRecord.title}</h3>
                <p className="mt-1 text-xs text-gray-500">{formatTime(previewRecord.createdAt)}</p>
              </div>
              <button
                type="button"
                aria-label="关闭预览"
                onClick={() => setPreviewRecord(null)}
                className="grid h-9 w-9 place-items-center rounded-xl border border-gray-200 bg-white text-gray-500 transition hover:text-[#6D5DF6]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="max-h-[calc(92vh-73px)] overflow-auto bg-[#F8FAFC] p-4">
              <img
                src={previewRecord.imageDataUrl}
                alt={previewRecord.title}
                className="mx-auto max-h-[78vh] rounded-2xl object-contain"
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
