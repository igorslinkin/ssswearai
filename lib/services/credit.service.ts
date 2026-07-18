import { createSupabaseServerClient } from "../supabase/server";

export type CreditReservationResult = {
  success: boolean;
  credits: number;
};

export class CreditService {
  static async reserveCredits(
    userId: string,
    cost: number
  ): Promise<CreditReservationResult> {
    const supabase = createSupabaseServerClient();

    const { data, error } = await supabase.rpc("reserve_credits", {
      p_clerk_user_id: userId,
      p_cost: cost,
    });

    if (error) {
      throw error;
    }

    const reservation = data?.[0] as
      | CreditReservationResult
      | undefined;

    return (
      reservation ?? {
        success: false,
        credits: 0,
      }
    );
  }

  static async refundCredits(
    userId: string,
    cost: number
  ): Promise<void> {
    const supabase = createSupabaseServerClient();

    const { error } = await supabase.rpc("refund_credits", {
      p_clerk_user_id: userId,
      p_cost: cost,
    });

    if (error) {
      throw error;
    }
  }
}