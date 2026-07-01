import type {
  EditScope,
  MakeupIntensity,
  OutputAspectRatio,
  OutputResolution,
  PreservationLevel
} from "@/lib/mock";

const DB_NAME = "makeup_tool_history_db";
const DB_VERSION = 1;
const STORE_NAME = "history_images";
const MAX_HISTORY_ITEMS = 100;

export type HistoryImageType = "generated" | "enhanced";

export type HistoryImageRecord = {
  id: string;
  createdAt: string;
  dateKey: string;
  imageDataUrl: string;
  thumbnailDataUrl?: string;
  type: HistoryImageType;
  title: string;
  originalFileName?: string;
  referenceFileName?: string;
  outputResolution?: OutputResolution;
  outputAspectRatio?: OutputAspectRatio | string;
  mappedAspectRatio?: string;
  makeupIntensity?: MakeupIntensity | string;
  editArea?: EditScope | string;
  preserveLevel?: PreservationLevel | string;
  model?: string;
  prompt?: string;
};

export type SaveHistoryImageInput = Omit<HistoryImageRecord, "id" | "createdAt" | "dateKey"> & {
  id?: string;
  createdAt?: string;
};

function assertBrowser() {
  if (typeof window === "undefined" || !("indexedDB" in window)) {
    throw new Error("IndexedDB is not available in this environment.");
  }
}

function getLocalDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function openHistoryDb() {
  assertBrowser();

  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("createdAt", "createdAt", { unique: false });
        store.createIndex("dateKey", "dateKey", { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Failed to open history database."));
  });
}

function createTransaction<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>
) {
  return openHistoryDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, mode);
        const store = transaction.objectStore(STORE_NAME);
        const request = run(store);

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed."));
        transaction.oncomplete = () => db.close();
        transaction.onerror = () => {
          db.close();
          reject(transaction.error ?? new Error("IndexedDB transaction failed."));
        };
      })
  );
}

function loadImage(dataUrl: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Unable to load image for thumbnail."));
    image.src = dataUrl;
  });
}

export async function createHistoryThumbnail(dataUrl: string, maxSize = 320) {
  try {
    const image = await loadImage(dataUrl);
    const ratio = Math.min(1, maxSize / Math.max(image.naturalWidth, image.naturalHeight));
    const width = Math.max(1, Math.round(image.naturalWidth * ratio));
    const height = Math.max(1, Math.round(image.naturalHeight * ratio));
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    if (!context) {
      return undefined;
    }

    canvas.width = width;
    canvas.height = height;
    context.drawImage(image, 0, 0, width, height);

    return canvas.toDataURL("image/jpeg", 0.82);
  } catch {
    return undefined;
  }
}

async function getAllHistoryImagesUnsorted() {
  return createTransaction<HistoryImageRecord[]>("readonly", (store) => store.getAll());
}

export async function getAllHistoryImages() {
  const records = await getAllHistoryImagesUnsorted();

  return records.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

async function pruneHistoryLimit() {
  const records = await getAllHistoryImagesUnsorted();

  if (records.length <= MAX_HISTORY_ITEMS) {
    return;
  }

  const sortedOldestFirst = records.sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
  const overflow = sortedOldestFirst.slice(0, records.length - MAX_HISTORY_ITEMS);

  await Promise.all(overflow.map((record) => deleteHistoryImage(record.id)));
}

export async function saveHistoryImage(input: SaveHistoryImageInput) {
  const createdAtDate = input.createdAt ? new Date(input.createdAt) : new Date();
  const createdAt = createdAtDate.toISOString();
  const thumbnailDataUrl =
    input.thumbnailDataUrl ?? (await createHistoryThumbnail(input.imageDataUrl));
  const record: HistoryImageRecord = {
    ...input,
    id: input.id ?? `history-${createdAtDate.getTime()}-${crypto.randomUUID()}`,
    createdAt,
    dateKey: getLocalDateKey(createdAtDate),
    thumbnailDataUrl
  };

  await createTransaction<IDBValidKey>("readwrite", (store) => store.put(record));
  await pruneHistoryLimit();

  return record;
}

export async function deleteHistoryImage(id: string) {
  await createTransaction<undefined>("readwrite", (store) => store.delete(id));
}

export async function clearHistoryByDate(dateKey: string) {
  const records = await getAllHistoryImagesUnsorted();
  const targets = records.filter((record) => record.dateKey === dateKey);

  await Promise.all(targets.map((record) => deleteHistoryImage(record.id)));
}

export async function clearAllHistoryImages() {
  await createTransaction<undefined>("readwrite", (store) => store.clear());
}

export function getHistoryDateLabel(dateKey: string) {
  const today = getLocalDateKey(new Date());
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterday = getLocalDateKey(yesterdayDate);

  if (dateKey === today) {
    return "今天";
  }

  if (dateKey === yesterday) {
    return "昨天";
  }

  return dateKey;
}
