import OpenAI from "openai";
import { auth } from "@clerk/nextjs/server";
import {
  GENERATION_COSTS,
  type GenerationMode,
} from "../../../lib/config";
import { createSupabaseServerClient } from "../../../lib/supabase/server";
import {
  createGenerationSignedUrl,
  removeGeneratedImage,
  uploadGeneratedImage,
} from "../../../lib/storage";
import { CreditService } from "../../../lib/services/credit.service";

type AspectRatio = "4:5" | "3:4" | "9:16" | "1:1" | "2:3";

function isGenerationMode(value: unknown): value is GenerationMode {
  return (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(GENERATION_COSTS, value)
  );
}

function isAspectRatio(value: unknown): value is AspectRatio {
  return (
    value === "4:5" ||
    value === "3:4" ||
    value === "9:16" ||
    value === "1:1" ||
    value === "2:3"
  );
}

function getImageSize(aspectRatio: AspectRatio) {
  const sizes: Record<AspectRatio, string> = {
    "4:5": "1024x1280",
    "3:4": "1024x1360",
    "9:16": "1024x1792",
    "1:1": "1024x1024",
    "2:3": "1024x1536",
  };

  return sizes[aspectRatio];
}

function buildPrompt(input: {
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

async function fileToDataUrl(file: File) {
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const base64 = buffer.toString("base64");
  const mimeType = file.type || "image/jpeg";

  return `data:${mimeType};base64,${base64}`;
}

export async function POST(req: Request) {
  let creditsReserved = false;
  let userIdForRefund: string | null = null;
  let generationCostForRefund = 0;
  let uploadedImagePath: string | null = null;

  try {
    const { userId } = await auth();

    if (!userId) {
      return Response.json(
        {
          success: false,
          error: "Unauthorized",
        },
        { status: 401 }
      );
    }

    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return Response.json(
        {
          success: false,
          error: "OPENAI_API_KEY is missing.",
        },
        { status: 500 }
      );
    }

    const formData = await req.formData();

    const frontValue = formData.get("front");
    const backValue = formData.get("back");
    const detailValues = formData.getAll("details");

    const front = frontValue instanceof File ? frontValue : null;
    const back = backValue instanceof File ? backValue : null;

    const details = detailValues.filter(
      (value): value is File => value instanceof File
    );

    const rawMode = formData.get("mode");
    const rawAspectRatio = formData.get("aspectRatio");
    const rawUserPrompt = formData.get("userPrompt");

    const mode: GenerationMode = isGenerationMode(rawMode)
      ? rawMode
      : "cyclorama";

    const aspectRatio: AspectRatio = isAspectRatio(rawAspectRatio)
      ? rawAspectRatio
      : "4:5";

    const userPrompt =
      typeof rawUserPrompt === "string" ? rawUserPrompt : "";

    if (!front) {
      return Response.json(
        {
          success: false,
          error: "Front image is required.",
        },
        { status: 400 }
      );
    }

const generationCost = GENERATION_COSTS[mode];
const supabase = createSupabaseServerClient();

const reservation = await CreditService.reserveCredits(
  userId,
  generationCost
);

    if (!reservation?.success) {
      return Response.json(
        {
          success: false,
          error: "Not enough Credits.",
          code: "INSUFFICIENT_CREDITS",
          credits: reservation.credits,
          requiredCredits: generationCost,
        },
        { status: 402 }
      );
    }

    creditsReserved = true;
    userIdForRefund = userId;
    generationCostForRefund = generationCost;

    const prompt = buildPrompt({
      mode,
      aspectRatio,
      userPrompt,
    });

    const content: Array<Record<string, unknown>> = [
      {
        type: "input_text",
        text: prompt,
      },
      {
        type: "input_image",
        image_url: await fileToDataUrl(front),
      },
    ];

    if (back) {
      content.push({
        type: "input_image",
        image_url: await fileToDataUrl(back),
      });
    }

    for (const detail of details) {
      content.push({
        type: "input_image",
        image_url: await fileToDataUrl(detail),
      });
    }

    const openai = new OpenAI({
      apiKey,
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
          size: getImageSize(aspectRatio),
        } as never,
      ],
      tool_choice: {
        type: "image_generation",
      } as never,
    });

    const imageCall = response.output.find(
      (item) => item.type === "image_generation_call"
    ) as
      | {
          type: "image_generation_call";
          result?: string;
        }
      | undefined;

    if (!imageCall?.result) {
      throw new Error(
        response.output_text || "No image returned from OpenAI."
      );
    }

    uploadedImagePath = await uploadGeneratedImage(imageCall.result);

    const signedImageUrl = await createGenerationSignedUrl(
      uploadedImagePath
    );

    const { error: historyError } = await supabase
      .from("generations")
      .insert({
        clerk_user_id: userId,
        mode,
        aspect_ratio: aspectRatio,
        prompt: userPrompt,
        credits_spent: generationCost,
        image_path: uploadedImagePath,
      });

    if (historyError) {
      throw new Error(
        `Generation history save failed: ${historyError.message}`
      );
    }

    creditsReserved = false;

    return Response.json({
      success: true,
      image: signedImageUrl,
      imagePath: uploadedImagePath,
      credits: reservation.credits,
      creditsSpent: generationCost,
      meta: {
        mode,
        aspectRatio,
        detailsCount: details.length,
      },
    });
  } catch (error: unknown) {
    console.error("GENERATION ERROR:", error);

    if (uploadedImagePath) {
      try {
        await removeGeneratedImage(uploadedImagePath);
      } catch (cleanupError) {
        console.error("STORAGE CLEANUP ERROR:", cleanupError);
      }
    }

    if (
      creditsReserved &&
      userIdForRefund &&
      generationCostForRefund > 0
    ) {
      try {
        await CreditService.refundCredits(
  userIdForRefund,
  generationCostForRefund
);
      } catch (refundError) {
        console.error("CREDITS REFUND FAILED:", refundError);
      }
    }

    const message =
      error instanceof Error ? error.message : "Unknown error";

    return Response.json(
      {
        success: false,
        error: message,
      },
      { status: 500 }
    );
  }
}