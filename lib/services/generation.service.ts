import OpenAI from "openai";
import sharp from "sharp";
import {
  type GenerationMode,
} from "../config";

export type AspectRatio =
  | "4:5"
  | "3:4"
  | "9:16"
  | "16:9"
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
      "16:9": "1536x1024",
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
      model3d:
        "Photorealistic premium 3D product visualization of the exact garment, displayed alone without a person, hanger or rack. Give the garment natural volume as if supported by an invisible mannequin. Use a centered front or subtle front three-quarter view, a clean neutral studio background, accurate material response, realistic seams and soft contact shadow. Preserve the original construction exactly and do not create multiple copies of the garment.",
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

${input.mode === "model3d" ? `3D PRODUCT MODEL RULES:
- Create one photorealistic digital twin of the garment, not a fashion photograph with a person.
- Show the garment alone, with believable volume and gravity, as if supported by an invisible mannequin.
- No human body, face, hands, visible mannequin, hanger, clothing rack or flat lay.
- Use a centered front or subtle front three-quarter camera angle.
- Keep the entire garment inside the frame with safe margins, especially for 16:9 cropping.
- Use a clean white, warm-white or light-gray seamless background and a soft realistic shadow.
- Preserve the exact fabric, silhouette, proportions, stitching, labels, graphics and hardware.
- Render only one garment and do not show front and back as two separate copies.` : `HUMAN REALISM:
- Natural human skin texture.
- Visible natural pores and minor skin imperfections.
- Realistic facial texture.
- No glossy skin.
- No waxy face.
- No plastic skin.
- No excessive beauty retouching.
- No over-smoothed skin.`}

COMPOSITION SAFETY:
- Keep the primary subject centered with enough safe space around it.
- For 16:9 output, keep all critical garment details away from the top and bottom crop edges.

SHOOTING MODE:
${modePrompt[input.mode]}

ASPECT RATIO:
${input.aspectRatio}

USER ADDITIONAL INSTRUCTIONS:
${input.userPrompt?.trim() || "No additional instructions."}

NEGATIVE RULES:
${input.mode === "model3d" ? "No person, no visible mannequin, no hanger, no rack, no flat lay, no multiple garment copies," : "No cartoon, no illustration, no 3D render,"} no fake text, no changed logo, no missing tags, no AI artifacts.

FINAL OUTPUT:
${input.mode === "model3d" ? "Generate one photorealistic premium 3D product render of the exact garment." : "Generate one realistic premium fashion photo."}
`;
  }

  private static async fileToDataUrl(file: File) {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64 = buffer.toString("base64");
    const mimeType = file.type || "image/jpeg";

    return `data:${mimeType};base64,${base64}`;
  }

  private static async postProcessImage(
    imageBase64: string,
    aspectRatio: AspectRatio
  ): Promise<string> {
    if (aspectRatio !== "16:9") {
      return imageBase64;
    }

    const source = Buffer.from(imageBase64, "base64");
    const output = await sharp(source)
      .resize({
        width: 1536,
        height: 864,
        fit: "cover",
        position: "centre",
      })
      .png()
      .toBuffer();

    return output.toString("base64");
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
      imageBase64: await this.postProcessImage(
        imageCall.result,
        input.aspectRatio
      ),
    };
  }
}