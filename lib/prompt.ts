export type GenerationMode =
  | "cyclorama"
  | "product"
  | "creative"
  | "model3d"
  | "image"
  | "mobile"
  | "tryon";

export type AspectRatio = "4:5" | "3:4" | "9:16" | "16:9" | "1:1" | "2:3";

export function getImageSize(aspectRatio: AspectRatio) {
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

export function buildPrompt(input: {
  mode: GenerationMode;
  aspectRatio: AspectRatio;
  userPrompt?: string;
}) {
  const modePrompt: Record<GenerationMode, string> = {
    cyclorama: `
Create a clean studio cyclorama photo.
White or light gray seamless background.
Commercial apparel photography.
Soft studio light.
Natural shadow under the model or product.
Focus on accurate garment presentation.
`,

    product: `
Create a premium product-focused photo.
The garment should be the main subject.
Clean background.
Sharp details.
Clear fabric texture.
Suitable for marketplace or e-commerce usage.
`,

    creative: `
Create a creative fashion image.
More expressive composition.
Interesting lighting.
Modern visual language.
Still preserve the garment exactly.
Do not turn it into abstract art.
`,

    model3d: `
Create one photorealistic premium 3D product visualization of the exact garment.
Display the garment alone with natural volume, as if supported by an invisible mannequin.
No person, no visible mannequin, no hanger, no rack and no flat lay.
Use a centered front or subtle front three-quarter view on a clean neutral background.
Preserve every construction and material detail exactly.
`,

    image: `
Create an image campaign photo.
Premium fashion brand mood.
Modern, minimal, stylish.
Reference the visual level of contemporary brands such as Zara, IRNBY, FRHT and Monochrome, but do not copy any specific campaign.
`,

    mobile: `
Create a realistic mobile phone photo.
It should look like a high-quality casual photo taken on a modern smartphone.
Natural light.
Slightly imperfect real-life framing.
UGC feeling.
Still premium and stylish.
`,

    tryon: `
Create a realistic try-on photo.
A real human model wears the garment.
The garment must fit naturally.
Show how the product looks on the body.
Do not redesign the garment.
`,
  };

  return `
You are an elite AI fashion photography director.

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
Use the references only as a quality and mood benchmark.

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