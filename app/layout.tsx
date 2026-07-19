import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

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
    <ClerkProvider>
      <html lang="ru" className="h-full scroll-smooth antialiased">
        <body className="min-h-full bg-[#f4f3ef] text-[#111111]">
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
