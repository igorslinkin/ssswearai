import { auth } from "@clerk/nextjs/server";
import { GENERATION_COSTS } from "../../../lib/config";
import { CreditService } from "../../../lib/services/credit.service";
import { GenerationHistoryService } from "../../../lib/services/generation-history.service";
import {
  GenerationRequestError,
  GenerationRequestService,
} from "../../../lib/services/generation-request.service";
import { GenerationService } from "../../../lib/services/generation.service";
import {
  createGenerationSignedUrl,
  removeGeneratedImage,
  uploadGeneratedImage,
} from "../../../lib/storage";

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

    const {
      front,
      back,
      details,
      mode,
      aspectRatio,
      userPrompt,
    } = await GenerationRequestService.parse(req);

    const generationCost = GENERATION_COSTS[mode];

    const reservation = await CreditService.reserveCredits(
      userId,
      generationCost
    );

    if (!reservation.success) {
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

    const { imageBase64 } = await GenerationService.generateImage({
      apiKey,
      mode,
      aspectRatio,
      userPrompt,
      front,
      back,
      details,
    });

    uploadedImagePath = await uploadGeneratedImage(imageBase64);

    const signedImageUrl = await createGenerationSignedUrl(
      uploadedImagePath
    );

    await GenerationHistoryService.saveGeneration({
      userId,
      mode,
      aspectRatio,
      userPrompt,
      creditsSpent: generationCost,
      imagePath: uploadedImagePath,
    });

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

    if (error instanceof GenerationRequestError) {
      return Response.json(
        {
          success: false,
          error: error.message,
        },
        {
          status: error.status,
        }
      );
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