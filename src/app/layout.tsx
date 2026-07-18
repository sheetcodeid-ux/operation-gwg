import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { PwaRegister } from "@/components/pwa-register";
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
    default: "Operational System — Executive Command Center",
    template: "%s · Operational System",
  },
  description:
    "Internal operational command center for monitoring 50 outlets across 5 areas: hospitality, hygiene, work, events, and complaints.",
  applicationName: "Operation GWG",
  appleWebApp: { capable: true, title: "Operation GWG", statusBarStyle: "default" },
};

// Match the phone status bar to the app background (not navy) so the top strip
// blends with the header instead of showing a blue band.
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#101013" },
  ],
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
          <PwaRegister />
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
