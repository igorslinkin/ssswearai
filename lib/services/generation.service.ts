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
    detailsCount: number;
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
- ${input.detailsCount > 0
    ? `Exactly ${input.detailsCount} detail reference image${input.detailsCount === 1 ? " is" : "s are"} attached. Review every detail reference individually before generating.`
    : "No separate detail reference images are attached."}
- Every attached detail reference belongs to the same garment shown in the primary front image.
- Treat every attached detail reference as mandatory preservation information, not as an alternative garment or a style reference.
- Merge all visible information from all detail references into one accurate understanding of the garment.
- Do not ignore, simplify, relocate, duplicate or invent any detail shown in those references.

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
    const details = (input.details ?? []).slice(0, 4);

    const prompt = this.buildPrompt({
      mode: input.mode,
      aspectRatio: input.aspectRatio,
      userPrompt: input.userPrompt,
      detailsCount: details.length,
    });

    const content: Array<Record<string, unknown>> = [
      {
        type: "input_text",
        text: prompt,
      },
      {
        type: "input_text",
        text: "PRIMARY FRONT REFERENCE: this image defines the garment identity, silhouette, base color and front construction.",
      },
      {
        type: "input_image",
        image_url: await this.fileToDataUrl(input.front),
      },
    ];

    if (input.back) {
      content.push(
        {
          type: "input_text",
          text: "BACK REFERENCE: this is the back view of the same garment. Use it to preserve the complete construction.",
        },
        {
          type: "input_image",
          image_url: await this.fileToDataUrl(input.back),
        },
      );
    }

    for (const [index, detail] of details.entries()) {
      content.push(
        {
          type: "input_text",
          text: `DETAIL REFERENCE ${index + 1} OF ${details.length}: this is a mandatory close-up of the same garment. Preserve every visible material, label, seam, print, embroidery, hardware or construction detail from this image.`,
        },
        {
          type: "input_image",
          image_url: await this.fileToDataUrl(detail),
        },
      );
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