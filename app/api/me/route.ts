import { currentUser } from "@clerk/nextjs/server";
import { ProfileService } from "../../../lib/services/profile.service";

export async function GET() {
  try {
    const user = await currentUser();

    if (!user) {
      return Response.json(
        {
          success: false,
          error: "Unauthorized",
        },
        { status: 401 },
      );
    }

    const email = user.emailAddresses[0]?.emailAddress || null;
    const profile = await ProfileService.ensureProfile(user.id, email);

    return Response.json({
      success: true,
      profile,
    });
  } catch (error: unknown) {
    console.error("ME API ERROR:", error);

    const message = error instanceof Error ? error.message : "Unknown error";

    return Response.json(
      {
        success: false,
        error: message,
      },
      { status: 500 },
    );
  }
}
