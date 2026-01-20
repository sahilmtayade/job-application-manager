import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { QueryProvider } from "@/lib/query-provider";
import { ThemeProvider } from "@/lib/theme-provider";
import { SidebarProvider } from "@/lib/sidebar-context";
import { JobSearchProvider } from "@/lib/job-search-context";
import { Sidebar } from "@/components/layout/sidebar";
import { MainContent } from "@/components/layout/main-content";
import { Toaster } from "@/components/ui/sonner";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "JAM - Job Application Manager",
  description: "Track and manage your job applications",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <QueryProvider>
            <JobSearchProvider>
              <SidebarProvider>
                <div className="flex h-screen bg-background overflow-hidden">
                  <Sidebar />
                  <MainContent>{children}</MainContent>
                </div>
              </SidebarProvider>
              <Toaster />
            </JobSearchProvider>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
