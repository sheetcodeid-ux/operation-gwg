import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Operation GWG — Executive Command Center",
    template: "%s · Operation GWG",
  },
  description:
    "Internal operational command center for monitoring 50 outlets across 5 areas: hospitality, hygiene, work, events, and complaints.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
      <body className="flex min-h-dvh flex-col">
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
          {children}
          <Toaster
            theme="system"
            position="top-right"
            toastOptions={{
              classNames: {
                toast: "surface-solid !rounded-xl",
              },
            }}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
