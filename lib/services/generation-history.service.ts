import type { GenerationMode } from "../config";
import { createGenerationSignedUrl } from "../storage";
import { createSupabaseServerClient } from "../supabase/server";
import type { AspectRatio } from "./generation.service";

type SaveGenerationInput = {
  userId: string;
  mode: GenerationMode;
  aspectRatio: AspectRatio;
  userPrompt: string;
  creditsSpent: number;
  imagePath: string;
};

type GetGenerationHistoryInput = {
  userId: string;
  page?: number;
  limit?: number;
};

type GenerationHistoryRow = {
  id: string;
  mode: GenerationMode;
  aspect_ratio: AspectRatio;
  prompt: string | null;
  credits_spent: number;
  image_path: string | null;
  created_at: string;
};

type GenerationStatsRow = {
  total_generations: number | string;
  total_credits_spent: number | string;
};

export type GenerationHistoryItem = {
  id: string;
  mode: GenerationMode;
  aspectRatio: AspectRatio;
  userPrompt: string;
  creditsSpent: number;
  imagePath: string;
  imageUrl: string;
  createdAt: string;
};

export type GenerationHistoryResult = {
  items: GenerationHistoryItem[];
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
};

export type GenerationStats = {
  totalGenerations: number;
  totalCreditsSpent: number;
};

export class GenerationHistoryService {
  static async saveGeneration({
    userId,
    mode,
    aspectRatio,
    userPrompt,
    creditsSpent,
    imagePath,
  }: SaveGenerationInput): Promise<void> {
    const supabase = createSupabaseServerClient();

    const { error } = await supabase.from("generations").insert({
      clerk_user_id: userId,
      mode,
      aspect_ratio: aspectRatio,
      prompt: userPrompt,
      credits_spent: creditsSpent,
      image_path: imagePath,
    });

    if (error) {
      throw new Error(
        `Generation history save failed: ${error.message}`
      );
    }
  }

  static async getGenerationHistory({
    userId,
    page = 1,
    limit = 12,
  }: GetGenerationHistoryInput): Promise<GenerationHistoryResult> {
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(24, Math.max(1, limit));

    const from = (safePage - 1) * safeLimit;
    const to = from + safeLimit - 1;

    const supabase = createSupabaseServerClient();

    const { data, error, count } = await supabase
      .from("generations")
      .select(
        `
          id,
          mode,
          aspect_ratio,
          prompt,
          credits_spent,
          image_path,
          created_at
        `,
        {
          count: "exact",
        }
      )
      .eq("clerk_user_id", userId)
      .not("image_path", "is", null)
      .order("created_at", {
        ascending: false,
      })
      .range(from, to);

    if (error) {
      throw new Error(
        `Generation history load failed: ${error.message}`
      );
    }

    const rows = (data ?? []) as GenerationHistoryRow[];
    
    const items = await Promise.all(
      rows.map(async (row): Promise<GenerationHistoryItem> => {
        const imagePath = row.image_path ?? "";

        const imageUrl = await createGenerationSignedUrl(imagePath);

        return {
          id: row.id,
          mode: row.mode,
          aspectRatio: row.aspect_ratio,
          userPrompt: row.prompt ?? "",
          creditsSpent: row.credits_spent,
          imagePath,
          imageUrl,
          createdAt: row.created_at,
        };
      })
    );

    const total = count ?? 0;

    return {
      items,
      page: safePage,
      limit: safeLimit,
      total,
      hasMore: from + items.length < total,
    };
  }

  static async getGenerationStats(
    userId: string
  ): Promise<GenerationStats> {
    const supabase = createSupabaseServerClient();

    const { data, error } = await supabase.rpc(
      "get_generation_stats",
      {
        p_clerk_user_id: userId,
      }
    );

    if (error) {
      throw new Error(
        `Generation stats load failed: ${error.message}`
      );
    }

    const stats = data?.[0] as GenerationStatsRow | undefined;

    return {
      totalGenerations: Number(stats?.total_generations ?? 0),
      totalCreditsSpent: Number(
        stats?.total_credits_spent ?? 0
      ),
    };
  }
}