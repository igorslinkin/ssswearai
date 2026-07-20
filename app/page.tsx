"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { SignInButton, SignUpButton, UserButton, useUser } from "@clerk/nextjs";
import { GENERATION_COSTS, type GenerationMode } from "../lib/config";

type Ratio = "4:5" | "3:4" | "9:16" | "1:1" | "2:3";
type AppView = "studio" | "history" | "credits" | "account";

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

type Locale = "ru" | "en";

type LocalizedText = {
  ru: string;
  en: string;
};

type LocalizedModeOption = {
  value: GenerationMode;
  title: LocalizedText;
  description: LocalizedText;
};

const LocaleContext = createContext<Locale>("ru");

function useLocale(): Locale {
  return useContext(LocaleContext);
}

function ui(locale: Locale, ru: string, en: string): string {
  return locale === "ru" ? ru : en;
}

function useBodyScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    const previousPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

    document.body.style.overflow = "hidden";
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }

    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.paddingRight = previousPaddingRight;
    };
  }, [active]);
}

const modes: LocalizedModeOption[] = [
  {
    value: "cyclorama",
    title: { ru: "Циклорама", en: "Cyclorama" },
    description: { ru: "Чистый студийный фон", en: "Clean studio background" },
  },
  {
    value: "product",
    title: { ru: "Карточка товара", en: "Product" },
    description: {
      ru: "Кадр для сайта и маркетплейса",
      en: "Marketplace-ready frame",
    },
  },
  {
    value: "creative",
    title: { ru: "Креатив", en: "Creative" },
    description: {
      ru: "Яркая визуальная концепция",
      en: "Bold visual concept",
    },
  },
  {
    value: "image",
    title: { ru: "Имиджевая съёмка", en: "Campaign" },
    description: {
      ru: "Атмосферная съёмка бренда",
      en: "Editorial brand mood",
    },
  },
  {
    value: "mobile",
    title: { ru: "Мобильная съёмка", en: "Mobile" },
    description: {
      ru: "Реалистичный кадр на телефон",
      en: "Realistic UGC photo",
    },
  },
  {
    value: "tryon",
    title: { ru: "Виртуальная примерка", en: "Try-on" },
    description: { ru: "Изделие на человеке", en: "Model wearing garment" },
  },
];

const ratios: Ratio[] = ["4:5", "3:4", "9:16", "1:1", "2:3"];

const modeTitles: Record<GenerationMode, LocalizedText> = {
  cyclorama: { ru: "Циклорама", en: "Cyclorama" },
  product: { ru: "Карточка товара", en: "Product" },
  creative: { ru: "Креативная съёмка", en: "Creative" },
  image: { ru: "Имиджевая съёмка", en: "Campaign" },
  mobile: { ru: "Мобильная съёмка", en: "Mobile" },
  tryon: { ru: "Виртуальная примерка", en: "Try-on" },
};

const generationStatuses: LocalizedText[] = [
  { ru: "Загружаем фотографии изделия…", en: "Uploading garment photos…" },
  {
    ru: "Изучаем форму и конструкцию…",
    en: "Analyzing shape and construction…",
  },
  {
    ru: "Рассматриваем детали и фактуру…",
    en: "Studying details and texture…",
  },
  {
    ru: "Продумываем образ и композицию…",
    en: "Building the look and composition…",
  },
  { ru: "Подбираем подходящую сцену…", en: "Finding the right scene…" },
  {
    ru: "Настраиваем свет и перспективу…",
    en: "Adjusting light and perspective…",
  },
  {
    ru: "Фотограф уже работает над кадром…",
    en: "The photographer is working on the shot…",
  },
  { ru: "Дорабатываем мелкие детали…", en: "Refining the small details…" },
  { ru: "Выбираем лучший результат…", en: "Selecting the best result…" },
  {
    ru: "Финальная обработка — почти готово…",
    en: "Final retouching — almost ready…",
  },
];

const generationTips: LocalizedText[] = [
  {
    ru: "Чем лучше видно изделие, тем точнее получится результат.",
    en: "The clearer the garment is visible, the more accurate the result.",
  },
  {
    ru: "Фотографии деталей помогают сохранить вышивку, принты и фактуру.",
    en: "Detail photos help preserve embroidery, prints, and texture.",
  },
  {
    ru: "Старайтесь фотографировать вещь при ровном естественном свете.",
    en: "Photograph the garment in soft, even natural light.",
  },
  {
    ru: "Не обрезайте края изделия на исходной фотографии.",
    en: "Keep the full garment inside the source frame.",
  },
  {
    ru: "В пожеланиях можно указать модель, локацию, свет и настроение.",
    en: "Use the prompt to specify the model, location, lighting, and mood.",
  },
];

async function compressImage(
  file: File,
  maxSize = 1400,
  quality = 0.82,
): Promise<File> {
  const imageBitmap = await createImageBitmap(file);

  const scale = Math.min(
    1,
    maxSize / Math.max(imageBitmap.width, imageBitmap.height),
  );

  const width = Math.round(imageBitmap.width * scale);
  const height = Math.round(imageBitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");

  if (!context) {
    imageBitmap.close();
    throw new Error("Ваш браузер не поддерживает обработку изображения.");
  }

  context.drawImage(imageBitmap, 0, 0, width, height);
  imageBitmap.close();

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => {
        if (result) {
          resolve(result);
        } else {
          reject(new Error("Не удалось подготовить изображение."));
        }
      },
      "image/jpeg",
      quality,
    );
  });

  return new File(
    [blob],
    `${file.name.replace(/\.[^.]+$/, "")}-compressed.jpg`,
    {
      type: "image/jpeg",
      lastModified: Date.now(),
    },
  );
}

function formatFileSize(file: File): string {
  return `${(file.size / 1024 / 1024).toFixed(2)} MB`;
}

function createDownloadFileName(
  prefix = "ssswear-ai",
  extension = "png",
): string {
  const now = new Date();

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");

  return `${prefix}-${year}-${month}-${day}-${hours}-${minutes}.${extension}`;
}

function formatDate(value: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatCredits(value: number, locale: Locale): string {
  return new Intl.NumberFormat(locale === "ru" ? "ru-RU" : "en-US").format(
    value,
  );
}

function getTransactionTitle(
  transaction: CreditTransaction,
  locale: Locale,
): string {
  if (transaction.description?.trim()) {
    return transaction.description;
  }

  if (transaction.type === "generation") {
    return ui(locale, "Генерация изображения", "Image generation");
  }

  if (transaction.type === "purchase") {
    return ui(locale, "Покупка кредитов", "Credit purchase");
  }

  if (transaction.type === "refund") {
    return ui(locale, "Возврат кредитов", "Credit refund");
  }

  return ui(locale, "Операция с кредитами", "Credit transaction");
}

export default function Page() {
  const { isSignedIn, isLoaded, user } = useUser();
  const [locale, setLocale] = useState<Locale>("ru");

  useEffect(() => {
    const savedLocale = window.localStorage.getItem("ssswear-ai-locale");
    const initialLocale = savedLocale === "ru" || savedLocale === "en"
      ? savedLocale
      : "ru";
    const timeout = window.setTimeout(() => setLocale(initialLocale), 0);

    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const changeLocale = (nextLocale: Locale) => {
    setLocale(nextLocale);
    window.localStorage.setItem("ssswear-ai-locale", nextLocale);
  };

  const [activeView, setActiveView] = useState<AppView>("studio");
  const [welcomeOpen, setWelcomeOpen] = useState(false);

  const welcomeStorageKey = useMemo(
    () => `ssswear-ai-welcome-v1:${user?.id ?? "guest"}`,
    [user?.id],
  );

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      if (!isLoaded || !isSignedIn || !user?.id) {
        setWelcomeOpen(false);
        return;
      }

      setWelcomeOpen(
        window.localStorage.getItem(welcomeStorageKey) !== "seen",
      );
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [isLoaded, isSignedIn, user?.id, welcomeStorageKey]);

  const closeWelcome = () => {
    window.localStorage.setItem(welcomeStorageKey, "seen");
    setWelcomeOpen(false);
  };

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

  const hasEnoughCredits = credits !== null && credits >= generationCost;

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
          data.error ||
            ui(
              locale,
              "Не удалось загрузить профиль.",
              "Failed to load user profile.",
            ),
        );
      }

      setCredits(data.profile.credits);
    } catch (profileError) {
      console.error("PROFILE LOAD ERROR:", profileError);
      setCredits(null);
    } finally {
      setCreditsLoading(false);
    }
  }, [isSignedIn, locale]);

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
          },
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
            data.error ||
              ui(
                locale,
                "Не удалось загрузить историю генераций.",
                "Failed to load generation history.",
              ),
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
          const existingIds = new Set(currentItems.map((item) => item.id));

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
            : ui(
                locale,
                "Не удалось загрузить историю генераций.",
                "Failed to load generation history.",
              ),
        );
      } finally {
        setHistoryLoading(false);
        setHistoryLoadingMore(false);
      }
    },
    [isSignedIn, locale],
  );

  useEffect(() => {
    const timeout = window.setTimeout(() => void loadProfile(), 0);
    return () => window.clearTimeout(timeout);
  }, [loadProfile]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void loadHistory(), 0);
    return () => window.clearTimeout(timeout);
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

  const downloadImageFromUrl = async (imageUrl: string, fileName: string) => {
    const response = await fetch(imageUrl, {
      method: "GET",
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(
        ui(
          locale,
          "Ссылка на скачивание устарела. Обновите историю и попробуйте ещё раз.",
          "The download link has expired. Refresh history and try again.",
        ),
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

      await downloadImageFromUrl(image, createDownloadFileName());
    } catch (downloadError) {
      console.error("IMAGE DOWNLOAD ERROR:", downloadError);

      setError(
        downloadError instanceof Error
          ? downloadError.message
          : ui(
              locale,
              "Не удалось скачать изображение.",
              "Image download failed.",
            ),
      );
    } finally {
      setDownloading(false);
    }
  };

  const handleHistoryDownload = async (item: GenerationHistoryItem) => {
    if (downloading) {
      return;
    }

    try {
      setDownloading(true);
      setHistoryError("");

      await downloadImageFromUrl(
        item.imageUrl,
        createDownloadFileName(`ssswear-ai-${item.mode}`),
      );
    } catch (downloadError) {
      console.error("HISTORY IMAGE DOWNLOAD ERROR:", downloadError);

      setHistoryError(
        downloadError instanceof Error
          ? downloadError.message
          : ui(
              locale,
              "Не удалось скачать изображение.",
              "Image download failed.",
            ),
      );
    } finally {
      setDownloading(false);
    }
  };

  const handleUseHistorySettings = (item: GenerationHistoryItem) => {
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
      setError(
        ui(
          locale,
          "Войдите в аккаунт, чтобы начать генерацию.",
          "Sign in to generate images.",
        ),
      );
      return;
    }

    if (credits === null) {
      setError(
        ui(
          locale,
          "Баланс ещё загружается. Попробуйте ещё раз.",
          "Your balance is still loading. Please try again.",
        ),
      );
      return;
    }

    if (credits < generationCost) {
      setError(
        ui(
          locale,
          `Недостаточно кредитов. Для этой генерации требуется ${generationCost}.`,
          `Not enough credits. This generation requires ${generationCost}.`,
        ),
      );
      return;
    }

    if (!frontFile) {
      setError(
        ui(
          locale,
          "Сначала загрузите фотографию изделия спереди.",
          "Upload the front photo first.",
        ),
      );
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
            ui(
              locale,
              `Недостаточно кредитов. Требуется: ${data.requiredCredits ?? generationCost}.`,
              `Not enough credits. Required: ${data.requiredCredits ?? generationCost}.`,
            ),
          );
          return;
        }

        setError(
          data.error ||
            ui(locale, "Не удалось выполнить генерацию.", "Generation failed."),
        );
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
          : ui(
              locale,
              "Не удалось связаться с сервисом генерации.",
              "Could not reach the generation service.",
            ),
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
      <main className="flex min-h-screen items-center justify-center bg-[#090909] text-white">
        <div className="text-center">
          <div className="flex justify-center">
            <BrandMark size="large" />
          </div>
          <p className="mt-6 text-xs uppercase tracking-[0.24em] text-white/35">
            {ui(locale, "Загружаем студию", "Loading studio")}
          </p>
        </div>
      </main>
    );
  }

  return (
    <LocaleContext.Provider value={locale}>
      <main className="min-h-screen overflow-x-hidden bg-[#f4f3ef] text-[#111111]">
        <header className="sticky top-0 z-40 border-b border-black/8 bg-[#f4f3ef]/92 backdrop-blur-xl">
          <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-2 px-3 py-3 sm:gap-4 sm:px-6 sm:py-4 lg:px-8">
            <button
              type="button"
              onClick={() => {
                setActiveView("studio");
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              className="flex min-w-0 items-center gap-2 text-left sm:gap-3"
              aria-label="SSSWEAR AI"
            >
              <BrandMark size="small" />
              <div className="min-w-0">
                <div className="truncate text-sm font-bold tracking-[0.16em]">
                  SSSWEAR AI
                </div>
                <div className="mt-0.5 hidden truncate text-[10px] uppercase tracking-[0.18em] text-black/38 sm:block">
                  {ui(locale, "AI-фотография одежды", "AI fashion photography")}
                </div>
              </div>
            </button>

            {isSignedIn ? (
              <nav className="hidden items-center gap-7 text-sm text-black/50 lg:flex">
                <NavigationButton
                  active={activeView === "studio"}
                  onClick={() => setActiveView("studio")}
                >
                  {ui(locale, "Создать", "Create")}
                </NavigationButton>
                <NavigationButton
                  active={activeView === "history"}
                  onClick={() => setActiveView("history")}
                >
                  {ui(locale, "История", "History")}
                </NavigationButton>
                <NavigationButton
                  active={activeView === "credits"}
                  onClick={() => setActiveView("credits")}
                >
                  {ui(locale, "Баланс", "Credits")}
                </NavigationButton>
                <NavigationButton
                  active={activeView === "account"}
                  onClick={() => setActiveView("account")}
                >
                  {ui(locale, "Профиль", "Account")}
                </NavigationButton>
              </nav>
            ) : (
              <nav className="hidden items-center gap-7 text-sm text-black/50 lg:flex">
                <a className="transition hover:text-black" href="#audience">
                  {ui(locale, "Для кого", "For whom")}
                </a>
                <a className="transition hover:text-black" href="#how-it-works">
                  {ui(locale, "Как работает", "How it works")}
                </a>
                <a className="transition hover:text-black" href="#pricing">
                  {ui(locale, "Тарифы", "Pricing")}
                </a>
              </nav>
            )}

            <div className="flex shrink-0 items-center gap-2 sm:gap-3">
              <LocaleSwitcher locale={locale} onChange={changeLocale} />

              {isSignedIn ? (
                <>
                  <button
                    type="button"
                    onClick={() => setWelcomeOpen(true)}
                    className="hidden h-10 w-10 items-center justify-center rounded-full border border-black/10 bg-white text-sm font-semibold transition hover:border-black/25 sm:flex"
                    aria-label={ui(locale, "Как пользоваться", "How to use")}
                    title={ui(locale, "Как пользоваться", "How to use")}
                  >
                    ?
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveView("credits")}
                    className="hidden rounded-full border border-black/10 bg-white px-4 py-2.5 text-sm font-medium transition hover:border-black/25 sm:block"
                  >
                    {creditsLoading
                      ? ui(locale, "Загрузка", "Loading")
                      : `${formatCredits(credits ?? 0, locale)} ${ui(locale, "кредитов", "credits")}`}
                  </button>
                  <UserButton />
                </>
              ) : (
                <div className="hidden items-center gap-2 sm:flex">
                  <SignInButton mode="modal">
                    <button
                      type="button"
                      className="rounded-full border border-black/10 bg-white px-4 py-2.5 text-sm font-semibold text-black transition hover:border-black/25"
                    >
                      {ui(locale, "Войти", "Sign in")}
                    </button>
                  </SignInButton>
                  <SignUpButton mode="modal">
                    <button
                      type="button"
                      className="rounded-full bg-black px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-black/80"
                    >
                      {ui(locale, "Зарегистрироваться", "Sign up")}
                    </button>
                  </SignUpButton>
                </div>
              )}
            </div>
          </div>

          {!isSignedIn && (
            <div className="border-t border-black/5 px-3 py-3 sm:hidden">
              <div className="mx-auto grid max-w-[1500px] grid-cols-2 gap-2">
                <SignInButton mode="modal">
                  <button
                    type="button"
                    className="w-full rounded-full border border-black/10 bg-white px-4 py-3 text-sm font-semibold text-black"
                  >
                    {ui(locale, "Войти", "Sign in")}
                  </button>
                </SignInButton>
                <SignUpButton mode="modal">
                  <button
                    type="button"
                    className="w-full rounded-full bg-black px-4 py-3 text-sm font-semibold text-white"
                  >
                    {ui(locale, "Регистрация", "Sign up")}
                  </button>
                </SignUpButton>
              </div>
            </div>
          )}

          {isSignedIn && (
            <div className="border-t border-black/5 px-3 py-2.5 lg:hidden sm:px-4">
              <div className="mobile-nav-scroll mx-auto flex max-w-[1500px] gap-2 overflow-x-auto overscroll-x-contain pb-0.5">
                <MobileNavigationButton
                  active={activeView === "studio"}
                  onClick={() => setActiveView("studio")}
                >
                  {ui(locale, "Создать", "Create")}
                </MobileNavigationButton>
                <MobileNavigationButton
                  active={activeView === "history"}
                  onClick={() => setActiveView("history")}
                >
                  {ui(locale, "История", "History")}
                </MobileNavigationButton>
                <MobileNavigationButton
                  active={activeView === "credits"}
                  onClick={() => setActiveView("credits")}
                >
                  {ui(locale, "Баланс", "Credits")}
                </MobileNavigationButton>
                <MobileNavigationButton
                  active={activeView === "account"}
                  onClick={() => setActiveView("account")}
                >
                  {ui(locale, "Профиль", "Account")}
                </MobileNavigationButton>
                <button
                  type="button"
                  onClick={() => setWelcomeOpen(true)}
                  className="shrink-0 rounded-full border border-black/10 bg-white px-4 py-2 text-xs font-medium text-black/60"
                >
                  {ui(locale, "Помощь", "Help")}
                </button>
              </div>
            </div>
          )}
        </header>

        {!isSignedIn ? (
          <MarketingLanding locale={locale} />
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
                  void loadHistory({ page: 1, append: false })
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
                  void loadHistory({ page: 1, append: false })
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

        <AppFooter locale={locale} signedIn={Boolean(isSignedIn)} />

        {welcomeOpen && isSignedIn && (
          <WelcomeScreen locale={locale} onClose={closeWelcome} />
        )}

        {selectedHistoryItem && (
          <HistoryModal
            item={selectedHistoryItem}
            downloading={downloading}
            onClose={() => setSelectedHistoryItem(null)}
            onDownload={() => void handleHistoryDownload(selectedHistoryItem)}
            onUseSettings={() => handleUseHistorySettings(selectedHistoryItem)}
          />
        )}
      </main>
    </LocaleContext.Provider>
  );
}

function BrandMark({ size = "small" }: { size?: "small" | "large" }) {
  return (
    <div
      className={[
        "relative shrink-0 overflow-hidden rounded-[28%] bg-black",
        size === "large" ? "h-24 w-24 brand-breathe" : "h-10 w-10",
      ].join(" ")}
    >
      <img
        src="/brand-mark.jpg"
        alt=""
        className="h-full w-full object-cover"
        aria-hidden="true"
      />
    </div>
  );
}

function LocaleSwitcher({
  locale,
  onChange,
}: {
  locale: Locale;
  onChange: (locale: Locale) => void;
}) {
  return (
    <div className="flex rounded-full border border-black/10 bg-white p-1 text-[10px] font-bold">
      {(["ru", "en"] as Locale[]).map((item) => (
        <button
          key={item}
          type="button"
          onClick={() => onChange(item)}
          className={[
            "rounded-full px-2.5 py-1.5 transition sm:px-3",
            locale === item
              ? "bg-black text-white"
              : "text-black/40 hover:text-black",
          ].join(" ")}
          aria-pressed={locale === item}
        >
          {item === "ru" ? "РУ" : "EN"}
        </button>
      ))}
    </div>
  );
}

function MarketingLanding({ locale }: { locale: Locale }) {
  const promptIdeas = [
    {
      ru: "Девушка идёт по вечерней Москве, дождь, неон",
      en: "A woman walking through evening Moscow, rain and neon",
    },
    {
      ru: "Кофейня в Санкт-Петербурге, мягкий утренний свет",
      en: "A Saint Petersburg coffee shop in soft morning light",
    },
    {
      ru: "Мужчина на фоне стены во дворе, мобильная съёмка",
      en: "A man by a courtyard wall, casual mobile photo",
    },
    {
      ru: "Карточка товара на белой циклораме",
      en: "Product card on a clean white cyclorama",
    },
  ];

  const plans = [
    { name: "START", price: "790 ₽", credits: "400", photos: "≈ 10" },
    { name: "PRO", price: "1 990 ₽", credits: "1 100", photos: "≈ 20" },
    { name: "STUDIO", price: "3 990 ₽", credits: "2 500", photos: "≈ 50" },
    { name: "BUSINESS", price: "7 990 ₽", credits: "5 000", photos: "≈ 100" },
  ];

  return (
    <div className="overflow-hidden">
      <section className="relative border-b border-black/8">
        <div className="landing-grid pointer-events-none absolute inset-0 opacity-50" />
        <div className="relative mx-auto grid w-full min-w-0 max-w-[1500px] items-center gap-10 px-4 py-12 sm:min-h-[700px] sm:px-8 sm:py-16 lg:grid-cols-[minmax(0,1.04fr)_minmax(0,0.96fr)] lg:gap-12 lg:px-12 lg:py-20">
          <div className="min-w-0 max-w-[860px]">
            <div className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-black/50">
              <span className="h-1.5 w-1.5 rounded-full bg-black" />
              {ui(locale, "AI-фотостудия для одежды", "AI photo studio for fashion")}
            </div>
            <h1 className="mt-6 max-w-[860px] text-[clamp(1.75rem,7.5vw,3rem)] font-semibold leading-[0.96] tracking-[-0.05em] [overflow-wrap:anywhere] sm:mt-7 sm:text-[3.25rem] sm:leading-[0.94] lg:text-[3.4rem] xl:text-[3.875rem]">
              {locale === "ru" ? (
                <>
                  <span className="block">Профессиональные</span>
                  <span className="block">фотографии одежды</span>
                  <span className="block">без фотостудии</span>
                </>
              ) : (
                <>
                  <span className="block">Professional fashion</span>
                  <span className="block">photography without</span>
                  <span className="block">a photo studio</span>
                </>
              )}
            </h1>
            <p className="mt-6 min-w-0 max-w-2xl text-[15px] leading-6 text-black/55 [overflow-wrap:anywhere] sm:mt-8 sm:text-lg sm:leading-8 lg:text-xl">
              {ui(
                locale,
                "От каталожных снимков до имиджевых кампаний — за минуты, без моделей, фотографов и студии.",
                "From product cards to campaign imagery — in minutes, without models, photographers, or a studio.",
              )}
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <SignUpButton mode="modal">
                <button
                  type="button"
                  className="w-full rounded-full bg-black px-7 py-4 text-sm font-semibold text-white transition hover:scale-[1.01] hover:bg-black/82 sm:w-auto"
                >
                  {ui(locale, "Попробовать бесплатно", "Try for free")}
                </button>
              </SignUpButton>
              <a
                href="#how-it-works"
                className="rounded-full border border-black/12 bg-white px-7 py-4 text-center text-sm font-semibold transition hover:border-black/30"
              >
                {ui(locale, "Посмотреть, как работает", "See how it works")}
              </a>
            </div>
            <p className="mt-4 text-xs text-black/38">
              {ui(
                locale,
                "🎁 3 бесплатные генерации после регистрации",
                "🎁 3 free generations after registration",
              )}
            </p>
          </div>

          <div className="relative mx-auto w-full min-w-0 max-w-[660px] lg:ml-auto">
            <div className="absolute -inset-8 rounded-full bg-white/70 blur-3xl" />
            <div className="relative overflow-hidden rounded-[34px] border border-black/10 bg-white p-3 shadow-[0_45px_120px_rgba(0,0,0,0.16)] sm:p-5">
              <div className="flex min-w-0 items-center justify-between gap-3 border-b border-black/8 px-2 pb-4">
                <div className="min-w-0">
                  <div className="text-xs font-bold uppercase tracking-[0.16em]">SSSWEAR AI</div>
                  <div className="mt-1 text-[10px] text-black/38">
                    {ui(locale, "Новая генерация", "New generation")}
                  </div>
                </div>
                <div className="shrink-0 rounded-full bg-black px-3 py-1.5 text-[10px] font-semibold text-white">
                  130 <span className="hidden sm:inline">Credits</span>
                </div>
              </div>
              <div className="grid gap-3 pt-4 sm:grid-cols-[0.82fr_1.18fr]">
                <div className="space-y-3">
                  <div className="rounded-2xl border border-black/8 bg-[#f7f6f2] p-4">
                    <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-black/45">
                      1. {ui(locale, "Загрузите изделие", "Upload garment")}
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      {["FRONT", "BACK"].map((label) => (
                        <div key={label} className="flex aspect-square items-center justify-center rounded-xl border border-dashed border-black/15 bg-white">
                          <div className="text-center">
                            <div className="text-2xl">＋</div>
                            <div className="mt-1 text-[9px] font-semibold text-black/38">{label}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-black/8 p-4">
                    <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-black/45">
                      2. {ui(locale, "Тип съёмки", "Photo type")}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {["Product", "Campaign", "Mobile"].map((label, index) => (
                        <span key={label} className={index === 1 ? "rounded-full bg-black px-2.5 py-1.5 text-[9px] text-white" : "rounded-full bg-[#f2f1ed] px-2.5 py-1.5 text-[9px] text-black/55"}>
                          {label}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-xl bg-black px-4 py-3 text-center text-[11px] font-semibold text-white">
                    ✦ {ui(locale, "Создать изображение", "Create image")}
                  </div>
                </div>
                <div className="flex min-h-[320px] flex-col overflow-hidden rounded-2xl bg-[#101010] p-4 text-white sm:min-h-[420px]">
                  <div className="flex items-center justify-between text-[10px] text-white/45">
                    <span>{ui(locale, "Результат", "Result")}</span>
                    <span>4:5</span>
                  </div>
                  <div className="relative mt-4 flex flex-1 items-center justify-center overflow-hidden rounded-xl bg-[radial-gradient(circle_at_50%_35%,#3d3d3d_0,#171717_42%,#0d0d0d_80%)]">
                    <div className="absolute h-[62%] w-[54%] rounded-[38%_38%_18%_18%] border border-white/18 bg-[#080808] shadow-[0_25px_60px_rgba(0,0,0,0.65)]">
                      <div className="absolute left-1/2 top-[8%] h-[20%] w-[42%] -translate-x-1/2 rounded-t-full border border-white/12" />
                      <div className="absolute left-1/2 top-[38%] -translate-x-1/2 text-[8px] font-semibold tracking-[0.18em] text-white/65">
                        SSSWEAR
                      </div>
                    </div>
                    <div className="absolute bottom-[14%] h-5 w-[58%] rounded-full bg-black/70 blur-md" />
                  </div>
                  <div className="mt-4 flex justify-end">
                    <span className="rounded-full bg-white px-3 py-2 text-[10px] font-semibold text-black">
                      ↓ PNG
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="audience" className="mx-auto max-w-[1500px] px-4 py-16 sm:px-8 sm:py-24 lg:px-12">
        <LandingHeading
          eyebrow={ui(locale, "Кому подойдёт", "Built for")}
          title={ui(locale, "Один инструмент — разные задачи бренда", "One tool for every fashion content task")}
        />
        <div className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["01", ui(locale, "Интернет-магазины", "Online stores"), ui(locale, "Карточки товара и каталожные изображения без регулярных пересъёмок.", "Product cards and catalog imagery without recurring shoots.")],
            ["02", ui(locale, "Бренды одежды", "Fashion brands"), ui(locale, "Имиджевые кампании, лукбуки и тестирование визуальных концепций.", "Campaigns, lookbooks, and fast visual concept testing.")],
            ["03", ui(locale, "Социальные сети", "Social media"), ui(locale, "Живой lifestyle-контент для Reels, постов и рекламных креативов.", "Natural lifestyle content for reels, posts, and ads.")],
            ["04", ui(locale, "Производители мерча", "Merch producers"), ui(locale, "Презентация изделий клиенту ещё до полноценной фотосессии.", "Present finished-looking products before a full photo shoot.")],
          ].map(([number, title, description]) => (
            <div key={number} className="group min-h-[270px] rounded-[28px] border border-black/9 bg-white p-6 transition hover:-translate-y-1 hover:shadow-[0_25px_70px_rgba(0,0,0,0.08)]">
              <div className="text-xs font-bold tracking-[0.18em] text-black/25">{number}</div>
              <h3 className="mt-16 text-2xl font-semibold tracking-[-0.04em]">{title}</h3>
              <p className="mt-4 text-sm leading-6 text-black/48">{description}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="how-it-works" className="border-y border-white/10 bg-[#0b0b0b] text-white">
        <div className="mx-auto w-full max-w-[1500px] px-4 py-16 sm:px-8 sm:py-24 lg:px-12">
          <LandingHeading
            eyebrow={ui(locale, "Как это работает", "How it works")}
            title={ui(locale, "От фотографии вещи до готового кадра", "From a garment photo to a finished image")}
            dark
          />
          <div className="mt-10 grid min-w-0 gap-3 sm:mt-14 lg:grid-cols-3">
            {[
              {
                number: "01",
                title: ui(locale, "Загрузите изделие", "Upload the garment"),
                description: ui(locale, "Добавьте вид спереди, сзади и фотографии важных деталей.", "Add front, back, and close-up detail photos."),
                image: "/onboarding-upload.jpg",
                alt: ui(locale, "Пример загруженного изделия", "Uploaded garment example"),
              },
              {
                number: "02",
                title: ui(locale, "Опишите съёмку", "Describe the shoot"),
                description: ui(locale, "Выберите формат и укажите локацию, модель, свет или настроение.", "Choose the format and specify the model, location, light, or mood."),
                image: "/onboarding-prompt.jpg",
                alt: ui(locale, "Пример описания съёмки", "Shoot description example"),
              },
              {
                number: "03",
                title: ui(locale, "Получите результат", "Get the result"),
                description: ui(locale, "Скачайте готовое изображение и используйте его в коммуникации бренда.", "Download the image and use it across your brand communication."),
                image: "/onboarding-result.jpg",
                alt: ui(locale, "Пример готового изображения", "Generated result example"),
              },
            ].map((step) => (
              <article
                key={step.number}
                className="min-w-0 overflow-hidden rounded-[24px] border border-white/10 bg-[#121212] p-3 sm:rounded-[30px] sm:p-4"
              >
                <div className="overflow-hidden rounded-[18px] border border-white/10 bg-white/5">
                  <img
                    src={step.image}
                    alt={step.alt}
                    className="aspect-[16/10] h-auto w-full object-cover"
                  />
                </div>
                <div className="p-3 pb-4 pt-5 sm:p-5 sm:pb-6 sm:pt-6">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 text-[11px] text-white/45">
                    {step.number}
                  </div>
                  <h3 className="mt-6 text-2xl font-semibold leading-tight tracking-[-0.04em] [overflow-wrap:anywhere] sm:text-3xl">
                    {step.title}
                  </h3>
                  <p className="mt-3 text-sm leading-6 text-white/48 [overflow-wrap:anywhere]">
                    {step.description}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-[1500px] gap-4 px-4 py-16 sm:px-8 sm:py-24 lg:grid-cols-2 lg:px-12">
        <div className="rounded-[32px] bg-[#deddd6] p-7 sm:p-10">
          <div className="text-xs font-bold uppercase tracking-[0.18em] text-black/38">
            {ui(locale, "Как получить лучший результат", "Get the best result")}
          </div>
          <h2 className="mt-6 max-w-lg text-4xl font-semibold tracking-[-0.055em] sm:text-5xl">
            {ui(locale, "Хороший исходник сохраняет характер изделия", "A strong source photo preserves the garment")}
          </h2>
          <div className="mt-12 space-y-4">
            {generationTips.slice(0, 4).map((tip, index) => (
              <div key={tip.ru} className="flex gap-4 border-t border-black/10 pt-4">
                <span className="text-xs font-bold text-black/30">0{index + 1}</span>
                <p className="text-sm leading-6 text-black/58">{tip[locale]}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-[32px] bg-white p-7 sm:p-10">
          <div className="text-xs font-bold uppercase tracking-[0.18em] text-black/38">
            {ui(locale, "Готовые идеи", "Ready-made ideas")}
          </div>
          <h2 className="mt-6 max-w-lg text-4xl font-semibold tracking-[-0.055em] sm:text-5xl">
            {ui(locale, "Не нужно начинать с пустого поля", "Never start from a blank field")}
          </h2>
          <div className="mt-12 flex flex-wrap gap-2.5">
            {promptIdeas.map((idea) => (
              <SignUpButton key={idea.ru} mode="modal">
                <button type="button" className="rounded-full border border-black/10 bg-[#f6f5f1] px-4 py-3 text-left text-sm leading-5 text-black/58 transition hover:border-black/30 hover:text-black">
                  {idea[locale]}
                </button>
              </SignUpButton>
            ))}
          </div>
          <p className="mt-7 text-xs leading-5 text-black/35">
            {ui(locale, "Нажмите на идею, зарегистрируйтесь и адаптируйте её под своё изделие.", "Choose an idea, sign in, and adapt it to your garment.")}
          </p>
        </div>
      </section>

      <section className="border-y border-black/8 bg-white">
        <div className="mx-auto max-w-[1500px] px-4 py-16 sm:px-8 sm:py-24 lg:px-12">
          <LandingHeading
            eyebrow={ui(locale, "Почему SSSWEAR AI", "Why SSSWEAR AI")}
            title={ui(locale, "Сделано вокруг реальных задач одежды", "Built around real fashion workflows")}
          />
          <div className="mt-14 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-5">
            {[
              ["< 1 min", ui(locale, "Генерация менее минуты", "Generation in under a minute")],
              ["REAL", ui(locale, "Реалистичные фотографии", "Realistic fashion imagery")],
              ["02", ui(locale, "Каталог и lifestyle", "Catalog and lifestyle")],
              ["− COST", ui(locale, "Экономия на фотосессиях", "Lower photo production costs")],
              ["PRIVATE", ui(locale, "Приватность изображений", "Private source images")],
            ].map(([value, label]) => (
              <div key={label} className="border-t border-black/10 pt-5">
                <div className="text-sm font-bold tracking-[-0.02em]">{value}</div>
                <div className="mt-8 text-sm leading-6 text-black/48">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="pricing" className="mx-auto max-w-[1500px] px-4 py-16 sm:px-8 sm:py-24 lg:px-12">
        <LandingHeading
          eyebrow={ui(locale, "Тарифы", "Pricing")}
          title={ui(locale, "Выберите объём под текущую задачу", "Choose the right volume for your work")}
        />
        <div className="mt-12 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {plans.map((plan, index) => (
            <div key={plan.name} className={[
              "flex min-h-[360px] flex-col rounded-[28px] border p-6",
              index === 1 ? "border-black bg-black text-white" : "border-black/9 bg-white",
            ].join(" ")}>
              <div className={index === 1 ? "text-xs font-bold tracking-[0.18em] text-white/40" : "text-xs font-bold tracking-[0.18em] text-black/35"}>{plan.name}</div>
              <div className="mt-8 text-4xl font-semibold tracking-[-0.055em]">{plan.price}</div>
              <div className={index === 1 ? "mt-3 text-sm text-white/45" : "mt-3 text-sm text-black/45"}>{plan.credits} Credits</div>
              <div className="mt-auto">
                <div className={index === 1 ? "mb-5 border-t border-white/12 pt-5 text-sm text-white/55" : "mb-5 border-t border-black/10 pt-5 text-sm text-black/55"}>
                  {plan.photos} {ui(locale, "фотографий", "photos")}
                </div>
                <SignUpButton mode="modal">
                  <button type="button" className={index === 1 ? "w-full rounded-full bg-white px-5 py-3.5 text-sm font-semibold text-black" : "w-full rounded-full bg-black px-5 py-3.5 text-sm font-semibold text-white"}>
                    {ui(locale, "Начать", "Get started")}
                  </button>
                </SignUpButton>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-[1500px] px-4 pb-16 sm:px-8 sm:pb-24 lg:px-12">
        <div className="rounded-[36px] bg-[#111111] px-7 py-14 text-white sm:px-12 lg:flex lg:items-end lg:justify-between lg:gap-10">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.18em] text-white/55">SSSWEAR AI</div>
            <h2 className="mt-6 max-w-3xl text-5xl font-semibold leading-[0.94] tracking-[-0.065em] sm:text-6xl">
              {ui(locale, "Первая съёмка начинается с одной фотографии", "Your first shoot starts with one photo")}
            </h2>
          </div>
          <SignUpButton mode="modal">
            <button type="button" className="mt-9 shrink-0 rounded-full bg-white px-7 py-4 text-sm font-semibold text-black lg:mt-0">
              {ui(locale, "Попробовать бесплатно", "Try it free")}
            </button>
          </SignUpButton>
        </div>
      </section>
    </div>
  );
}

function LandingHeading({
  eyebrow,
  title,
  dark = false,
}: {
  eyebrow: string;
  title: string;
  dark?: boolean;
}) {
  return (
    <div className="max-w-4xl">
      <div className={dark ? "text-xs font-bold uppercase tracking-[0.18em] text-white/38" : "text-xs font-bold uppercase tracking-[0.18em] text-black/38"}>
        {eyebrow}
      </div>
      <h2 className="mt-6 max-w-full text-[clamp(2rem,8.5vw,2.65rem)] font-semibold leading-[0.98] tracking-[-0.05em] [overflow-wrap:anywhere] sm:text-6xl sm:leading-[0.96] sm:tracking-[-0.06em]">
        {title}
      </h2>
    </div>
  );
}

function WelcomeScreen({
  locale,
  onClose,
}: {
  locale: Locale;
  onClose: () => void;
}) {
  useBodyScrollLock(true);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const steps = [
    {
      title: ui(locale, "Загрузите вещь", "Upload garment"),
      image: "/onboarding-upload.jpg",
      alt: ui(locale, "Пример загруженной вещи", "Uploaded garment example"),
    },
    {
      title: ui(locale, "Опишите съёмку", "Describe shoot"),
      image: "/onboarding-prompt.jpg",
      alt: ui(locale, "Пример описания съёмки", "Shoot description example"),
    },
    {
      title: ui(locale, "Скачайте кадр", "Download image"),
      image: "/onboarding-result.jpg",
      alt: ui(locale, "Пример готового результата", "Generated result example"),
    },
  ];

  return (
    <div
      className="fixed inset-0 z-[100] overflow-y-auto overscroll-contain bg-black/72 backdrop-blur-xl"
      role="dialog"
      aria-modal="true"
      aria-label={ui(locale, "Добро пожаловать в SSSWEAR AI", "Welcome to SSSWEAR AI")}
    >
      <div className="flex min-h-full items-start justify-center sm:items-center sm:p-4">
        <div className="relative h-[100dvh] w-full max-w-[720px] overflow-y-auto bg-[#0b0b0b] px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))] text-white shadow-[0_40px_140px_rgba(0,0,0,0.55)] sm:h-auto sm:min-h-0 sm:max-h-[calc(100dvh-2rem)] sm:rounded-[34px] sm:p-10">
          <div className="sticky top-0 z-20 -mr-1 flex justify-end pointer-events-none">
            <button
              type="button"
              onClick={onClose}
              className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full border border-white/12 bg-[#171717]/95 text-2xl leading-none text-white/75 shadow-lg backdrop-blur transition hover:bg-white/10 hover:text-white"
              aria-label={ui(locale, "Закрыть приветствие", "Close welcome screen")}
            >
              ×
            </button>
          </div>

          <div className="-mt-10 pr-12 sm:-mt-11">
            <BrandMark size="large" />
          </div>

          <div className="mt-7 text-xs font-bold uppercase tracking-[0.2em] text-white/35 sm:mt-9">
            SSSWEAR AI
          </div>
          <h2 className="mt-4 text-3xl font-semibold leading-[1] tracking-[-0.055em] sm:mt-5 sm:text-6xl sm:leading-[0.96] sm:tracking-[-0.06em]">
            {ui(locale, "Добро пожаловать в AI-фотостудию", "Welcome to your AI photo studio")}
          </h2>
          <p className="mt-5 max-w-lg text-sm leading-6 text-white/55 sm:mt-7 sm:text-base sm:leading-7">
            {ui(
              locale,
              "Мы уже начислили вам 130 бесплатных кредитов — этого хватит примерно на 3 генерации, чтобы познакомиться с сервисом.",
              "We have added 130 free credits — enough for about 3 generations to explore the service.",
            )}
          </p>

          <div className="mt-6 grid gap-2 sm:mt-8 sm:grid-cols-3">
            {steps.map((step, index) => (
              <div
                key={step.title}
                className="grid grid-cols-[88px_1fr] items-center gap-3 overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-3 sm:block"
              >
                <div className="order-2 min-w-0 sm:order-1">
                  <div className="text-[10px] font-bold text-white/30">0{index + 1}</div>
                  <div className="mt-2 text-sm font-medium sm:mt-3">{step.title}</div>
                </div>
                <div className="order-1 overflow-hidden rounded-xl bg-white sm:order-2 sm:mt-4">
                  <img
                    src={step.image}
                    alt={step.alt}
                    className="aspect-square h-auto w-full object-cover sm:aspect-[8/5]"
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="sticky bottom-0 z-10 -mx-1 mt-5 bg-[#0b0b0b]/96 pb-[max(0.25rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur sm:static sm:mx-0 sm:mt-8 sm:bg-transparent sm:p-0">
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-full bg-white px-7 py-4 text-sm font-semibold text-black transition hover:bg-white/85"
            >
              {ui(locale, "Начать", "Start creating")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AppFooter({
  locale,
  signedIn,
}: {
  locale: Locale;
  signedIn: boolean;
}) {
  return (
    <footer className={signedIn ? "mt-10 border-t border-black/8" : "border-t border-black/8"}>
      <div className="mx-auto flex max-w-[1500px] flex-col gap-5 px-5 py-8 text-xs text-black/38 sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-12">
        <div>© {new Date().getFullYear()} SSSWEAR AI</div>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <span>{ui(locale, "Конфиденциальность", "Privacy")}</span>
          <span>{ui(locale, "Условия", "Terms")}</span>
          <span>{ui(locale, "Поддержка", "Support")}</span>
        </div>
        <div>{ui(locale, "Создано SSSWEAR Studio", "Made by SSSWEAR Studio")}</div>
      </div>
    </footer>
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
  const locale = useLocale();
  const [generationStep, setGenerationStep] = useState(0);
  const resultSectionRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!loading) {
      return;
    }

    const resetTimeout = window.setTimeout(() => setGenerationStep(0), 0);
    const interval = window.setInterval(() => {
      setGenerationStep((currentStep) =>
        Math.min(currentStep + 1, generationStatuses.length - 1),
      );
    }, 5500);

    return () => {
      window.clearTimeout(resetTimeout);
      window.clearInterval(interval);
    };
  }, [loading]);

  useEffect(() => {
    if (!loading || window.innerWidth >= 1024) {
      return;
    }

    const timeout = window.setTimeout(() => {
      resultSectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 120);

    return () => window.clearTimeout(timeout);
  }, [loading]);

  const generationStatus = generationStatuses[generationStep][locale];
  const generationTip =
    generationTips[generationStep % generationTips.length][locale];

  const promptExamples: LocalizedText[] = [
    {
      ru: "Девушка идёт по вечерней Москве, дождь, неон, реалистичная мобильная съёмка",
      en: "A woman walking through evening Moscow, rain, neon, realistic mobile photo",
    },
    {
      ru: "Кофейня в Санкт-Петербурге, мягкий утренний свет, плёночная фотография",
      en: "A Saint Petersburg coffee shop, soft morning light, film photography",
    },
    {
      ru: "Мужчина на фоне стены во дворе, естественная поза, съёмка на iPhone",
      en: "A man by a courtyard wall, natural pose, shot on iPhone",
    },
    {
      ru: "Карточка товара на белой циклораме, мягкая тень, премиальный каталог",
      en: "Product card on a white cyclorama, soft shadow, premium catalog",
    },
  ];

  return (
    <>
      <section className="mx-auto grid min-w-0 max-w-[1500px] gap-5 px-3 py-4 sm:gap-6 sm:px-6 sm:py-5 lg:grid-cols-[560px_minmax(0,1fr)] lg:px-8">
      <aside className="min-w-0 space-y-4 sm:space-y-5">
        <div className="rounded-[24px] border border-black/10 bg-white p-4 shadow-[0_20px_60px_rgba(0,0,0,0.06)] sm:rounded-[28px] sm:p-6">
          <div className="mb-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs font-bold uppercase tracking-[0.18em] text-black/35">
                {ui(locale, "AI-фотостудия", "AI photo studio")}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="rounded-full border border-black/10 bg-[#f6f5f1] px-3 py-1.5 text-xs text-black/50">
                  {uploadedCount} {ui(locale, "файлов", "files")}
                </div>
                <div className="rounded-full bg-black px-3 py-1.5 text-xs font-semibold text-white">
                  {creditsLoading || credits === null
                    ? ui(locale, "Баланс…", "Balance…")
                    : `${formatCredits(credits, locale)} ${ui(locale, "кредитов", "credits")}`}
                </div>
              </div>
            </div>
            <h1 className="mt-4 text-3xl font-semibold leading-tight tracking-[-0.05em] sm:mt-5 sm:text-4xl sm:tracking-[-0.055em]">
              {ui(locale, "Создайте новую съёмку", "Create a new shoot")}
            </h1>
            <p className="mt-3 max-w-md text-sm leading-6 text-black/52">
              {ui(
                locale,
                "Загрузите фотографии изделия, выберите задачу и опишите желаемый кадр.",
                "Upload garment photos, choose the task, and describe the image you want.",
              )}
            </p>
          </div>

          <div className="grid gap-3">
            <UploadCard
              title={ui(locale, "СПЕРЕДИ", "FRONT")}
              description={ui(
                locale,
                "Основной вид изделия спереди",
                "Main front view of the garment",
              )}
              file={frontFile}
              onChange={onFrontFileChange}
              required
            />

            <UploadCard
              title={ui(locale, "СЗАДИ", "BACK")}
              description={ui(
                locale,
                "Вид сзади помогает сохранить конструкцию",
                "The back view helps preserve construction",
              )}
              file={backFile}
              onChange={onBackFileChange}
            />

            <DetailsUpload files={detailFiles} onChange={onDetailFilesChange} />
          </div>
        </div>

        <div className="rounded-[24px] border border-black/10 bg-white p-4 shadow-[0_20px_60px_rgba(0,0,0,0.05)] sm:rounded-[28px] sm:p-6">
          <SectionTitle
            title={ui(locale, "Тип съёмки", "Shooting mode")}
            subtitle={ui(
              locale,
              "Выберите подходящий сценарий",
              "Choose the right scenario",
            )}
          />

          <div className="mt-4 grid grid-cols-1 gap-3 min-[390px]:grid-cols-2">
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
                    {item.title[locale]}
                  </div>

                  <div
                    className={[
                      "mt-1 text-xs leading-5",
                      selected ? "text-white/65" : "text-black/45",
                    ].join(" ")}
                  >
                    {item.description[locale]}
                  </div>

                  <div
                    className={[
                      "mt-3 text-xs font-semibold",
                      selected ? "text-white" : "text-black",
                    ].join(" ")}
                  >
                    {itemCost} {ui(locale, "кредитов", "credits")}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-[24px] border border-black/10 bg-white p-4 shadow-[0_20px_60px_rgba(0,0,0,0.05)] sm:rounded-[28px] sm:p-6">
          <SectionTitle
            title={ui(locale, "Формат", "Format")}
            subtitle={ui(
              locale,
              "Соотношение сторон готового изображения",
              "Aspect ratio of the final image",
            )}
          />

          <div className="mt-4 flex flex-wrap gap-2">
            {ratios.map((ratio) => (
              <button
                key={ratio}
                type="button"
                onClick={() => onAspectRatioChange(ratio)}
                className={[
                  "rounded-full border px-4 py-3 text-sm transition sm:px-5",
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

        <div className="rounded-[24px] border border-black/10 bg-white p-4 shadow-[0_20px_60px_rgba(0,0,0,0.05)] sm:rounded-[28px] sm:p-6">
          <SectionTitle
            title={ui(
              locale,
              "Опишите желаемую съёмку",
              "Describe the desired shoot",
            )}
            subtitle={ui(
              locale,
              "Опишите сцену, образ, свет или настроение",
              "Describe the scene, look, lighting, or mood",
            )}
          />

          <textarea
            value={userPrompt}
            onChange={(event) => onPromptChange(event.target.value)}
            placeholder={ui(
              locale,
              "Например: естественный дневной свет, летнее настроение, реалистичная кожа, улица Москвы, съёмка на iPhone",
              "For example: natural daylight, summer mood, realistic skin, city street, shot on iPhone",
            )}
            rows={5}
            maxLength={1000}
            className="mt-4 w-full resize-none rounded-2xl border border-black/10 bg-[#fbfaf7] p-4 text-sm leading-6 outline-none transition placeholder:text-black/35 focus:border-black/30"
          />

          <div className="mt-3 flex items-center justify-between text-[11px] text-black/30">
            <span>{ui(locale, "Готовые идеи", "Ready-made ideas")}</span>
            <span>{userPrompt.length}/1000</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {promptExamples.map((example) => (
              <button
                key={example.ru}
                type="button"
                onClick={() => onPromptChange(example[locale])}
                className="rounded-full border border-black/10 bg-[#f6f5f1] px-3 py-2 text-left text-[11px] leading-4 text-black/52 transition hover:border-black/25 hover:text-black"
              >
                {example[locale]}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={onGenerate}
            disabled={
              loading || creditsLoading || credits === null || !hasEnoughCredits
            }
            className="mt-5 w-full rounded-2xl bg-black px-5 py-4 text-sm font-semibold text-white transition hover:bg-black/85 disabled:cursor-not-allowed disabled:bg-black/35"
          >
            {loading
              ? ui(
                  locale,
                  "Подготавливаем фотографии...",
                  "Preparing photos...",
                )
              : creditsLoading || credits === null
                ? ui(locale, "Загружаем баланс...", "Loading credits...")
                : !hasEnoughCredits
                  ? ui(
                      locale,
                      `Недостаточно кредитов • требуется ${generationCost}`,
                      `Not enough credits • ${generationCost} required`,
                    )
                  : ui(
                      locale,
                      `Создать изображение • ${generationCost} кредитов`,
                      `Create image • ${generationCost} credits`,
                    )}
          </button>

          {!creditsLoading && credits !== null && !hasEnoughCredits && (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <div className="text-sm font-medium text-amber-900">
                {ui(
                  locale,
                  "Недостаточно кредитов для генерации.",
                  "Not enough credits for this generation.",
                )}
              </div>

              <div className="mt-1 text-xs leading-5 text-amber-700">
                {ui(
                  locale,
                  `На балансе ${formatCredits(credits, locale)} кредитов. Для выбранного режима требуется ${generationCost} кредитов.`,
                  `Your balance is ${formatCredits(credits, locale)} credits. The selected mode requires ${generationCost} credits.`,
                )}
              </div>

              <button
                type="button"
                onClick={onOpenCredits}
                className="mt-3 rounded-full bg-amber-900 px-4 py-2 text-xs font-medium text-white"
              >
                {ui(locale, "Пополнить баланс", "Buy credits")}
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

      <section ref={resultSectionRef} className="min-w-0 scroll-mt-32 rounded-[24px] border border-black/10 bg-[#111111] p-3 shadow-[0_30px_80px_rgba(0,0,0,0.12)] sm:min-h-[560px] sm:rounded-[32px] sm:p-5 lg:min-h-[calc(100vh-120px)]">
        <div className="flex h-full min-h-[420px] flex-col rounded-[18px] bg-[#181818] sm:min-h-[540px] sm:rounded-[24px] lg:min-h-[720px]">
          <div className="flex flex-col items-start justify-between gap-3 border-b border-white/10 px-4 py-4 sm:flex-row sm:items-center sm:px-5">
            <div>
              <div className="text-sm font-medium text-white">
                {ui(locale, "Результат", "Result")}
              </div>

              <div className="mt-1 text-xs text-white/40">
                {ui(
                  locale,
                  "Готовое изображение появится здесь",
                  "Your finished image will appear here",
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {image && !loading && (
                <div className="rounded-full bg-[#e71c2a] px-3 py-1 text-xs font-semibold text-white">
                  {ui(locale, "Готово", "Ready")}
                </div>
              )}
              <div className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/50">
                {generationCost} {ui(locale, "кредитов", "credits")}
              </div>

              <div className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/50">
                {aspectRatio}
              </div>
            </div>
          </div>

          <div className="flex flex-1 items-center justify-center p-4 sm:p-6">
            {loading && (
              <div className="w-full max-w-md text-center">
                <div className="flex justify-center">
                  <BrandMark size="large" />
                </div>
                <div className="mt-7 text-lg font-medium text-white">
                  {generationStatus}
                </div>
                <p className="mt-3 text-sm leading-6 text-white/38">
                  {ui(
                    locale,
                    "Генерация идёт в правой части студии. Не закрывайте страницу.",
                    "Generation is running in the studio panel. Keep this page open.",
                  )}
                </p>
                <div className="mx-auto mt-6 max-w-sm rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-4 text-left">
                  <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/25">
                    {ui(locale, "Пока кадр создаётся", "While your image is being created")}
                  </div>
                  <p className="mt-2 text-sm leading-6 text-white/48">
                    {generationTip}
                  </p>
                </div>
              </div>
            )}

            {!loading && !image && (
              <div className="max-w-md text-center">
                <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full border border-white/10 bg-white/5 text-3xl">
                  ✦
                </div>

                <h2 className="text-2xl font-semibold tracking-[-0.04em] text-white sm:text-3xl">
                  {ui(
                    locale,
                    "Здесь появится готовая фотография.",
                    "Your finished photo will appear here.",
                  )}
                </h2>

                <p className="mt-4 text-sm leading-6 text-white/40">
                  {ui(
                    locale,
                    "Загрузите хотя бы фотографию спереди, выберите тип съёмки и запустите генерацию.",
                    "Upload at least the front photo, choose a shooting mode, and start generation.",
                  )}
                </p>
              </div>
            )}

            {!loading && image && (
              <div className="w-full max-w-[760px]">
                <img
                  src={image}
                  alt={ui(locale, "Результат генерации", "Generation result")}
                  className="max-h-[72dvh] w-full rounded-[18px] object-contain shadow-[0_30px_80px_rgba(0,0,0,0.35)] sm:rounded-[24px]"
                />

                <div className="mt-5 flex flex-wrap justify-center gap-3">
                  <button
                    type="button"
                    onClick={onDownload}
                    disabled={downloading}
                    className="rounded-full bg-white px-5 py-3 text-sm font-medium text-black transition hover:bg-white/85 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {downloading
                      ? ui(locale, "Скачиваем...", "Downloading...")
                      : ui(locale, "Скачать PNG", "Download PNG")}
                  </button>

                  <button
                    type="button"
                    onClick={onGenerate}
                    disabled={
                      loading || credits === null || credits < generationCost
                    }
                    className="rounded-full border border-white/15 px-5 py-3 text-sm font-medium text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {ui(locale, "Создать ещё", "Create another")} •{" "}
                    {generationCost} {ui(locale, "кредитов", "credits")}
                  </button>
                </div>

                {imagePath && (
                  <div className="mt-4 text-center text-[11px] text-white/25">
                    {ui(
                      locale,
                      "Надёжно сохранено в истории генераций",
                      "Saved securely in your generation history",
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </section>
      </section>
    </>
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
  const locale = useLocale();
  return (
    <section className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
        <div>
          <div className="text-sm font-semibold uppercase tracking-[0.2em] text-black/40">
            {ui(locale, "Библиотека", "Library")}
          </div>

          <h1 className="mt-3 text-3xl font-semibold tracking-[-0.05em] sm:text-4xl md:text-6xl">
            {ui(locale, "История генераций", "Generation history")}
          </h1>

          <p className="mt-4 max-w-2xl text-sm leading-6 text-black/50">
            {ui(
              locale,
              "Здесь хранятся все созданные изображения с выбранным режимом, форматом, описанием и датой генерации.",
              "All generated images are stored here with their mode, format, prompt, and generation date.",
            )}
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="rounded-full border border-black/10 bg-white px-5 py-3 text-sm font-medium transition hover:border-black/25 disabled:opacity-50"
          >
            {loading
              ? ui(locale, "Обновляем...", "Refreshing...")
              : ui(locale, "Обновить", "Refresh")}
          </button>

          <button
            type="button"
            onClick={onOpenStudio}
            className="rounded-full bg-black px-5 py-3 text-sm font-medium text-white transition hover:bg-black/85"
          >
            {ui(locale, "Новая генерация", "New generation")}
          </button>
        </div>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <StatCard
          label={ui(locale, "Создано изображений", "Generated images")}
          value={formatCredits(totalGenerations, locale)}
        />

        <StatCard
          label={ui(locale, "Потрачено кредитов", "Credits spent")}
          value={formatCredits(totalCreditsSpent, locale)}
        />

        <StatCard
          label={ui(locale, "Изображений в истории", "Images in history")}
          value={formatCredits(total, locale)}
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
        <div className="mt-8 rounded-[24px] border border-black/10 bg-white px-5 py-14 text-center shadow-[0_20px_60px_rgba(0,0,0,0.05)] sm:rounded-[32px] sm:px-8 sm:py-20">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-black text-2xl text-white">
            ✦
          </div>

          <h2 className="mt-6 text-3xl font-semibold tracking-[-0.04em]">
            {ui(
              locale,
              "Пока нет готовых изображений",
              "No generated images yet",
            )}
          </h2>

          <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-black/50">
            {ui(
              locale,
              "Создайте первую AI-фотографию — после генерации она автоматически появится здесь.",
              "Create your first AI fashion photo. It will automatically appear here after generation.",
            )}
          </p>

          <button
            type="button"
            onClick={onOpenStudio}
            className="mt-6 rounded-full bg-black px-6 py-3 text-sm font-medium text-white"
          >
            {ui(locale, "Перейти к созданию", "Start creating")}
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
                {loadingMore
                  ? ui(locale, "Загрузка...", "Loading...")
                  : ui(locale, "Показать ещё", "Load more")}
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
  const locale = useLocale();
  return (
    <section className="mx-auto max-w-[1180px] px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
        <div>
          <div className="text-sm font-semibold uppercase tracking-[0.2em] text-black/40">
            {ui(locale, "Баланс", "Balance")}
          </div>

          <h1 className="mt-3 text-3xl font-semibold tracking-[-0.05em] sm:text-4xl md:text-6xl">
            {ui(locale, "Кредиты", "Credits")}
          </h1>

          <p className="mt-4 max-w-2xl text-sm leading-6 text-black/50">
            {ui(
              locale,
              "Баланс используется для генераций. Стоимость зависит от выбранного типа съёмки.",
              "Credits are used for generations. The cost depends on the selected shooting mode.",
            )}
          </p>
        </div>

        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="self-start rounded-full border border-black/10 bg-white px-5 py-3 text-sm font-medium transition hover:border-black/25 disabled:opacity-50 md:self-auto"
        >
          {loading
            ? ui(locale, "Обновляем...", "Refreshing...")
            : ui(locale, "Обновить баланс", "Refresh balance")}
        </button>
      </div>

      {error && (
        <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="mt-8 grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[24px] bg-black p-5 text-white shadow-[0_30px_80px_rgba(0,0,0,0.16)] sm:rounded-[32px] sm:p-8">
          <div className="text-sm uppercase tracking-[0.18em] text-white/45">
            {ui(locale, "Текущий баланс", "Current balance")}
          </div>

          <div className="mt-6 break-all text-5xl font-semibold tracking-[-0.06em] sm:text-6xl">
            {formatCredits(balance, locale)}
          </div>

          <div className="mt-2 text-sm text-white/45">
            {ui(locale, "Кредиты", "Credits")}
          </div>

          <div className="mt-8 rounded-[24px] border border-white/10 bg-white/5 p-5">
            <div className="text-sm font-medium">
              {ui(
                locale,
                "Подключение покупки кредитов — следующий этап",
                "Credit purchases are the next step",
              )}
            </div>

            <p className="mt-2 text-sm leading-6 text-white/45">
              {ui(
                locale,
                "Этот раздел готов к подключению ЮKassa или Robokassa. Пока кнопка работает как визуальная заглушка.",
                "This section is ready for YooKassa, Robokassa, or another payment provider. The button is currently a visual placeholder.",
              )}
            </p>

            <button
              type="button"
              disabled
              className="mt-5 w-full cursor-not-allowed rounded-2xl bg-white px-5 py-4 text-sm font-semibold text-black opacity-50"
            >
              {ui(locale, "Пополнить баланс", "Buy credits")}
            </button>
          </div>
        </div>

        <div className="rounded-[24px] border border-black/10 bg-white p-5 shadow-[0_20px_60px_rgba(0,0,0,0.05)] sm:rounded-[32px] sm:p-8">
          <div className="text-sm uppercase tracking-[0.18em] text-black/40">
            {ui(locale, "Расходы", "Usage")}
          </div>

          <div className="mt-5 text-5xl font-semibold tracking-[-0.05em]">
            {formatCredits(totalCreditsSpent, locale)}
          </div>

          <div className="mt-2 text-sm text-black/45">
            {ui(locale, "Всего потрачено кредитов", "Credits spent in total")}
          </div>

          <div className="mt-8 space-y-3">
            {modes.map((item) => (
              <div
                key={item.value}
                className="flex items-center justify-between rounded-2xl bg-[#f7f5f0] px-4 py-3"
              >
                <div>
                  <div className="text-sm font-medium">
                    {item.title[locale]}
                  </div>

                  <div className="mt-1 text-xs text-black/40">
                    {item.description[locale]}
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

      <div className="mt-6 rounded-[24px] border border-black/10 bg-white p-4 shadow-[0_20px_60px_rgba(0,0,0,0.05)] sm:rounded-[32px] sm:p-6">
        <div className="flex flex-col items-stretch justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-2xl font-semibold tracking-[-0.04em]">
              {ui(locale, "Последние операции", "Recent transactions")}
            </h2>

            <p className="mt-2 text-sm text-black/45">
              {ui(
                locale,
                "Списания, пополнения и корректировки баланса.",
                "Latest credit charges, purchases, and adjustments.",
              )}
            </p>
          </div>

          <div className="rounded-full bg-[#f7f5f0] px-4 py-2 text-xs text-black/50">
            {transactions.length} {ui(locale, "операций", "records")}
          </div>
        </div>

        <div className="mt-6 divide-y divide-black/8">
          {transactions.length === 0 ? (
            <div className="py-10 text-center text-sm text-black/45">
              {ui(locale, "Операций пока нет.", "No transactions yet.")}
            </div>
          ) : (
            transactions.map((transaction) => (
              <TransactionRow key={transaction.id} transaction={transaction} />
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
  const locale = useLocale();
  return (
    <section className="mx-auto max-w-[980px] px-4 py-6 sm:px-6 sm:py-8">
      <div>
        <div className="text-sm font-semibold uppercase tracking-[0.2em] text-black/40">
          {ui(locale, "Профиль", "Profile")}
        </div>

        <h1 className="mt-3 text-3xl font-semibold tracking-[-0.05em] sm:text-4xl md:text-6xl">
          {ui(locale, "Аккаунт", "Account")}
        </h1>

        <p className="mt-4 max-w-2xl text-sm leading-6 text-black/50">
          {ui(
            locale,
            "Информация об аккаунте SSSWEAR AI и статистика использования.",
            "Your SSSWEAR AI account information and usage statistics.",
          )}
        </p>
      </div>

      <div className="mt-8 rounded-[24px] border border-black/10 bg-white p-5 shadow-[0_20px_60px_rgba(0,0,0,0.05)] sm:rounded-[32px] sm:p-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-black text-2xl font-semibold text-white">
            {(name || email || "S").slice(0, 1).toUpperCase()}
          </div>

          <div className="min-w-0">
            <h2 className="break-words text-2xl font-semibold tracking-[-0.04em] sm:text-3xl">
              {name || ui(locale, "Пользователь SSSWEAR AI", "SSSWEAR AI user")}
            </h2>

            <p className="mt-2 break-all text-sm text-black/45">
              {email ||
                ui(
                  locale,
                  "Электронная почта не указана",
                  "Email not provided",
                )}
            </p>
          </div>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <AccountStat
            label={ui(locale, "Баланс", "Balance")}
            value={`${formatCredits(balance, locale)} ${ui(locale, "кредитов", "credits")}`}
          />

          <AccountStat
            label={ui(locale, "Генерации", "Generations")}
            value={formatCredits(totalGenerations, locale)}
          />

          <AccountStat
            label={ui(locale, "Потрачено кредитов", "Credits spent")}
            value={formatCredits(totalCreditsSpent, locale)}
          />
        </div>

        <div className="mt-8 rounded-[24px] bg-[#f7f5f0] p-5">
          <div className="text-sm font-medium">
            {ui(
              locale,
              "Доступ и безопасность аккаунта",
              "Account access and security",
            )}
          </div>

          <p className="mt-2 text-sm leading-6 text-black/45">
            {ui(
              locale,
              "Электронная почта, пароль и активные сессии безопасно управляются через Clerk. Для управления аккаунтом используйте кнопку профиля в правом верхнем углу.",
              "Email, password, and active sessions are securely managed through Clerk. Use the profile button in the top-right corner to manage your account.",
            )}
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
  const locale = useLocale();
  return (
    <button
      type="button"
      onClick={onClick}
      className="group overflow-hidden rounded-[28px] border border-black/10 bg-white text-left shadow-[0_20px_60px_rgba(0,0,0,0.05)] transition hover:-translate-y-1 hover:shadow-[0_28px_70px_rgba(0,0,0,0.1)]"
    >
      <div className="relative aspect-[4/5] overflow-hidden bg-black/5">
        <img
          src={item.imageUrl}
          alt={
            item.userPrompt ||
            ui(
              locale,
              "Сгенерированное fashion-изображение",
              "Generated fashion image",
            )
          }
          loading="lazy"
          className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
        />

        <div className="absolute left-3 top-3 rounded-full bg-black/70 px-3 py-1.5 text-[11px] font-medium text-white backdrop-blur">
          {modeTitles[item.mode][locale]}
        </div>

        <div className="absolute right-3 top-3 rounded-full bg-white/85 px-3 py-1.5 text-[11px] font-medium text-black backdrop-blur">
          {item.aspectRatio}
        </div>
      </div>

      <div className="p-5">
        <div className="line-clamp-2 min-h-10 text-sm font-medium leading-5">
          {item.userPrompt ||
            ui(
              locale,
              "Без дополнительных пожеланий",
              "No additional instructions",
            )}
        </div>

        <div className="mt-4 flex items-center justify-between text-xs text-black/40">
          <span>{formatDate(item.createdAt, locale)}</span>
          <span>
            {item.creditsSpent} {ui(locale, "кредитов", "credits")}
          </span>
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
  const locale = useLocale();
  useBodyScrollLock(true);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-black/80 p-2 backdrop-blur-sm sm:flex sm:items-center sm:justify-center sm:p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="grid min-h-full w-full max-w-[1180px] overflow-hidden rounded-[24px] bg-[#111111] shadow-[0_40px_120px_rgba(0,0,0,0.45)] sm:min-h-0 sm:max-h-[94dvh] sm:rounded-[32px] lg:grid-cols-[minmax(0,1fr)_390px]">
        <div className="flex min-h-[300px] items-center justify-center overflow-auto bg-[#171717] p-3 sm:min-h-[420px] md:p-8">
          <img
            src={item.imageUrl}
            alt={
              item.userPrompt ||
              ui(
                locale,
                "Сгенерированное fashion-изображение",
                "Generated fashion image",
              )
            }
            className="max-h-[58dvh] max-w-full rounded-[16px] object-contain sm:max-h-[82dvh] sm:rounded-[20px]"
          />
        </div>

        <div className="overflow-y-auto border-t border-white/10 p-5 text-white sm:p-6 lg:border-l lg:border-t-0">
          <div className="flex items-center justify-between gap-4">
            <div className="text-sm font-semibold uppercase tracking-[0.18em] text-white/45">
              {ui(locale, "Генерация", "Generation")}
            </div>

            <button
              type="button"
              onClick={onClose}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 text-lg text-white/70 transition hover:bg-white/10"
              aria-label={ui(locale, "Закрыть", "Close")}
            >
              ×
            </button>
          </div>

          <h2 className="mt-6 text-3xl font-semibold tracking-[-0.04em]">
            {modeTitles[item.mode][locale]}
          </h2>

          <div className="mt-4 flex flex-wrap gap-2">
            <div className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-white/55">
              {item.aspectRatio}
            </div>

            <div className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-white/55">
              {item.creditsSpent} {ui(locale, "кредитов", "credits")}
            </div>
          </div>

          <div className="mt-8">
            <div className="text-xs uppercase tracking-[0.16em] text-white/35">
              {ui(locale, "Описание", "Prompt")}
            </div>

            <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-white/70">
              {item.userPrompt ||
                ui(
                  locale,
                  "Без дополнительных пожеланий",
                  "No additional instructions",
                )}
            </p>
          </div>

          <div className="mt-8">
            <div className="text-xs uppercase tracking-[0.16em] text-white/35">
              {ui(locale, "Создано", "Created")}
            </div>

            <p className="mt-3 text-sm text-white/70">
              {formatDate(item.createdAt, locale)}
            </p>
          </div>

          <div className="mt-8 grid gap-3">
            <button
              type="button"
              onClick={onDownload}
              disabled={downloading}
              className="w-full rounded-2xl bg-white px-5 py-4 text-sm font-semibold text-black transition hover:bg-white/85 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {downloading
                ? ui(locale, "Скачиваем...", "Downloading...")
                : ui(locale, "Скачать PNG", "Download PNG")}
            </button>

            <button
              type="button"
              onClick={onUseSettings}
              className="w-full rounded-2xl border border-white/15 px-5 py-4 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              {ui(locale, "Использовать настройки", "Use these settings")}
            </button>
          </div>

          <p className="mt-4 text-xs leading-5 text-white/30">
            {ui(
              locale,
              "Кнопка переносит режим, формат и описание в раздел «Создать». Фотографии изделия нужно загрузить заново.",
              "This copies the mode, format, and prompt to Create. Product photos must be uploaded again.",
            )}
          </p>
        </div>
      </div>
    </div>
  );
}

function TransactionRow({ transaction }: { transaction: CreditTransaction }) {
  const locale = useLocale();
  const positive = transaction.creditsDelta > 0;

  return (
    <div className="flex items-center justify-between gap-4 py-4">
      <div className="min-w-0">
        <div className="truncate text-sm font-medium">
          {getTransactionTitle(transaction, locale)}
        </div>

        <div className="mt-1 text-xs text-black/40">
          {formatDate(transaction.createdAt, locale)}
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
          {transaction.creditsDelta} {ui(locale, "кредитов", "credits")}
        </div>

        <div className="mt-1 text-xs text-black/40">
          {ui(locale, "Баланс", "Balance")}:{" "}
          {formatCredits(transaction.balanceAfter, locale)}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
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

function AccountStat({ label, value }: { label: string; value: string }) {
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
  const locale = useLocale();
  return (
    <label className="block cursor-pointer rounded-2xl border border-dashed border-black/15 bg-[#fbfaf7] p-4 transition hover:border-black/35">
      <input
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => onChange(event.target.files?.[0] || null)}
      />

      <div className="flex flex-col items-stretch justify-between gap-4 sm:flex-row sm:items-center">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-sm font-semibold">{title}</div>

            {required && (
              <div className="rounded-full bg-black px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-white">
                {ui(locale, "Обязательно", "Required")}
              </div>
            )}
          </div>

          <div className="mt-1 text-xs text-black/45">{description}</div>

          {file && (
            <div className="mt-3 break-all text-xs text-black/65">
              ✅ {file.name} — {formatFileSize(file)}
            </div>
          )}
        </div>

        <div className="shrink-0 rounded-full border border-black/10 bg-white px-4 py-2 text-center text-xs font-medium">
          {file
            ? ui(locale, "Заменить", "Replace")
            : ui(locale, "Загрузить", "Upload")}
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
  const locale = useLocale();
  return (
    <label className="block cursor-pointer rounded-2xl border border-dashed border-black/15 bg-[#fbfaf7] p-4 transition hover:border-black/35">
      <input
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(event) => onChange(Array.from(event.target.files || []))}
      />

      <div className="flex flex-col items-stretch justify-between gap-4 sm:flex-row sm:items-center">
        <div className="min-w-0">
          <div className="text-sm font-semibold">
            {ui(locale, "ДЕТАЛИ", "DETAILS")}
          </div>

          <div className="mt-1 text-xs text-black/45">
            {ui(
              locale,
              "Добавьте крупные планы бирок, вышивки, принтов и других деталей",
              "Add close-ups of labels, embroidery, prints, and other details",
            )}
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

        <div className="shrink-0 rounded-full border border-black/10 bg-white px-4 py-2 text-center text-xs font-medium">
          {files.length > 0
            ? ui(locale, "Заменить файлы", "Replace files")
            : ui(locale, "Добавить файлы", "Add files")}
        </div>
      </div>
    </label>
  );
}