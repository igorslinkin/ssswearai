import type { Metadata, Viewport } from "next";
import { AppClerkProvider } from "./clerk-provider";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: {
    default: "SSSWEAR AI — фотографии одежды без фотостудии",
    template: "%s — SSSWEAR AI",
  },
  description:
    "Создавайте каталожные, имиджевые и lifestyle-фотографии одежды за минуты — без моделей, фотографов и студии.",
  applicationName: "SSSWEAR AI",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" className="h-full scroll-smooth antialiased">
      <body className="min-h-full overflow-x-hidden bg-[#f4f3ef] text-[#111111]">
        <AppClerkProvider>{children}</AppClerkProvider>
      </body>
    </html>
  );
}
