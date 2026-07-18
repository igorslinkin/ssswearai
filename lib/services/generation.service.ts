import OpenAI from "openai";
import {
  type GenerationMode,
} from "../config";

export type AspectRatio =
  | "4:5"
  | "3:4"
  | "9:16"
  | "1:1"
  | "2:3";

type GenerateImageInput = {
  apiKey: string;
  mode: GenerationMode;
  aspectRatio: AspectRatio;
  userPrompt?: string;
  front: File;
  back?: File | null;
  details?: File[];
};

type ImageGenerationCall = {
  type: "image_generation_call";
  result?: string;
};

export class GenerationService {
  private static getImageSize(aspectRatio: AspectRatio) {
    const sizes: Record<AspectRatio, string> = {
      "4:5": "1024x1280",
      "3:4": "1024x1360",
      "9:16": "1024x1792",
      "1:1": "1024x1024",
      "2:3": "1024x1536",
    };

    return sizes[aspectRatio];
  }

  private static buildPrompt(input: {
    mode: GenerationMode;
    aspectRatio: AspectRatio;
    userPrompt?: string;
  }) {
    const modePrompt: Record<GenerationMode, string> = {
      cyclorama:
        "Clean studio cyclorama, white or light gray seamless background, soft studio light.",
      product:
        "Premium product-focused photo, clean background, sharp details, suitable for marketplace.",
      creative:
        "Creative fashion image, expressive composition, modern lighting, premium visual style.",
      image:
        "Premium image campaign photo, modern minimal fashion mood, Zara / IRNBY / FRHT / Monochrome level.",
      mobile:
        "Realistic mobile phone photo, natural light, casual UGC feeling, slightly imperfect framing.",
      tryon:
        "Realistic try-on photo, real human model wearing the garment naturally.",
    };

    return `
Use the uploaded garment photos as the PRIMARY reference.

CRITICAL GARMENT PRESERVATION:
- Preserve the same garment.
- Preserve color, silhouette, cut, texture, labels, tags, patches, embroidery, seams, zippers, pockets and construction details.
- Do not invent new logos.
- Do not remove existing labels.
- Do not change text or graphic placement.
- Do not replace the product with a generic garment.
- If detail images are uploaded, treat them as mandatory preservation references.

HUMAN REALISM:
- Natural human skin texture.
- Visible natural pores and minor skin imperfections.
- Realistic facial texture.
- No glossy skin.
- No waxy face.
- No plastic skin.
- No excessive beauty retouching.
- No over-smoothed skin.

SHOOTING MODE:
${modePrompt[input.mode]}

ASPECT RATIO:
${input.aspectRatio}

USER ADDITIONAL INSTRUCTIONS:
${input.userPrompt?.trim() || "No additional instructions."}

NEGATIVE RULES:
No cartoon, no illustration, no 3D render, no fake text, no changed logo, no missing tags, no AI artifacts.

FINAL OUTPUT:
Generate one realistic premium fashion photo.
`;
  }

  private static async fileToDataUrl(file: File) {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64 = buffer.toString("base64");
    const mimeType = file.type || "image/jpeg";

    return `data:${mimeType};base64,${base64}`;
  }

  static async generateImage(input: GenerateImageInput) {
    const prompt = this.buildPrompt({
      mode: input.mode,
      aspectRatio: input.aspectRatio,
      userPrompt: input.userPrompt,
    });

    const content: Array<Record<string, unknown>> = [
      {
        type: "input_text",
        text: prompt,
      },
      {
        type: "input_image",
        image_url: await this.fileToDataUrl(input.front),
      },
    ];

    if (input.back) {
      content.push({
        type: "input_image",
        image_url: await this.fileToDataUrl(input.back),
      });
    }

    for (const detail of input.details ?? []) {
      content.push({
        type: "input_image",
        image_url: await this.fileToDataUrl(detail),
      });
    }

    const openai = new OpenAI({
      apiKey: input.apiKey,
    });

    const response = await openai.responses.create({
      model: "gpt-5.5",
      input: [
        {
          role: "user",
          content: content as never,
        },
      ],
      tools: [
        {
          type: "image_generation",
          quality: "medium",
          size: this.getImageSize(input.aspectRatio),
        } as never,
      ],
      tool_choice: {
        type: "image_generation",
      } as never,
    });

    const imageCall = response.output.find(
      (item) => item.type === "image_generation_call"
    ) as ImageGenerationCall | undefined;

    if (!imageCall?.result) {
      throw new Error(
        response.output_text || "No image returned from OpenAI."
      );
    }

    return {
      imageBase64: imageCall.result,
    };
  }
}