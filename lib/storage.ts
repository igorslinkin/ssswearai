import { randomUUID } from "node:crypto";
import { createSupabaseServerClient } from "./supabase/server";

const GENERATIONS_BUCKET = "generations";
const SIGNED_URL_TTL_SECONDS = 60 * 60;

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function buildRandomImagePath(): string {
  const now = new Date();

  const year = String(now.getUTCFullYear());
  const month = pad(now.getUTCMonth() + 1);
  const day = pad(now.getUTCDate());

  const fileId = randomUUID().replaceAll("-", "");
  const firstPrefix = fileId.slice(0, 2);
  const secondPrefix = fileId.slice(2, 4);

  return [
    year,
    month,
    day,
    firstPrefix,
    secondPrefix,
    `${fileId}.png`,
  ].join("/");
}

export async function uploadGeneratedImage(
  base64Image: string
): Promise<string> {
  const supabase = createSupabaseServerClient();
  const imagePath = buildRandomImagePath();
  const imageBuffer = Buffer.from(base64Image, "base64");

  const { error } = await supabase.storage
    .from(GENERATIONS_BUCKET)
    .upload(imagePath, imageBuffer, {
      contentType: "image/png",
      cacheControl: "3600",
      upsert: false,
    });

  if (error) {
    throw new Error(`Storage upload failed: ${error.message}`);
  }

  return imagePath;
}

export async function createGenerationSignedUrl(
  imagePath: string
): Promise<string> {
  const supabase = createSupabaseServerClient();

  const { data, error } = await supabase.storage
    .from(GENERATIONS_BUCKET)
    .createSignedUrl(imagePath, SIGNED_URL_TTL_SECONDS);

  if (error || !data?.signedUrl) {
    throw new Error(
      `Signed URL creation failed: ${
        error?.message || "No signed URL returned"
      }`
    );
  }

  return data.signedUrl;
}

export async function removeGeneratedImage(
  imagePath: string
): Promise<void> {
  const supabase = createSupabaseServerClient();

  const { error } = await supabase.storage
    .from(GENERATIONS_BUCKET)
    .remove([imagePath]);

  if (error) {
    throw new Error(`Storage cleanup failed: ${error.message}`);
  }
}