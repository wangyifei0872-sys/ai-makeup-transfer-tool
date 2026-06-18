export type AnalyzeRequestSettings = {
  makeupIntensity: "light" | "medium" | "strong";
  editAreas: "fullFace" | "eyes" | "lips" | "blush" | "highlight";
  preserveLevel: "strict" | "normal" | "softEnhance";
  outputCount: 1 | 2 | 4;
};

export type MakeupAnalysisResult = {
  original_image_analysis: {
    face_shape: string;
    eye_shape: string;
    lip_shape: string;
    skin_tone: string;
    hair_style: string;
    art_style: string;
    lighting: string;
    must_keep: string[];
  };
  makeup_reference_analysis: {
    eyeshadow: string;
    eyeliner: string;
    eyelashes: string;
    brows: string;
    blush: string;
    lip_color: string;
    lip_texture: string;
    highlight: string;
    eye_color: string;
    gem_or_accessory_color: string;
    overall_makeup_mood: string;
  };
  edit_strategy: {
    intensity: string;
    focus_areas: string[];
    preserve_priority: string[];
    avoid_changes: string[];
  };
  nano_prompt_en: string;
  negative_prompt_en: string;
};

export const MAKEUP_ANALYSIS_SYSTEM_PROMPT = `You are a professional makeup-transfer analysis assistant for stylized female illustrations.

You will receive:
1. an original beauty illustration
2. a makeup reference image
3. user editing settings

Your job:
- analyze the original illustration and identify what must be preserved
- analyze the makeup reference and extract the makeup features
- create a structured JSON
- create an English editing prompt for Nano Banana 2
- keep the original girl's identity, face shape, facial proportions, hairstyle, pose, expression, art style, composition, lighting, brightness, contrast, and saturation unchanged as much as possible
- only transfer makeup-related visual features

Extract:
- eyeshadow color, placement, blending, shimmer
- eyeliner shape and thickness
- eyelash density and length
- eyebrow color and style
- blush color and placement
- lip color, gloss, and softness
- highlights
- eye color if relevant
- gems or decorative color if relevant

The Nano Banana 2 prompt must be direct, clear, and suitable for image editing.
It must emphasize preservation of the original character and only modify makeup-related areas.

Output valid JSON only.
Do not output markdown.
Do not add extra explanation.`;

export const MAKEUP_ANALYSIS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "original_image_analysis",
    "makeup_reference_analysis",
    "edit_strategy",
    "nano_prompt_en",
    "negative_prompt_en"
  ],
  properties: {
    original_image_analysis: {
      type: "object",
      additionalProperties: false,
      required: [
        "face_shape",
        "eye_shape",
        "lip_shape",
        "skin_tone",
        "hair_style",
        "art_style",
        "lighting",
        "must_keep"
      ],
      properties: {
        face_shape: { type: "string" },
        eye_shape: { type: "string" },
        lip_shape: { type: "string" },
        skin_tone: { type: "string" },
        hair_style: { type: "string" },
        art_style: { type: "string" },
        lighting: { type: "string" },
        must_keep: {
          type: "array",
          items: { type: "string" }
        }
      }
    },
    makeup_reference_analysis: {
      type: "object",
      additionalProperties: false,
      required: [
        "eyeshadow",
        "eyeliner",
        "eyelashes",
        "brows",
        "blush",
        "lip_color",
        "lip_texture",
        "highlight",
        "eye_color",
        "gem_or_accessory_color",
        "overall_makeup_mood"
      ],
      properties: {
        eyeshadow: { type: "string" },
        eyeliner: { type: "string" },
        eyelashes: { type: "string" },
        brows: { type: "string" },
        blush: { type: "string" },
        lip_color: { type: "string" },
        lip_texture: { type: "string" },
        highlight: { type: "string" },
        eye_color: { type: "string" },
        gem_or_accessory_color: { type: "string" },
        overall_makeup_mood: { type: "string" }
      }
    },
    edit_strategy: {
      type: "object",
      additionalProperties: false,
      required: ["intensity", "focus_areas", "preserve_priority", "avoid_changes"],
      properties: {
        intensity: { type: "string" },
        focus_areas: {
          type: "array",
          items: { type: "string" }
        },
        preserve_priority: {
          type: "array",
          items: { type: "string" }
        },
        avoid_changes: {
          type: "array",
          items: { type: "string" }
        }
      }
    },
    nano_prompt_en: { type: "string" },
    negative_prompt_en: { type: "string" }
  }
} as const;

export function buildMakeupAnalysisPrompt(settings: AnalyzeRequestSettings) {
  return `Analyze the two provided images for an AI makeup transfer workflow.

Image order:
1. Original beauty illustration
2. Makeup reference image

User editing settings:
- makeupIntensity: ${settings.makeupIntensity}
- editAreas: ${settings.editAreas}
- preserveLevel: ${settings.preserveLevel}
- outputCount: ${settings.outputCount}

Nano Banana 2 prompt direction:
Apply the makeup style from the reference image to the girl in the original illustration.
Preserve the original girl's identity, face shape, eye shape, lip shape, hairstyle, expression, pose, composition, art style, line quality, lighting, brightness, contrast, and saturation.
Only modify makeup-related areas.
Do not change the background.
Do not add text.
Do not redesign the character.
Do not distort facial features.

Return JSON matching the required schema exactly.`;
}
