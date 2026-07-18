import { createSupabaseServerClient } from "../supabase/server";

export type CreditReservationResult = {
  success: boolean;
  credits: number;
};

type CreditTransactionRow = {
  id: string;
  type: string;
  credits_delta: number;
  balance_after: number;
  amount_rub: number | null;
  description: string | null;
  payment_id: string | null;
  created_at: string;
};

export type CreditTransaction = {
  id: string;
  type: string;
  creditsDelta: number;
  balanceAfter: number;
  amountRub: number | null;
  description: string;
  paymentId: string | null;
  createdAt: string;
};

export type CreditAccountSummary = {
  balance: number;
  transactions: CreditTransaction[];
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

  static async getAccountSummary(
    userId: string,
    transactionLimit = 10
  ): Promise<CreditAccountSummary> {
    const supabase = createSupabaseServerClient();

    const safeTransactionLimit = Math.min(
      50,
      Math.max(1, transactionLimit)
    );

    const [
      profileResult,
      transactionsResult,
    ] = await Promise.all([
      supabase
        .from("profiles")
        .select("credits")
        .eq("clerk_user_id", userId)
        .single(),

      supabase
        .from("credit_transactions")
        .select(
          `
            id,
            type,
            credits_delta,
            balance_after,
            amount_rub,
            description,
            payment_id,
            created_at
          `
        )
        .eq("user_id", userId)
        .order("created_at", {
          ascending: false,
        })
        .limit(safeTransactionLimit),
    ]);

    if (profileResult.error) {
      throw new Error(
        `Credit balance load failed: ${profileResult.error.message}`
      );
    }

    if (transactionsResult.error) {
      throw new Error(
        `Credit transactions load failed: ${transactionsResult.error.message}`
      );
    }

    const rows = (
      transactionsResult.data ?? []
    ) as CreditTransactionRow[];

    return {
      balance: profileResult.data.credits,
      transactions: rows.map((row) => ({
        id: row.id,
        type: row.type,
        creditsDelta: row.credits_delta,
        balanceAfter: row.balance_after,
        amountRub: row.amount_rub,
        description: row.description ?? "",
        paymentId: row.payment_id,
        createdAt: row.created_at,
      })),
    };
  }
}