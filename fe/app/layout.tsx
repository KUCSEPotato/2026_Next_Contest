import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import Navbar from "../components/Navbar";
import AuthSessionNotifier from "../components/AuthSessionNotifier";
import BackButton from "../components/BackButton";
import { AppFeedbackProvider } from "../components/AppFeedback";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Devory",
  description: "아이디어가 팀이 되고, 팀이 프로젝트로 자라는 곳",
  icons: {
    icon: "/logo_colored.svg",
  },
};

const themeInitScript = `
(function () {
  try {
    var storedTheme = window.localStorage.getItem("devory-theme");
    var prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    var theme = storedTheme || (prefersDark ? "dark" : "light");
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.dataset.theme = theme;
  } catch (error) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Script
          id="devory-theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: themeInitScript }}
        />
        <AppFeedbackProvider>
          <AuthSessionNotifier />
          <Navbar />
          <BackButton />
          {children}
        </AppFeedbackProvider>
      </body>
    </html>
  );
}
