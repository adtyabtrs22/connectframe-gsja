import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "ConnectFrame — GSJA El Shaddai Batu Kajang",
  description:
    "ConnectFrame GSJA El Shaddai Batu Kajang — Natal: Terang Dalam Kegelapan. Pilih frame, foto 4 gaya, simpan ke HP, dan bagikan ke galeri gereja.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="id" className={`${plusJakarta.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-[#FFFBF2] text-slate-900 font-sans selection:bg-amber-200">
        {children}
      </body>
    </html>
  );
}
