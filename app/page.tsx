"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { SignInButton, UserButton, useUser } from "@clerk/nextjs";
import {
  GENERATION_COSTS,
  type GenerationMode,
} from "../lib/config";

type Ratio = "4:5" | "3:4" | "9:16" | "1:1" | "2:3";
type AppView = "studio" | "history" | "credits" | "account";

type ModeOption = {
  value: GenerationMode;
  title: string;
  description: string;
};

type ProfileResponse = {
  success: boolean;
  profile?: {
    credits: number;
  };
  error?: string;
};

type GenerateResponse = {
  success: boolean;
  image?: string;
  imagePath?: string;
  credits?: number;
  creditsSpent?: number;
  requiredCredits?: number;
  code?: string;
  error?: string;
};

type CreditTransaction = {
  id: string;
  type: string;
  creditsDelta: number;
  balanceAfter: number;
  amountRub: number | null;
  description: string | null;
  paymentId: string | null;
  createdAt: string;
};

type GenerationHistoryItem = {
  id: string;
  mode: GenerationMode;
  aspectRatio: Ratio;
  userPrompt: string;
  creditsSpent: number;
  imagePath: string;
  imageUrl: string;
  createdAt: string;
};

type HistoryResponse = {
  success: boolean;
  account?: {
    balance: number;
    transactions: CreditTransaction[];
  };
  stats?: {
    totalGenerations: number;
    totalCreditsSpent: number;
  };
  history?: {
    items: GenerationHistoryItem[];
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
  error?: string;
};

const modes: ModeOption[] = [
  {
    value: "cyclorama",
    title: "Cyclorama",
    description: "Clean studio background",
  },
  {
    value: "product",
    title: "Product",
    description: "Marketplace-ready frame",
  },
  {
    value: "creative",
    title: "Creative",
    description: "Bold visual concept",
  },
  {
    value: "image",
    title: "Campaign",
    description: "Editorial brand mood",
  },
  {
    value: "mobile",
    title: "Mobile",
    description: "Realistic UGC photo",
  },
  {
    value: "tryon",
    title: "Try-on",
    description: "Model wearing garment",
  },
];

const ratios: Ratio[] = ["4:5", "3:4", "9:16", "1:1", "2:3"];

const modeTitles: Record<GenerationMode, string> = {
  cyclorama: "Cyclorama",
  product: "Product",
  creative: "Creative",
  image: "Campaign",
  mobile: "Mobile",
  tryon: "Try-on",
};

async function compressImage(
  file: File,
  maxSize = 1400,
  quality = 0.82
): Promise<File> {
  const imageBitmap = await createImageBitmap(file);

  const scale = Math.min(
    1,
    maxSize / Math.max(imageBitmap.width, imageBitmap.height)
  );

  const width = Math.round(imageBitmap.width * scale);
  const height = Math.round(imageBitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");

  if (!context) {
    imageBitmap.close();
    throw new Error("Canvas is not supported.");
  }

  context.drawImage(imageBitmap, 0, 0, width, height);
  imageBitmap.close();

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => {
        if (result) {
          resolve(result);
        } else {
          reject(new Error("Image compression failed."));
        }
      },
      "image/jpeg",
      quality
    );
  });

  return new File(
    [blob],
    `${file.name.replace(/\.[^.]+$/, "")}-compressed.jpg`,
    {
      type: "image/jpeg",
      lastModified: Date.now(),
    }
  );
}

function formatFileSize(file: File): string {
  return `${(file.size / 1024 / 1024).toFixed(2)} MB`;
}

function createDownloadFileName(
  prefix = "ssswear-ai",
  extension = "png"
): string {
  const now = new Date();

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");

  return `${prefix}-${year}-${month}-${day}-${hours}-${minutes}.${extension}`;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatCredits(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

function getTransactionTitle(transaction: CreditTransaction): string {
  if (transaction.description?.trim()) {
    return transaction.description;
  }

  if (transaction.type === "generation") {
    return "Image generation";
  }

  if (transaction.type === "purchase") {
    return "Credits purchase";
  }

  if (transaction.type === "refund") {
    return "Credits refund";
  }

  return "Credits transaction";
}

export default function Page() {
  const { isSignedIn, isLoaded, user } = useUser();

  const [activeView, setActiveView] = useState<AppView>("studio");

  const [credits, setCredits] = useState<number | null>(null);
  const [creditsLoading, setCreditsLoading] = useState(false);

  const [frontFile, setFrontFile] = useState<File | null>(null);
  const [backFile, setBackFile] = useState<File | null>(null);
  const [detailFiles, setDetailFiles] = useState<File[]>([]);

  const [mode, setMode] = useState<GenerationMode>("cyclorama");
  const [aspectRatio, setAspectRatio] = useState<Ratio>("4:5");
  const [userPrompt, setUserPrompt] = useState("");

  const [image, setImage] = useState("");
  const [imagePath, setImagePath] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const [historyItems, setHistoryItems] = useState<GenerationHistoryItem[]>([]);
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [totalGenerations, setTotalGenerations] = useState(0);
  const [totalCreditsSpent, setTotalCreditsSpent] = useState(0);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyHasMore, setHistoryHasMore] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyLoadingMore, setHistoryLoadingMore] = useState(false);
  const [historyError, setHistoryError] = useState("");

  const [selectedHistoryItem, setSelectedHistoryItem] =
    useState<GenerationHistoryItem | null>(null);

  const generationCost = GENERATION_COSTS[mode];

  const hasEnoughCredits =
    credits !== null && credits >= generationCost;

  const uploadedCount = useMemo(() => {
    return (
      Number(Boolean(frontFile)) +
      Number(Boolean(backFile)) +
      detailFiles.length
    );
  }, [frontFile, backFile, detailFiles]);

  const loadProfile = useCallback(async () => {
    if (!isSignedIn) {
      setCredits(null);
      return;
    }

    try {
      setCreditsLoading(true);

      const response = await fetch("/api/me", {
        method: "GET",
        cache: "no-store",
      });

      const data = (await response.json()) as ProfileResponse;

      if (!response.ok || !data.success || !data.profile) {
        throw new Error(
          data.error || "Failed to load user profile."
        );
      }

      setCredits(data.profile.credits);
    } catch (profileError) {
      console.error("PROFILE LOAD ERROR:", profileError);
      setCredits(null);
    } finally {
      setCreditsLoading(false);
    }
  }, [isSignedIn]);

  const loadHistory = useCallback(
    async ({
      page = 1,
      append = false,
    }: {
      page?: number;
      append?: boolean;
    } = {}) => {
      if (!isSignedIn) {
        setHistoryItems([]);
        setTransactions([]);
        setTotalGenerations(0);
        setTotalCreditsSpent(0);
        setHistoryTotal(0);
        setHistoryPage(1);
        setHistoryHasMore(false);
        return;
      }

      try {
        if (append) {
          setHistoryLoadingMore(true);
        } else {
          setHistoryLoading(true);
        }

        setHistoryError("");

        const response = await fetch(
          `/api/history?page=${page}&limit=12&transactionLimit=20`,
          {
            method: "GET",
            cache: "no-store",
          }
        );

        const data = (await response.json()) as HistoryResponse;

        if (
          !response.ok ||
          !data.success ||
          !data.account ||
          !data.stats ||
          !data.history
        ) {
          throw new Error(
            data.error || "Failed to load generation history."
          );
        }

        setCredits(data.account.balance);
        setTransactions(data.account.transactions);
        setTotalGenerations(data.stats.totalGenerations);
        setTotalCreditsSpent(data.stats.totalCreditsSpent);
        setHistoryTotal(data.history.total);
        setHistoryPage(data.history.page);
        setHistoryHasMore(data.history.hasMore);

        setHistoryItems((currentItems) => {
          if (!append) {
            return data.history?.items ?? [];
          }

          const newItems = data.history?.items ?? [];
          const existingIds = new Set(
            currentItems.map((item) => item.id)
          );

          return [
            ...currentItems,
            ...newItems.filter((item) => !existingIds.has(item.id)),
          ];
        });
      } catch (historyLoadError) {
        console.error("HISTORY LOAD ERROR:", historyLoadError);

        setHistoryError(
          historyLoadError instanceof Error
            ? historyLoadError.message
            : "Failed to load generation history."
        );
      } finally {
        setHistoryLoading(false);
        setHistoryLoadingMore(false);
      }
    },
    [isSignedIn]
  );

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    if (!selectedHistoryItem) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelectedHistoryItem(null);
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [selectedHistoryItem]);

  const downloadImageFromUrl = async (
    imageUrl: string,
    fileName: string
  ) => {
    const response = await fetch(imageUrl, {
      method: "GET",
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(
        "The download link has expired. Refresh the history and try again."
      );
    }

    const blob = await response.blob();
    const objectUrl = window.URL.createObjectURL(blob);

    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = fileName;
    anchor.style.display = "none";

    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    window.setTimeout(() => {
      window.URL.revokeObjectURL(objectUrl);
    }, 1000);
  };

  const handleDownload = async () => {
    if (!image || downloading) {
      return;
    }

    try {
      setDownloading(true);
      setError("");

      await downloadImageFromUrl(
        image,
        createDownloadFileName()
      );
    } catch (downloadError) {
      console.error("IMAGE DOWNLOAD ERROR:", downloadError);

      setError(
        downloadError instanceof Error
          ? downloadError.message
          : "Image download failed."
      );
    } finally {
      setDownloading(false);
    }
  };

  const handleHistoryDownload = async (
    item: GenerationHistoryItem
  ) => {
    if (downloading) {
      return;
    }

    try {
      setDownloading(true);
      setHistoryError("");

      await downloadImageFromUrl(
        item.imageUrl,
        createDownloadFileName(`ssswear-ai-${item.mode}`)
      );
    } catch (downloadError) {
      console.error("HISTORY IMAGE DOWNLOAD ERROR:", downloadError);

      setHistoryError(
        downloadError instanceof Error
          ? downloadError.message
          : "Image download failed."
      );
    } finally {
      setDownloading(false);
    }
  };

  const handleUseHistorySettings = (
    item: GenerationHistoryItem
  ) => {
    setMode(item.mode);
    setAspectRatio(item.aspectRatio);
    setUserPrompt(item.userPrompt);
    setSelectedHistoryItem(null);
    setActiveView("studio");
    setError("");

    window.setTimeout(() => {
      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    }, 0);
  };

  const handleGenerate = async () => {
    if (!isSignedIn) {
      setError("Please sign in to generate images.");
      return;
    }

    if (credits === null) {
      setError("Credits are still loading. Please try again.");
      return;
    }

    if (credits < generationCost) {
      setError(
        `Not enough Credits. This generation requires ${generationCost} Credits.`
      );
      return;
    }

    if (!frontFile) {
      setError("Upload FRONT photo first.");
      return;
    }

    setLoading(true);
    setError("");
    setImage("");
    setImagePath("");

    try {
      const formData = new FormData();

      const compressedFront = await compressImage(frontFile);
      formData.append("front", compressedFront);

      if (backFile) {
        const compressedBack = await compressImage(backFile);
        formData.append("back", compressedBack);
      }

      for (const file of detailFiles) {
        const compressedDetail = await compressImage(file);
        formData.append("details", compressedDetail);
      }

      formData.append("mode", mode);
      formData.append("aspectRatio", aspectRatio);
      formData.append("userPrompt", userPrompt);

      const response = await fetch("/api/generate", {
        method: "POST",
        body: formData,
      });

      const data = (await response.json()) as GenerateResponse;

      if (typeof data.credits === "number") {
        setCredits(data.credits);
      }

      if (!response.ok || !data.success || !data.image) {
        if (data.code === "INSUFFICIENT_CREDITS") {
          setError(
            `Not enough Credits. Required: ${
              data.requiredCredits ?? generationCost
            }.`
          );
          return;
        }

        setError(data.error || "Generation failed.");
        return;
      }

      setImage(data.image);
      setImagePath(data.imagePath || "");

      await loadHistory({
        page: 1,
        append: false,
      });
    } catch (generationError) {
      console.error("GENERATION REQUEST ERROR:", generationError);

      setError(
        generationError instanceof Error
          ? generationError.message
          : "API request failed."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleLoadMoreHistory = async () => {
    if (!historyHasMore || historyLoadingMore) {
      return;
    }

    await loadHistory({
      page: historyPage + 1,
      append: true,
    });
  };

  if (!isLoaded) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f7f5f0] text-[#111111]">
        <p className="text-sm text-black/50">Loading...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f7f5f0] text-[#111111]">
      <header className="sticky top-0 z-30 border-b border-black/10 bg-[#f7f5f0]/90 backdrop-blur">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between px-6 py-5">
          <button
            type="button"
            onClick={() => setActiveView("studio")}
            className="text-left"
          >
            <div className="text-sm font-semibold tracking-[0.22em]">
              SSSWEAR AI
            </div>

            <div className="mt-1 hidden text-xs text-black/50 sm:block">
              Professional fashion photography from your garment
            </div>
          </button>

          {isSignedIn && (
            <nav className="hidden items-center gap-8 text-sm text-black/55 md:flex">
              <NavigationButton
                active={activeView === "studio"}
                onClick={() => setActiveView("studio")}
              >
                Studio
              </NavigationButton>

              <NavigationButton
                active={activeView === "history"}
                onClick={() => setActiveView("history")}
              >
                History
              </NavigationButton>

              <NavigationButton
                active={activeView === "credits"}
                onClick={() => setActiveView("credits")}
              >
                Credits
              </NavigationButton>

              <NavigationButton
                active={activeView === "account"}
                onClick={() => setActiveView("account")}
              >
                Account
              </NavigationButton>
            </nav>
          )}

          <div className="flex items-center gap-3">
            {isSignedIn ? (
              <>
                <button
                  type="button"
                  onClick={() => setActiveView("credits")}
                  className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm transition hover:border-black/25"
                >
                  {creditsLoading
                    ? "Loading Credits"
                    : `${formatCredits(credits ?? 0)} Credits`}
                </button>

                <UserButton />
              </>
            ) : (
              <SignInButton mode="modal">
                <button
                  type="button"
                  className="rounded-full bg-black px-5 py-2.5 text-sm font-medium text-white"
                >
                  Sign in
                </button>
              </SignInButton>
            )}
          </div>
        </div>

        {isSignedIn && (
          <div className="border-t border-black/5 px-6 py-3 md:hidden">
            <div className="mx-auto flex max-w-[1440px] gap-2 overflow-x-auto">
              <MobileNavigationButton
                active={activeView === "studio"}
                onClick={() => setActiveView("studio")}
              >
                Studio
              </MobileNavigationButton>

              <MobileNavigationButton
                active={activeView === "history"}
                onClick={() => setActiveView("history")}
              >
                History
              </MobileNavigationButton>

              <MobileNavigationButton
                active={activeView === "credits"}
                onClick={() => setActiveView("credits")}
              >
                Credits
              </MobileNavigationButton>

              <MobileNavigationButton
                active={activeView === "account"}
                onClick={() => setActiveView("account")}
              >
                Account
              </MobileNavigationButton>
            </div>
          </div>
        )}
      </header>

      {!isSignedIn ? (
        <section className="mx-auto flex min-h-[calc(100vh-90px)] max-w-[980px] items-center justify-center px-6 py-20">
          <div className="rounded-[36px] border border-black/10 bg-white p-10 text-center shadow-[0_30px_90px_rgba(0,0,0,0.08)]">
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-black text-3xl text-white">
              ✦
            </div>

            <h1 className="text-5xl font-semibold tracking-[-0.06em]">
              Create fashion photos from your garment.
            </h1>

            <p className="mx-auto mt-5 max-w-xl text-base leading-7 text-black/55">
              Upload front, back and detail photos of your product.
              Generate premium AI fashion photography for campaigns,
              marketplaces and social media.
            </p>

            <SignInButton mode="modal">
              <button
                type="button"
                className="mt-8 rounded-2xl bg-black px-7 py-4 text-sm font-semibold text-white transition hover:bg-black/85"
              >
                Sign in to start
              </button>
            </SignInButton>

            <p className="mt-4 text-xs text-black/40">
              Email-only access. No Google login.
            </p>
          </div>
        </section>
      ) : (
        <>
          {activeView === "studio" && (
            <StudioView
              credits={credits}
              creditsLoading={creditsLoading}
              frontFile={frontFile}
              backFile={backFile}
              detailFiles={detailFiles}
              mode={mode}
              aspectRatio={aspectRatio}
              userPrompt={userPrompt}
              image={image}
              imagePath={imagePath}
              error={error}
              loading={loading}
              downloading={downloading}
              generationCost={generationCost}
              hasEnoughCredits={hasEnoughCredits}
              uploadedCount={uploadedCount}
              onFrontFileChange={setFrontFile}
              onBackFileChange={setBackFile}
              onDetailFilesChange={setDetailFiles}
              onModeChange={(nextMode) => {
                setMode(nextMode);
                setError("");
              }}
              onAspectRatioChange={setAspectRatio}
              onPromptChange={setUserPrompt}
              onGenerate={handleGenerate}
              onDownload={handleDownload}
              onOpenCredits={() => setActiveView("credits")}
            />
          )}

          {activeView === "history" && (
            <HistoryView
              items={historyItems}
              total={historyTotal}
              totalGenerations={totalGenerations}
              totalCreditsSpent={totalCreditsSpent}
              loading={historyLoading}
              loadingMore={historyLoadingMore}
              hasMore={historyHasMore}
              error={historyError}
              onRefresh={() =>
                void loadHistory({
                  page: 1,
                  append: false,
                })
              }
              onLoadMore={() => void handleLoadMoreHistory()}
              onOpenItem={setSelectedHistoryItem}
              onOpenStudio={() => setActiveView("studio")}
            />
          )}

          {activeView === "credits" && (
            <CreditsView
              balance={credits ?? 0}
              totalCreditsSpent={totalCreditsSpent}
              transactions={transactions}
              loading={historyLoading}
              error={historyError}
              onRefresh={() =>
                void loadHistory({
                  page: 1,
                  append: false,
                })
              }
            />
          )}

          {activeView === "account" && (
            <AccountView
              email={user?.primaryEmailAddress?.emailAddress ?? ""}
              name={user?.fullName ?? user?.firstName ?? ""}
              balance={credits ?? 0}
              totalGenerations={totalGenerations}
              totalCreditsSpent={totalCreditsSpent}
            />
          )}
        </>
      )}

      {selectedHistoryItem && (
        <HistoryModal
          item={selectedHistoryItem}
          downloading={downloading}
          onClose={() => setSelectedHistoryItem(null)}
          onDownload={() =>
            void handleHistoryDownload(selectedHistoryItem)
          }
          onUseSettings={() =>
            handleUseHistorySettings(selectedHistoryItem)
          }
        />
      )}
    </main>
  );
}

function StudioView({
  credits,
  creditsLoading,
  frontFile,
  backFile,
  detailFiles,
  mode,
  aspectRatio,
  userPrompt,
  image,
  imagePath,
  error,
  loading,
  downloading,
  generationCost,
  hasEnoughCredits,
  uploadedCount,
  onFrontFileChange,
  onBackFileChange,
  onDetailFilesChange,
  onModeChange,
  onAspectRatioChange,
  onPromptChange,
  onGenerate,
  onDownload,
  onOpenCredits,
}: {
  credits: number | null;
  creditsLoading: boolean;
  frontFile: File | null;
  backFile: File | null;
  detailFiles: File[];
  mode: GenerationMode;
  aspectRatio: Ratio;
  userPrompt: string;
  image: string;
  imagePath: string;
  error: string;
  loading: boolean;
  downloading: boolean;
  generationCost: number;
  hasEnoughCredits: boolean;
  uploadedCount: number;
  onFrontFileChange: (file: File | null) => void;
  onBackFileChange: (file: File | null) => void;
  onDetailFilesChange: (files: File[]) => void;
  onModeChange: (mode: GenerationMode) => void;
  onAspectRatioChange: (ratio: Ratio) => void;
  onPromptChange: (prompt: string) => void;
  onGenerate: () => void;
  onDownload: () => void;
  onOpenCredits: () => void;
}) {
  return (
    <section className="mx-auto grid max-w-[1440px] gap-6 px-6 py-6 lg:grid-cols-[520px_1fr]">
      <aside className="space-y-5">
        <div className="rounded-[28px] border border-black/10 bg-white p-6 shadow-[0_20px_60px_rgba(0,0,0,0.06)]">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-semibold tracking-[-0.04em]">
                New generation
              </h1>

              <p className="mt-2 text-sm leading-6 text-black/55">
                Upload garment photos, choose a shooting mode and
                create one premium AI fashion image.
              </p>
            </div>

            <div className="rounded-full bg-black px-3 py-1 text-xs text-white">
              {uploadedCount} files
            </div>
          </div>

          <div className="grid gap-3">
            <UploadCard
              title="FRONT"
              description="Main front view of the garment"
              file={frontFile}
              onChange={onFrontFileChange}
              required
            />

            <UploadCard
              title="BACK"
              description="Back view helps preserve construction"
              file={backFile}
              onChange={onBackFileChange}
            />

            <DetailsUpload
              files={detailFiles}
              onChange={onDetailFilesChange}
            />
          </div>
        </div>

        <div className="rounded-[28px] border border-black/10 bg-white p-6 shadow-[0_20px_60px_rgba(0,0,0,0.05)]">
          <SectionTitle
            title="Photo type"
            subtitle="Choose the production context"
          />

          <div className="mt-4 grid grid-cols-2 gap-3">
            {modes.map((item) => {
              const selected = mode === item.value;
              const itemCost = GENERATION_COSTS[item.value];

              return (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => onModeChange(item.value)}
                  className={[
                    "rounded-2xl border p-4 text-left transition",
                    selected
                      ? "border-black bg-black text-white"
                      : "border-black/10 bg-[#fbfaf7] hover:border-black/25",
                  ].join(" ")}
                >
                  <div className="text-sm font-semibold">
                    {item.title}
                  </div>

                  <div
                    className={[
                      "mt-1 text-xs leading-5",
                      selected
                        ? "text-white/65"
                        : "text-black/45",
                    ].join(" ")}
                  >
                    {item.description}
                  </div>

                  <div
                    className={[
                      "mt-3 text-xs font-semibold",
                      selected ? "text-white" : "text-black",
                    ].join(" ")}
                  >
                    {itemCost} Credits
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-[28px] border border-black/10 bg-white p-6 shadow-[0_20px_60px_rgba(0,0,0,0.05)]">
          <SectionTitle
            title="Format"
            subtitle="Final image aspect ratio"
          />

          <div className="mt-4 flex flex-wrap gap-2">
            {ratios.map((ratio) => (
              <button
                key={ratio}
                type="button"
                onClick={() => onAspectRatioChange(ratio)}
                className={[
                  "rounded-full border px-5 py-3 text-sm transition",
                  aspectRatio === ratio
                    ? "border-black bg-black text-white"
                    : "border-black/10 bg-[#fbfaf7] hover:border-black/25",
                ].join(" ")}
              >
                {ratio}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-[28px] border border-black/10 bg-white p-6 shadow-[0_20px_60px_rgba(0,0,0,0.05)]">
          <SectionTitle
            title="Additional instructions"
            subtitle="Optional creative direction"
          />

          <textarea
            value={userPrompt}
            onChange={(event) =>
              onPromptChange(event.target.value)
            }
            placeholder="Example: natural daylight, summer mood, realistic skin texture, street location, shot on iPhone"
            rows={5}
            className="mt-4 w-full resize-none rounded-2xl border border-black/10 bg-[#fbfaf7] p-4 text-sm leading-6 outline-none transition placeholder:text-black/35 focus:border-black/30"
          />

          <button
            type="button"
            onClick={onGenerate}
            disabled={
              loading ||
              creditsLoading ||
              credits === null ||
              !hasEnoughCredits
            }
            className="mt-5 w-full rounded-2xl bg-black px-5 py-4 text-sm font-semibold text-white transition hover:bg-black/85 disabled:cursor-not-allowed disabled:bg-black/35"
          >
            {loading
              ? "Preparing photos and generating..."
              : creditsLoading || credits === null
                ? "Loading Credits..."
                : !hasEnoughCredits
                  ? `Not enough Credits • ${generationCost} required`
                  : `Generate photo • ${generationCost} Credits`}
          </button>

          {!creditsLoading &&
            credits !== null &&
            !hasEnoughCredits && (
              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <div className="text-sm font-medium text-amber-900">
                  You do not have enough Credits.
                </div>

                <div className="mt-1 text-xs leading-5 text-amber-700">
                  Your balance is {formatCredits(credits)} Credits.
                  This mode requires {generationCost} Credits.
                </div>

                <button
                  type="button"
                  onClick={onOpenCredits}
                  className="mt-3 rounded-full bg-amber-900 px-4 py-2 text-xs font-medium text-white"
                >
                  Buy Credits
                </button>
              </div>
            )}

          {error && (
            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          )}
        </div>
      </aside>

      <section className="min-h-[calc(100vh-120px)] rounded-[32px] border border-black/10 bg-[#111111] p-5 shadow-[0_30px_80px_rgba(0,0,0,0.12)]">
        <div className="flex h-full min-h-[720px] flex-col rounded-[24px] bg-[#181818]">
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
            <div>
              <div className="text-sm font-medium text-white">
                Preview
              </div>

              <div className="mt-1 text-xs text-white/40">
                Result appears here after generation
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/50">
                {generationCost} Credits
              </div>

              <div className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/50">
                {aspectRatio}
              </div>
            </div>
          </div>

          <div className="flex flex-1 items-center justify-center p-6">
            {loading && (
              <div className="max-w-sm text-center">
                <div className="mx-auto h-10 w-10 animate-spin rounded-full border border-white/20 border-t-white" />

                <div className="mt-5 text-sm font-medium text-white">
                  Creating fashion image
                </div>

                <div className="mt-2 text-sm leading-6 text-white/40">
                  We compress your photos and generate one premium
                  result. This can take about a minute.
                </div>

                <div className="mt-3 text-xs text-white/30">
                  {generationCost} Credits are reserved during
                  generation.
                </div>
              </div>
            )}

            {!loading && !image && (
              <div className="max-w-md text-center">
                <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full border border-white/10 bg-white/5 text-3xl">
                  ✦
                </div>

                <h2 className="text-3xl font-semibold tracking-[-0.04em] text-white">
                  Your generated photo will appear here.
                </h2>

                <p className="mt-4 text-sm leading-6 text-white/40">
                  Upload at least the front image, choose the
                  production mode and start generation.
                </p>
              </div>
            )}

            {!loading && image && (
              <div className="w-full max-w-[760px]">
                <img
                  src={image}
                  alt="Generated result"
                  className="w-full rounded-[24px] object-contain shadow-[0_30px_80px_rgba(0,0,0,0.35)]"
                />

                <div className="mt-5 flex flex-wrap justify-center gap-3">
                  <button
                    type="button"
                    onClick={onDownload}
                    disabled={downloading}
                    className="rounded-full bg-white px-5 py-3 text-sm font-medium text-black transition hover:bg-white/85 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {downloading ? "Downloading..." : "Download PNG"}
                  </button>

                  <button
                    type="button"
                    onClick={onGenerate}
                    disabled={
                      loading ||
                      credits === null ||
                      credits < generationCost
                    }
                    className="rounded-full border border-white/15 px-5 py-3 text-sm font-medium text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Regenerate • {generationCost} Credits
                  </button>
                </div>

                {imagePath && (
                  <div className="mt-4 text-center text-[11px] text-white/25">
                    Saved securely in your generation history
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </section>
    </section>
  );
}

function HistoryView({
  items,
  total,
  totalGenerations,
  totalCreditsSpent,
  loading,
  loadingMore,
  hasMore,
  error,
  onRefresh,
  onLoadMore,
  onOpenItem,
  onOpenStudio,
}: {
  items: GenerationHistoryItem[];
  total: number;
  totalGenerations: number;
  totalCreditsSpent: number;
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  error: string;
  onRefresh: () => void;
  onLoadMore: () => void;
  onOpenItem: (item: GenerationHistoryItem) => void;
  onOpenStudio: () => void;
}) {
  return (
    <section className="mx-auto max-w-[1440px] px-6 py-8">
      <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
        <div>
          <div className="text-sm font-semibold uppercase tracking-[0.2em] text-black/40">
            Library
          </div>

          <h1 className="mt-3 text-4xl font-semibold tracking-[-0.05em] md:text-6xl">
            Generation history
          </h1>

          <p className="mt-4 max-w-2xl text-sm leading-6 text-black/50">
            All generated images are stored here with their mode,
            format, prompt and generation date.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="rounded-full border border-black/10 bg-white px-5 py-3 text-sm font-medium transition hover:border-black/25 disabled:opacity-50"
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>

          <button
            type="button"
            onClick={onOpenStudio}
            className="rounded-full bg-black px-5 py-3 text-sm font-medium text-white transition hover:bg-black/85"
          >
            New generation
          </button>
        </div>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Generated images"
          value={formatCredits(totalGenerations)}
        />

        <StatCard
          label="Credits spent"
          value={formatCredits(totalCreditsSpent)}
        />

        <StatCard
          label="Images in history"
          value={formatCredits(total)}
        />
      </div>

      {error && (
        <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading && items.length === 0 ? (
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <HistorySkeleton key={index} />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="mt-8 rounded-[32px] border border-black/10 bg-white px-8 py-20 text-center shadow-[0_20px_60px_rgba(0,0,0,0.05)]">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-black text-2xl text-white">
            ✦
          </div>

          <h2 className="mt-6 text-3xl font-semibold tracking-[-0.04em]">
            No generated images yet
          </h2>

          <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-black/50">
            Create your first AI fashion photo. It will automatically
            appear in this library after generation.
          </p>

          <button
            type="button"
            onClick={onOpenStudio}
            className="mt-6 rounded-full bg-black px-6 py-3 text-sm font-medium text-white"
          >
            Open Studio
          </button>
        </div>
      ) : (
        <>
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {items.map((item) => (
              <HistoryCard
                key={item.id}
                item={item}
                onClick={() => onOpenItem(item)}
              />
            ))}
          </div>

          {hasMore && (
            <div className="mt-8 flex justify-center">
              <button
                type="button"
                onClick={onLoadMore}
                disabled={loadingMore}
                className="rounded-full border border-black/10 bg-white px-6 py-3 text-sm font-medium transition hover:border-black/25 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loadingMore ? "Loading..." : "Load more"}
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function CreditsView({
  balance,
  totalCreditsSpent,
  transactions,
  loading,
  error,
  onRefresh,
}: {
  balance: number;
  totalCreditsSpent: number;
  transactions: CreditTransaction[];
  loading: boolean;
  error: string;
  onRefresh: () => void;
}) {
  return (
    <section className="mx-auto max-w-[1180px] px-6 py-8">
      <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
        <div>
          <div className="text-sm font-semibold uppercase tracking-[0.2em] text-black/40">
            Billing
          </div>

          <h1 className="mt-3 text-4xl font-semibold tracking-[-0.05em] md:text-6xl">
            Credits
          </h1>

          <p className="mt-4 max-w-2xl text-sm leading-6 text-black/50">
            Your balance is used for image generations. Different
            production modes have different costs.
          </p>
        </div>

        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="self-start rounded-full border border-black/10 bg-white px-5 py-3 text-sm font-medium transition hover:border-black/25 disabled:opacity-50 md:self-auto"
        >
          {loading ? "Refreshing..." : "Refresh balance"}
        </button>
      </div>

      {error && (
        <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="mt-8 grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[32px] bg-black p-8 text-white shadow-[0_30px_80px_rgba(0,0,0,0.16)]">
          <div className="text-sm uppercase tracking-[0.18em] text-white/45">
            Current balance
          </div>

          <div className="mt-6 text-6xl font-semibold tracking-[-0.06em]">
            {formatCredits(balance)}
          </div>

          <div className="mt-2 text-sm text-white/45">Credits</div>

          <div className="mt-8 rounded-[24px] border border-white/10 bg-white/5 p-5">
            <div className="text-sm font-medium">
              Credits purchase is coming next
            </div>

            <p className="mt-2 text-sm leading-6 text-white/45">
              This section is ready for connection to Robokassa or
              another payment provider. The button below is currently
              a visual placeholder.
            </p>

            <button
              type="button"
              disabled
              className="mt-5 w-full cursor-not-allowed rounded-2xl bg-white px-5 py-4 text-sm font-semibold text-black opacity-50"
            >
              Buy Credits
            </button>
          </div>
        </div>

        <div className="rounded-[32px] border border-black/10 bg-white p-8 shadow-[0_20px_60px_rgba(0,0,0,0.05)]">
          <div className="text-sm uppercase tracking-[0.18em] text-black/40">
            Usage
          </div>

          <div className="mt-5 text-5xl font-semibold tracking-[-0.05em]">
            {formatCredits(totalCreditsSpent)}
          </div>

          <div className="mt-2 text-sm text-black/45">
            Credits spent in total
          </div>

          <div className="mt-8 space-y-3">
            {modes.map((item) => (
              <div
                key={item.value}
                className="flex items-center justify-between rounded-2xl bg-[#f7f5f0] px-4 py-3"
              >
                <div>
                  <div className="text-sm font-medium">
                    {item.title}
                  </div>

                  <div className="mt-1 text-xs text-black/40">
                    {item.description}
                  </div>
                </div>

                <div className="text-sm font-semibold">
                  {GENERATION_COSTS[item.value]}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-[32px] border border-black/10 bg-white p-6 shadow-[0_20px_60px_rgba(0,0,0,0.05)]">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold tracking-[-0.04em]">
              Recent transactions
            </h2>

            <p className="mt-2 text-sm text-black/45">
              Latest credit charges, purchases and adjustments.
            </p>
          </div>

          <div className="rounded-full bg-[#f7f5f0] px-4 py-2 text-xs text-black/50">
            {transactions.length} records
          </div>
        </div>

        <div className="mt-6 divide-y divide-black/8">
          {transactions.length === 0 ? (
            <div className="py-10 text-center text-sm text-black/45">
              No transactions yet.
            </div>
          ) : (
            transactions.map((transaction) => (
              <TransactionRow
                key={transaction.id}
                transaction={transaction}
              />
            ))
          )}
        </div>
      </div>
    </section>
  );
}

function AccountView({
  email,
  name,
  balance,
  totalGenerations,
  totalCreditsSpent,
}: {
  email: string;
  name: string;
  balance: number;
  totalGenerations: number;
  totalCreditsSpent: number;
}) {
  return (
    <section className="mx-auto max-w-[980px] px-6 py-8">
      <div>
        <div className="text-sm font-semibold uppercase tracking-[0.2em] text-black/40">
          Profile
        </div>

        <h1 className="mt-3 text-4xl font-semibold tracking-[-0.05em] md:text-6xl">
          Account
        </h1>

        <p className="mt-4 max-w-2xl text-sm leading-6 text-black/50">
          Your SSSWEAR AI account information and usage summary.
        </p>
      </div>

      <div className="mt-8 rounded-[32px] border border-black/10 bg-white p-8 shadow-[0_20px_60px_rgba(0,0,0,0.05)]">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-black text-2xl font-semibold text-white">
            {(name || email || "S").slice(0, 1).toUpperCase()}
          </div>

          <div className="min-w-0">
            <h2 className="truncate text-3xl font-semibold tracking-[-0.04em]">
              {name || "SSSWEAR AI user"}
            </h2>

            <p className="mt-2 break-all text-sm text-black/45">
              {email || "Email is not available"}
            </p>
          </div>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <AccountStat
            label="Balance"
            value={`${formatCredits(balance)} Credits`}
          />

          <AccountStat
            label="Generations"
            value={formatCredits(totalGenerations)}
          />

          <AccountStat
            label="Credits spent"
            value={formatCredits(totalCreditsSpent)}
          />
        </div>

        <div className="mt-8 rounded-[24px] bg-[#f7f5f0] p-5">
          <div className="text-sm font-medium">
            Account access and security
          </div>

          <p className="mt-2 text-sm leading-6 text-black/45">
            Email, password and active sessions are managed securely
            through Clerk. Use the profile button in the upper-right
            corner to open account settings.
          </p>
        </div>
      </div>
    </section>
  );
}

function HistoryCard({
  item,
  onClick,
}: {
  item: GenerationHistoryItem;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group overflow-hidden rounded-[28px] border border-black/10 bg-white text-left shadow-[0_20px_60px_rgba(0,0,0,0.05)] transition hover:-translate-y-1 hover:shadow-[0_28px_70px_rgba(0,0,0,0.1)]"
    >
      <div className="relative aspect-[4/5] overflow-hidden bg-black/5">
        <img
          src={item.imageUrl}
          alt={item.userPrompt || "Generated fashion image"}
          loading="lazy"
          className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
        />

        <div className="absolute left-3 top-3 rounded-full bg-black/70 px-3 py-1.5 text-[11px] font-medium text-white backdrop-blur">
          {modeTitles[item.mode]}
        </div>

        <div className="absolute right-3 top-3 rounded-full bg-white/85 px-3 py-1.5 text-[11px] font-medium text-black backdrop-blur">
          {item.aspectRatio}
        </div>
      </div>

      <div className="p-5">
        <div className="line-clamp-2 min-h-10 text-sm font-medium leading-5">
          {item.userPrompt || "No additional instructions"}
        </div>

        <div className="mt-4 flex items-center justify-between text-xs text-black/40">
          <span>{formatDate(item.createdAt)}</span>
          <span>{item.creditsSpent} Credits</span>
        </div>
      </div>
    </button>
  );
}

function HistoryModal({
  item,
  downloading,
  onClose,
  onDownload,
  onUseSettings,
}: {
  item: GenerationHistoryItem;
  downloading: boolean;
  onClose: () => void;
  onDownload: () => void;
  onUseSettings: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="grid max-h-[94vh] w-full max-w-[1180px] overflow-hidden rounded-[32px] bg-[#111111] shadow-[0_40px_120px_rgba(0,0,0,0.45)] lg:grid-cols-[1fr_390px]">
        <div className="flex min-h-[420px] items-center justify-center overflow-auto bg-[#171717] p-4 md:p-8">
          <img
            src={item.imageUrl}
            alt={item.userPrompt || "Generated fashion image"}
            className="max-h-[82vh] max-w-full rounded-[20px] object-contain"
          />
        </div>

        <div className="overflow-y-auto border-t border-white/10 p-6 text-white lg:border-l lg:border-t-0">
          <div className="flex items-center justify-between gap-4">
            <div className="text-sm font-semibold uppercase tracking-[0.18em] text-white/45">
              Generation
            </div>

            <button
              type="button"
              onClick={onClose}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 text-lg text-white/70 transition hover:bg-white/10"
              aria-label="Close"
            >
              ×
            </button>
          </div>

          <h2 className="mt-6 text-3xl font-semibold tracking-[-0.04em]">
            {modeTitles[item.mode]}
          </h2>

          <div className="mt-4 flex flex-wrap gap-2">
            <div className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-white/55">
              {item.aspectRatio}
            </div>

            <div className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-white/55">
              {item.creditsSpent} Credits
            </div>
          </div>

          <div className="mt-8">
            <div className="text-xs uppercase tracking-[0.16em] text-white/35">
              Prompt
            </div>

            <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-white/70">
              {item.userPrompt || "No additional instructions"}
            </p>
          </div>

          <div className="mt-8">
            <div className="text-xs uppercase tracking-[0.16em] text-white/35">
              Created
            </div>

            <p className="mt-3 text-sm text-white/70">
              {formatDate(item.createdAt)}
            </p>
          </div>

          <div className="mt-8 grid gap-3">
            <button
              type="button"
              onClick={onDownload}
              disabled={downloading}
              className="w-full rounded-2xl bg-white px-5 py-4 text-sm font-semibold text-black transition hover:bg-white/85 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {downloading ? "Downloading..." : "Download PNG"}
            </button>

            <button
              type="button"
              onClick={onUseSettings}
              className="w-full rounded-2xl border border-white/15 px-5 py-4 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              Use these settings
            </button>
          </div>

          <p className="mt-4 text-xs leading-5 text-white/30">
            “Use these settings” copies the mode, format and prompt to
            Studio. Product photos must be uploaded again.
          </p>
        </div>
      </div>
    </div>
  );
}

function TransactionRow({
  transaction,
}: {
  transaction: CreditTransaction;
}) {
  const positive = transaction.creditsDelta > 0;

  return (
    <div className="flex items-center justify-between gap-4 py-4">
      <div className="min-w-0">
        <div className="truncate text-sm font-medium">
          {getTransactionTitle(transaction)}
        </div>

        <div className="mt-1 text-xs text-black/40">
          {formatDate(transaction.createdAt)}
        </div>
      </div>

      <div className="shrink-0 text-right">
        <div
          className={[
            "text-sm font-semibold",
            positive ? "text-emerald-700" : "text-black",
          ].join(" ")}
        >
          {positive ? "+" : ""}
          {transaction.creditsDelta} Credits
        </div>

        <div className="mt-1 text-xs text-black/40">
          Balance: {formatCredits(transaction.balanceAfter)}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[24px] border border-black/10 bg-white p-5 shadow-[0_16px_45px_rgba(0,0,0,0.04)]">
      <div className="text-xs uppercase tracking-[0.16em] text-black/40">
        {label}
      </div>

      <div className="mt-3 text-3xl font-semibold tracking-[-0.04em]">
        {value}
      </div>
    </div>
  );
}

function AccountStat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[20px] border border-black/10 p-5">
      <div className="text-xs uppercase tracking-[0.14em] text-black/40">
        {label}
      </div>

      <div className="mt-3 text-xl font-semibold tracking-[-0.03em]">
        {value}
      </div>
    </div>
  );
}

function HistorySkeleton() {
  return (
    <div className="overflow-hidden rounded-[28px] border border-black/10 bg-white">
      <div className="aspect-[4/5] animate-pulse bg-black/8" />

      <div className="p-5">
        <div className="h-4 w-4/5 animate-pulse rounded bg-black/8" />
        <div className="mt-3 h-4 w-2/3 animate-pulse rounded bg-black/8" />

        <div className="mt-5 flex justify-between">
          <div className="h-3 w-24 animate-pulse rounded bg-black/8" />
          <div className="h-3 w-16 animate-pulse rounded bg-black/8" />
        </div>
      </div>
    </div>
  );
}

function NavigationButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "transition hover:text-black",
        active ? "font-medium text-black" : "text-black/55",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function MobileNavigationButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "shrink-0 rounded-full px-4 py-2 text-sm transition",
        active
          ? "bg-black text-white"
          : "border border-black/10 bg-white text-black/55",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function SectionTitle({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <div>
      <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-black/80">
        {title}
      </h2>

      <p className="mt-1 text-sm text-black/45">{subtitle}</p>
    </div>
  );
}

function UploadCard({
  title,
  description,
  file,
  onChange,
  required,
}: {
  title: string;
  description: string;
  file: File | null;
  onChange: (file: File | null) => void;
  required?: boolean;
}) {
  return (
    <label className="block cursor-pointer rounded-2xl border border-dashed border-black/15 bg-[#fbfaf7] p-4 transition hover:border-black/35">
      <input
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) =>
          onChange(event.target.files?.[0] || null)
        }
      />

      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div className="text-sm font-semibold">{title}</div>

            {required && (
              <div className="rounded-full bg-black px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-white">
                Required
              </div>
            )}
          </div>

          <div className="mt-1 text-xs text-black/45">
            {description}
          </div>

          {file && (
            <div className="mt-3 break-all text-xs text-black/65">
              ✅ {file.name} — {formatFileSize(file)}
            </div>
          )}
        </div>

        <div className="shrink-0 rounded-full border border-black/10 bg-white px-4 py-2 text-xs font-medium">
          {file ? "Replace" : "Upload"}
        </div>
      </div>
    </label>
  );
}

function DetailsUpload({
  files,
  onChange,
}: {
  files: File[];
  onChange: (files: File[]) => void;
}) {
  return (
    <label className="block cursor-pointer rounded-2xl border border-dashed border-black/15 bg-[#fbfaf7] p-4 transition hover:border-black/35">
      <input
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(event) =>
          onChange(Array.from(event.target.files || []))
        }
      />

      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="text-sm font-semibold">DETAILS</div>

          <div className="mt-1 text-xs text-black/45">
            Add labels, tags, embroidery or close-up details
          </div>

          {files.length > 0 && (
            <div className="mt-3 space-y-1 text-xs text-black/65">
              {files.map((file, index) => (
                <div
                  key={`${file.name}-${file.lastModified}-${index}`}
                  className="break-all"
                >
                  ✅ {file.name} — {formatFileSize(file)}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="shrink-0 rounded-full border border-black/10 bg-white px-4 py-2 text-xs font-medium">
          {files.length > 0 ? "Replace files" : "Add files"}
        </div>
      </div>
    </label>
  );
}