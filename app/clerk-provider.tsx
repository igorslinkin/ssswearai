"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ClerkProvider } from "@clerk/nextjs";
import { enUS, ruRU } from "@clerk/localizations";

type AppLocale = "ru" | "en";

const LOCALE_STORAGE_KEY = "ssswear-ai-locale";
const LOCALE_CHANGE_EVENT = "ssswear-ai-locale-change";

function isAppLocale(value: unknown): value is AppLocale {
  return value === "ru" || value === "en";
}

function readStoredLocale(): AppLocale {
  if (typeof window === "undefined") {
    return "ru";
  }

  const savedLocale = window.localStorage.getItem(LOCALE_STORAGE_KEY);
  return isAppLocale(savedLocale) ? savedLocale : "ru";
}

export function AppClerkProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<AppLocale>("ru");

  useEffect(() => {
    const syncTimeout = window.setTimeout(() => {
      setLocale(readStoredLocale());
    }, 0);

    const handleStorage = (event: StorageEvent) => {
      if (event.key === LOCALE_STORAGE_KEY && isAppLocale(event.newValue)) {
        setLocale(event.newValue);
      }
    };

    const handleLocaleChange = (event: Event) => {
      const customEvent = event as CustomEvent<AppLocale>;

      if (isAppLocale(customEvent.detail)) {
        setLocale(customEvent.detail);
      } else {
        setLocale(readStoredLocale());
      }
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener(LOCALE_CHANGE_EVENT, handleLocaleChange);

    return () => {
      window.clearTimeout(syncTimeout);
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(LOCALE_CHANGE_EVENT, handleLocaleChange);
    };
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const localization = locale === "ru" ? ruRU : enUS;

  const appearance = useMemo(
    () => ({
      variables: {
        colorPrimary: "#111111",
        colorBackground: "#f4f3ef",
        colorForeground: "#111111",
        colorMutedForeground: "#777773",
        colorInput: "#ffffff",
        colorInputForeground: "#111111",
        colorBorder: "rgba(17, 17, 17, 0.14)",
        colorRing: "rgba(17, 17, 17, 0.18)",
        colorShadow: "rgba(17, 17, 17, 0.16)",
        colorModalBackdrop: "rgba(17, 17, 17, 0.72)",
        borderRadius: "20px",
        fontFamily:
          "Arial, Helvetica, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
        fontFamilyButtons:
          "Arial, Helvetica, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
        fontSize: "0.9375rem",
      },
      options: {
        animations: true,
        logoImageUrl: "/brand-mark.jpg",
        logoLinkUrl: "/",
        logoPlacement: "inside" as const,
        socialButtonsPlacement: "bottom" as const,
        socialButtonsVariant: "blockButton" as const,
      },
      elements: {
        rootBox: "ssswear-clerk-root",
        cardBox: "ssswear-clerk-card-box",
        card: "ssswear-clerk-card",
        header: "ssswear-clerk-header",
        headerTitle: "ssswear-clerk-title",
        headerSubtitle: "ssswear-clerk-subtitle",
        logoBox: "ssswear-clerk-logo-box",
        logoImage: "ssswear-clerk-logo-image",
        formFieldLabel: "ssswear-clerk-label",
        formFieldInput: "ssswear-clerk-input",
        formButtonPrimary: "ssswear-clerk-primary-button",
        socialButtonsBlockButton: "ssswear-clerk-social-button",
        socialButtonsBlockButtonText: "ssswear-clerk-social-button-text",
        dividerLine: "ssswear-clerk-divider-line",
        dividerText: "ssswear-clerk-divider-text",
        footer: "ssswear-clerk-footer",
        footerActionLink: "ssswear-clerk-link",
        formResendCodeLink: "ssswear-clerk-link",
        identityPreviewEditButton: "ssswear-clerk-link",
        otpCodeFieldInput: "ssswear-clerk-otp-input",
        alert: "ssswear-clerk-alert",
        modalBackdrop: "ssswear-clerk-modal-backdrop",
        modalContent: "ssswear-clerk-modal-content",
        userButtonPopoverCard: "ssswear-clerk-popover",
        userButtonPopoverActionButton: "ssswear-clerk-popover-action",
        userButtonPopoverActionButtonText: "ssswear-clerk-popover-action-text",
      },
    }),
    [],
  );

  return (
    <ClerkProvider
      localization={localization}
      appearance={appearance}
      afterSignOutUrl="/"
    >
      {children}
    </ClerkProvider>
  );
}
