import type { Metadata } from "next";
import { Figtree } from "next/font/google";
import { THEME_SCRIPT } from "@/lib/theme";
import "./globals.css";

const figtree = Figtree({
  variable: "--font-figtree",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Oportunidades para estudantes",
  description:
    "Hackathons, eventos e programas abertos para estudantes, montados pelo seu perfil, com prazo e link oficial.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning: the script below may set data-theme before React hydrates.
    <html lang="pt-BR" className={`${figtree.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col font-sans">{children}</body>
    </html>
  );
}
