import { auth } from "@clerk/nextjs/server";
import { CreditService } from "../../../lib/services/credit.service";
import { GenerationHistoryService } from "../../../lib/services/generation-history.service";

function parsePositiveInteger(
  value: string | null,
  fallback: number
): number {
  if (!value) {
    return fallback;
  }

  const parsedValue = Number.parseInt(value, 10);

  if (!Number.isFinite(parsedValue) || parsedValue < 1) {
    return fallback;
  }

  return parsedValue;
}

function jsonResponse(
  body: unknown,
  status = 200
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

export async function GET(request: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return jsonResponse(
        {
          success: false,
          error: "Unauthorized",
        },
        401
      );
    }

    const url = new URL(request.url);

    const page = parsePositiveInteger(
      url.searchParams.get("page"),
      1
    );

    const limit = Math.min(
      24,
      parsePositiveInteger(
        url.searchParams.get("limit"),
        12
      )
    );

    const transactionLimit = Math.min(
      50,
      parsePositiveInteger(
        url.searchParams.get("transactionLimit"),
        10
      )
    );

    const [account, stats, history] = await Promise.all([
      CreditService.getAccountSummary(
        userId,
        transactionLimit
      ),

      GenerationHistoryService.getGenerationStats(userId),

      GenerationHistoryService.getGenerationHistory({
        userId,
        page,
        limit,
      }),
    ]);

    return jsonResponse({
      success: true,
      account,
      stats,
      history,
    });
  } catch (error: unknown) {
    console.error("HISTORY LOAD ERROR:", error);

    const message =
      error instanceof Error
        ? error.message
        : "Generation history load failed.";

    return jsonResponse(
      {
        success: false,
        error: message,
      },
      500
    );
  }
}