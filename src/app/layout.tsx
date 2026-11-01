import type { Metadata } from "next";
import { Geist_Mono, Sora } from "next/font/google";
import { THEME_SCRIPT } from "@/lib/theme";
import { SiteFooter } from "./_components/brand";
import "./globals.css";

const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Topa? Eventos, hackathons e programas pra estudantes",
    template: "%s | Topa?",
  },
  description:
    "Topa? junta eventos, hackathons, programas e bolsas pra estudantes, montados pelo seu perfil, com prazo e link oficial.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning: the script below may set data-theme before React hydrates.
    <html lang="pt-BR" className={`${sora.variable} ${geistMono.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col font-sans">
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
