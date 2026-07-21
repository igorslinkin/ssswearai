import {
  GENERATION_COSTS,
  type GenerationMode,
} from "../config";
import type { AspectRatio } from "./generation.service";

export type ParsedGenerationRequest = {
  front: File;
  back: File | null;
  details: File[];
  mode: GenerationMode;
  aspectRatio: AspectRatio;
  userPrompt: string;
};

export class GenerationRequestError extends Error {
  readonly status: number;

  constructor(message: string, status = 400) {
    super(message);

    this.name = "GenerationRequestError";
    this.status = status;
  }
}

export class GenerationRequestService {
  private static isGenerationMode(
    value: unknown
  ): value is GenerationMode {
    return (
      typeof value === "string" &&
      Object.prototype.hasOwnProperty.call(
        GENERATION_COSTS,
        value
      )
    );
  }

  private static isAspectRatio(
    value: unknown
  ): value is AspectRatio {
    return (
      value === "4:5" ||
      value === "3:4" ||
      value === "9:16" ||
      value === "1:1" ||
      value === "2:3"
    );
  }

  static async parse(
    request: Request
  ): Promise<ParsedGenerationRequest> {
    const formData = await request.formData();

    const frontValue = formData.get("front");
    const backValue = formData.get("back");
    const detailValues = formData.getAll("details");

    const front =
      frontValue instanceof File ? frontValue : null;

    const back =
      backValue instanceof File ? backValue : null;

    const details = detailValues.filter(
      (value): value is File => value instanceof File
    );

    const rawMode = formData.get("mode");
    const rawAspectRatio = formData.get("aspectRatio");
    const rawUserPrompt = formData.get("userPrompt");

    const mode: GenerationMode =
      this.isGenerationMode(rawMode)
        ? rawMode
        : "cyclorama";

    const aspectRatio: AspectRatio =
      this.isAspectRatio(rawAspectRatio)
        ? rawAspectRatio
        : "4:5";

    const userPrompt =
      typeof rawUserPrompt === "string"
        ? rawUserPrompt
        : "";

    if (!front) {
      throw new GenerationRequestError(
        "Front image is required."
      );
    }

    if (details.length > 4) {
      throw new GenerationRequestError(
        "A maximum of 4 detail images is allowed."
      );
    }

    return {
      front,
      back,
      details,
      mode,
      aspectRatio,
      userPrompt,
    };
  }
}