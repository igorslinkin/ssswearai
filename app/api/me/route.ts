import { currentUser } from "@clerk/nextjs/server";
import { DEFAULT_FREE_CREDITS } from "../../../lib/config";
import { createSupabaseServerClient } from "../../../lib/supabase/server";

export async function GET() {
  try {
    const user = await currentUser();

    if (!user) {
      return Response.json(
        {
          success: false,
          error: "Unauthorized",
        },
        { status: 401 }
      );
    }

    const supabase = createSupabaseServerClient();
    const email = user.emailAddresses[0]?.emailAddress || null;

    const { data: existingProfile, error: selectError } = await supabase
      .from("profiles")
      .select("*")
      .eq("clerk_user_id", user.id)
      .maybeSingle();

    if (selectError) {
      throw selectError;
    }

    if (existingProfile) {
      return Response.json({
        success: true,
        profile: existingProfile,
      });
    }

    const { data: newProfile, error: insertError } = await supabase
      .from("profiles")
      .insert({
        clerk_user_id: user.id,
        email,
        credits: DEFAULT_FREE_CREDITS,
      })
      .select("*")
      .single();

    if (insertError) {
      throw insertError;
    }

    return Response.json({
      success: true,
      profile: newProfile,
    });
  } catch (error: unknown) {
    console.error("ME API ERROR:", error);

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