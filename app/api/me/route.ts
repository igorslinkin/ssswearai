import { currentUser } from "@clerk/nextjs/server";
import { createSupabaseServerClient } from "../../../lib/supabase/server";

export async function GET() {
  try {
    const user = await currentUser();

    if (!user) {
      return Response.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const supabase = createSupabaseServerClient();

    const email = user.emailAddresses[0]?.emailAddress || null;

    const { data: existingProfile, error: selectError } = await supabase
      .from("profiles")
      .select("*")
      .eq("clerk_user_id", user.id)
      .single();

    if (selectError && selectError.code !== "PGRST116") {
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
        credits: 130,
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
  } catch (error: any) {
    console.error("ME API ERROR:", error);

    return Response.json(
      {
        success: false,
        error: error?.message || "Unknown error",
      },
      { status: 500 }
    );
  }
}