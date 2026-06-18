export type UploadedImage = {
  file: File;
  fileName: string;
  url: string;
  dimensions?: {
    width: number;
    height: number;
  };
  dimensionsError?: boolean;
};

export type MakeupIntensity = "light" | "medium" | "strong";
export type EditScope = "full-face" | "eyes" | "lips" | "blush" | "highlight";
export type PreservationLevel = "strict" | "normal" | "soft-optimize";
export type OutputCount = 1 | 2 | 4;
export type OutputResolution = "1K" | "2K";
export type OriginalAspect = "portrait" | "landscape" | "square" | "unknown";

export type ImageDimensions = {
  width: number;
  height: number;
};

export type GenerationSettings = {
  intensity: MakeupIntensity;
  scope: EditScope;
  preservation: PreservationLevel;
  outputCount: OutputCount;
  outputResolution: OutputResolution;
};

export type MockResult = {
  id: string;
  imageUrl: string;
  label: string;
  generatedAt: string;
  accent?: string;
  isMock?: boolean;
  outputResolution?: OutputResolution;
  originalAspect?: OriginalAspect;
  originalSize?: ImageDimensions;
  generatedOriginalSize?: ImageDimensions;
  finalOutputSize?: ImageDimensions;
};

export const MODEL_NAME = "Nano Banana 2";
export const MODEL_ID = "gemini-3.1-flash-image";

const accents = [
  "from-[#6D5DF6]/28 via-transparent to-[#3B82F6]/20",
  "from-[#3B82F6]/24 via-transparent to-[#6D5DF6]/24",
  "from-[#6D5DF6]/18 via-[#3B82F6]/12 to-transparent",
  "from-transparent via-[#6D5DF6]/18 to-[#3B82F6]/24"
];

export function createMockResults(
  sourceImage: UploadedImage,
  count: OutputCount,
  generationIndex: number
): MockResult[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `mock-${generationIndex}-${index + 1}-${Date.now()}`,
    imageUrl: sourceImage.url,
    label: `Mock 结果 ${index + 1}`,
    generatedAt: new Date().toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit"
    }),
    accent: accents[index % accents.length],
    isMock: true
  }));
}
