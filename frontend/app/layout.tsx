import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "@/components/sidebar";

export const metadata: Metadata = {
  title: "Catering Cost Tracker",
  description:
    "Sistem Monitoring dan Analisis Biaya Operasional Bahan Baku pada Usaha Catering",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <body>
        <div className="flex min-h-screen">
          <Sidebar />
          <main className="w-full flex-1 overflow-x-hidden px-4 pb-8 pt-16 md:max-w-[1100px] md:px-7 md:pt-7">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
