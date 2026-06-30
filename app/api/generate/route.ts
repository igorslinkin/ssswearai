import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function fileToDataUrl(file: File) {
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const base64 = buffer.toString("base64");
  const mimeType = file.type || "image/jpeg";

  return `data:${mimeType};base64,${base64}`;
}

function buildPrompt(shootType: string | null) {
  const preset = shootType || "editorial";

  return `
Use the uploaded garment photos as the primary and mandatory reference.

The uploaded images show the exact clothing item that must be preserved.

Task:
Create ONE realistic fashion photo based on the uploaded garment.

Shoot type:
${preset}

Critical garment preservation rules:
- Keep the same garment.
- Preserve the original color.
- Preserve the original silhouette.
- Preserve the same cut, seams, proportions, fabric texture, labels, patches, embroidery, graphics and visible construction details.
- Do not invent a different product.
- Do not replace the garment with a generic hoodie, jacket, t-shirt or dress.
- Do not change logos, text, tags, prints, embroidery or decorative details.
- If front and back images are provided, use both to understand the full garment.

Visual direction:
- Realistic commercial fashion photography.
- Natural human model wearing the garment.
- Premium fashion brand quality.
- No illustration.
- No cartoon.
- No 3D render.
- No unrealistic AI artifacts.
- The final image must look like a real photo.
`;
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();

    const front = formData.get("front") as File | null;
    const back = formData.get("back") as File | null;
    const detail = formData.get("detail") as File | null;
    const shootType = formData.get("shootType") as string | null;

    if (!front) {
      return Response.json(
        { success: false, error: "Front image is required." },
        { status: 400 }
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      return Response.json(
        { success: false, error: "OPENAI_API_KEY is missing." },
        { status: 500 }
      );
    }

    console.log("🚀 START IMAGE GENERATION");
    console.log("Front:", front.name, front.type, front.size);
    console.log("Back:", back?.name, back?.type, back?.size);
    console.log("Detail:", detail?.name, detail?.type, detail?.size);
    console.log("Shoot type:", shootType);

    const content: any[] = [
      {
        type: "input_text",
        text: buildPrompt(shootType),
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

    if (detail) {
      content.push({
        type: "input_image",
        image_url: await fileToDataUrl(detail),
      });
    }

    const response = await openai.responses.create({
      model: "gpt-5.5",
      input: [
        {
          role: "user",
          content,
        },
      ],
      tools: [
        {
          type: "image_generation",
          action: "edit",
          quality: "medium",
          size: "1024x1024",
        },
      ],
      tool_choice: {
        type: "image_generation",
      },
    });

    const imageCall = response.output.find(
      (item: any) => item.type === "image_generation_call"
    ) as any;

    if (!imageCall?.result) {
      console.log("NO IMAGE RESPONSE:", response.output_text);

      return Response.json(
        {
          success: false,
          error: response.output_text || "No image returned from OpenAI.",
        },
        { status: 500 }
      );
    }

    const image = `data:image/png;base64,${imageCall.result}`;

    console.log("✅ IMAGE GENERATED");

    return Response.json({
      success: true,
      images: [image],
    });
  } catch (error: any) {
    console.error("❌ GENERATION ERROR:", error);

    return Response.json(
      {
        success: false,
        error: error?.message || "Unknown error",
      },
      { status: 500 }
    );
  }
}