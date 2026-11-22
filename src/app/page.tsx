import Link from "next/link";
import { Camera, Images, Sparkles } from "lucide-react";

export default function HomePage() {
  return (
    <main className="bg-soft-grid flex flex-1 flex-col items-center justify-between px-4 py-8 sm:py-12">
      <div />

      {/* Kartu Utama */}
      <div className="w-full max-w-md rounded-[2rem] border-4 border-slate-900 bg-white p-7 text-center shadow-[8px_8px_0px_#0f172a] sm:p-9">
        <div className="mx-auto mb-3 inline-flex items-center gap-1.5 rounded-full border-2 border-slate-900 bg-amber-300 px-4 py-1 text-xs font-extrabold uppercase tracking-wider text-slate-900">
          <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
          GSJA El Shaddai Batu Kajang
        </div>

        <h1 className="text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
          Terang Dalam Kegelapan
        </h1>
        <p className="mt-2 text-sm font-medium text-slate-600 sm:text-base">
          Abadikan momen sukacita Natal bersama! Pilih frame favoritmu, foto 4 gaya seru, lalu simpan ke HP atau bagikan ke galeri gereja.
        </p>

        {/* Tombol Kamera Utama */}
        <div className="my-7 flex flex-col items-center">
          <Link
            href="/booth"
            className="animate-soft-pulse flex h-28 w-28 items-center justify-center rounded-full border-4 border-slate-900 bg-sky-400 text-slate-950 shadow-[4px_4px_0px_#0f172a] transition hover:bg-sky-300 active:translate-y-0.5"
            aria-label="Mulai Foto"
          >
            <Camera className="h-12 w-12 stroke-[2.4]" />
          </Link>

          <Link
            href="/booth"
            className="mt-4 inline-flex min-h-[48px] items-center justify-center rounded-full border-2 border-slate-900 bg-slate-900 px-7 py-2.5 text-sm font-extrabold uppercase tracking-wide text-white shadow-[3px_3px_0px_#f43f5e] transition hover:bg-slate-800"
          >
            Klik Untuk Mulai Foto
          </Link>
        </div>

        {/* Alur 3 Langkah Singkat */}
        <div className="grid grid-cols-3 gap-2 rounded-2xl bg-amber-50/80 p-3 text-xs font-bold text-slate-700">
          <div className="flex flex-col items-center gap-1">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-300 text-slate-900">
              1
            </span>
            <span>Pilih Frame</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-sky-300 text-slate-900">
              2
            </span>
            <span>Foto 4 Gaya</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-300 text-slate-900">
              3
            </span>
            <span>Simpan HD</span>
          </div>
        </div>

        {/* Tombol Galeri Bersama */}
        <Link
          href="/gallery"
          className="mt-5 inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl border-2 border-slate-200 bg-slate-50 px-5 py-3 text-sm font-extrabold text-slate-800 transition hover:border-slate-300 hover:bg-slate-100"
        >
          <Images className="h-4 w-4 text-sky-600" />
          Lihat Galeri Bersama
        </Link>
      </div>

      {/* Footer halus untuk Admin */}
      <footer className="mt-8 text-center text-xs text-slate-400">
        <Link href="/admin" className="underline-offset-4 hover:text-slate-600 hover:underline">
          Panel Admin (Kelola Frame)
        </Link>
      </footer>
    </main>
  );
}
