import { DEFAULT_FREE_CREDITS } from "../config";
import { createSupabaseServerClient } from "../supabase/server";

export type UserProfile = {
  id?: string;
  clerk_user_id: string;
  email: string | null;
  credits: number;
  created_at?: string;
  updated_at?: string;
};

function isUniqueViolation(error: { code?: string } | null): boolean {
  return error?.code === "23505";
}

export class ProfileService {
  static async ensureProfile(
    userId: string,
    email: string | null = null,
  ): Promise<UserProfile> {
    const supabase = createSupabaseServerClient();

    const { data: existingProfile, error: selectError } = await supabase
      .from("profiles")
      .select("*")
      .eq("clerk_user_id", userId)
      .maybeSingle();

    if (selectError) {
      throw new Error(`Profile load failed: ${selectError.message}`);
    }

    if (existingProfile) {
      if (email && existingProfile.email !== email) {
        const { data: updatedProfile, error: updateError } = await supabase
          .from("profiles")
          .update({ email })
          .eq("clerk_user_id", userId)
          .select("*")
          .single();

        if (updateError) {
          throw new Error(`Profile email update failed: ${updateError.message}`);
        }

        return updatedProfile as UserProfile;
      }

      return existingProfile as UserProfile;
    }

    const { data: createdProfile, error: insertError } = await supabase
      .from("profiles")
      .insert({
        clerk_user_id: userId,
        email,
        credits: DEFAULT_FREE_CREDITS,
      })
      .select("*")
      .maybeSingle();

    if (!insertError && createdProfile) {
      return createdProfile as UserProfile;
    }

    // /api/me and /api/history can arrive almost simultaneously after a
    // brand-new sign-in. If the other request created the row first, read it
    // instead of failing the whole account bootstrap.
    if (insertError && !isUniqueViolation(insertError)) {
      throw new Error(`Profile creation failed: ${insertError.message}`);
    }

    const { data: concurrentProfile, error: retryError } = await supabase
      .from("profiles")
      .select("*")
      .eq("clerk_user_id", userId)
      .maybeSingle();

    if (retryError) {
      throw new Error(`Profile reload failed: ${retryError.message}`);
    }

    if (!concurrentProfile) {
      throw new Error("Profile creation failed: profile row was not returned.");
    }

    return concurrentProfile as UserProfile;
  }
}
