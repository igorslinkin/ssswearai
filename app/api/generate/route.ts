import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type GenerationMode =
  | "cyclorama"
  | "product"
  | "creative"
  | "image"
  | "mobile"
  | "tryon";

type AspectRatio = "4:5" | "3:4" | "9:16" | "1:1" | "2:3";

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
    cyclorama: "Clean studio cyclorama, white or light gray seamless background, soft studio light.",
    product: "Premium product-focused photo, clean background, sharp details, suitable for marketplace.",
    creative: "Creative fashion image, expressive composition, modern lighting, premium visual style.",
    image: "Premium image campaign photo, modern minimal fashion mood, Zara / IRNBY / FRHT / Monochrome level.",
    mobile: "Realistic mobile phone photo, natural light, casual UGC feeling, slightly imperfect framing.",
    tryon: "Realistic try-on photo, real human model wearing the garment naturally.",
  };

  return `
Use the uploaded garment photos as the PRIMARY reference.

The final image must be based on the exact uploaded clothing item.

CRITICAL GARMENT PRESERVATION:
- Preserve the same garment.
- Preserve the same color.
- Preserve the same silhouette.
- Preserve the same cut.
- Preserve the same fabric texture.
- Preserve all labels, tags, patches, embroidery, graphics, seams, zippers, pockets, buttons and construction details.
- Do not invent new logos.
- Do not remove existing labels.
- Do not change text or graphic placement.
- Do not replace the product with a generic garment.
- If front and back images are uploaded, use both to understand the full garment.
- If detail images are uploaded, use them to preserve small details.

SHOOTING MODE:
${modePrompt[input.mode]}

ASPECT RATIO:
${input.aspectRatio}

STYLE REFERENCES:
Use modern fashion photography as broad inspiration: Zara, IRNBY, FRHT, Monochrome.
Do not copy any exact brand campaign.

USER ADDITIONAL INSTRUCTIONS:
${input.userPrompt?.trim() || "No additional instructions."}

NEGATIVE RULES:
- No cartoon.
- No illustration.
- No 3D render.
- No plastic skin.
- No distorted hands.
- No duplicated sleeves.
- No fake text.
- No changed logo.
- No extra pockets.
- No missing tags.
- No AI artifacts.
- No low-quality catalog look.

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
  try {
    const formData = await req.formData();

    const front = formData.get("front") as File | null;
    const back = formData.get("back") as File | null;
    const details = formData.getAll("details") as File[];

    const mode = (formData.get("mode") as GenerationMode | null) || "cyclorama";
    const aspectRatio = (formData.get("aspectRatio") as AspectRatio | null) || "4:5";
    const userPrompt = (formData.get("userPrompt") as string | null) || "";

    if (!front) {
      return Response.json({ success: false, error: "Front image is required." }, { status: 400 });
    }

    const prompt = buildPrompt({ mode, aspectRatio, userPrompt });

    const content: any[] = [
      { type: "input_text", text: prompt },
      { type: "input_image", image_url: await fileToDataUrl(front) },
    ];

    if (back) {
      content.push({ type: "input_image", image_url: await fileToDataUrl(back) });
    }

    for (const detail of details) {
      content.push({ type: "input_image", image_url: await fileToDataUrl(detail) });
    }

    const response = await openai.responses.create({
      model: "gpt-5.5",
      input: [{ role: "user", content }],
      tools: [
        {
          type: "image_generation",
          quality: "medium",
          size: getImageSize(aspectRatio),
        } as any,
      ],
      tool_choice: { type: "image_generation" } as any,
    });

    const imageCall = response.output.find(
      (item: any) => item.type === "image_generation_call"
    ) as any;

    if (!imageCall?.result) {
      return Response.json(
        { success: false, error: response.output_text || "No image returned." },
        { status: 500 }
      );
    }

    return Response.json({
      success: true,
      image: `data:image/png;base64,${imageCall.result}`,
      meta: { mode, aspectRatio, detailsCount: details.length },
    });
  } catch (error: any) {
    console.error("GENERATION ERROR:", error);

    return Response.json(
      { success: false, error: error?.message || "Unknown error" },
      { status: 500 }
    );
  }
}