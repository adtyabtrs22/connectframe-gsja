"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Camera, Download, MonitorPlay, RefreshCw, X } from "lucide-react";
import { fetchGalleryPhotos } from "@/lib/supabase";
import { GalleryPhoto } from "@/types/photobooth";

export default function GalleryPage() {
  const [photos, setPhotos] = useState<GalleryPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<GalleryPhoto | null>(null);

  const loadPhotos = useCallback(async () => {
    setLoading(true);
    try {
      const list = await fetchGalleryPhotos();
      setPhotos(list);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    fetchGalleryPhotos()
      .then((list) => {
        if (active) setPhotos(list);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!selected) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelected(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selected]);

  const handleDownload = (photo: GalleryPhoto) => {
    const a = document.createElement("a");
    a.href = photo.imageUrl;
    a.download = `galeri-gereja-${photo.id}.webp`;
    a.target = "_blank";
    a.click();
  };

  return (
    <main className="bg-soft-grid min-h-screen px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/"
            className="inline-flex min-h-[44px] items-center gap-2 rounded-2xl border-2 border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Beranda
          </Link>

          <div className="flex items-center gap-2">
            <Link
              href="/wall"
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-2xl border-2 border-slate-200 bg-white px-3.5 py-2 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50"
            >
              <MonitorPlay className="h-4 w-4 text-amber-600" aria-hidden="true" />
              <span className="hidden sm:inline">Live Proyektor</span>
            </Link>

            <button
              type="button"
              onClick={loadPhotos}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-2xl border-2 border-slate-200 bg-white px-3.5 py-2 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Muat Ulang
            </button>

            <Link
              href="/booth"
              className="inline-flex min-h-[44px] items-center gap-2 rounded-2xl bg-sky-600 px-4 py-2 text-sm font-extrabold text-white shadow-sm hover:bg-sky-700"
            >
              <Camera className="h-4 w-4" />
              Ikut Foto
            </Link>
          </div>
        </header>

        <div className="mb-6 text-center">
          <h1 className="text-2xl font-black text-slate-900 sm:text-3xl">
            Galeri Bersama Gereja
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Ketuk foto mana saja untuk melihat ukuran penuh atau menyimpannya.
          </p>
        </div>

        {/* Grid Galeri */}
        {loading ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <div key={n} className="aspect-[9/16] animate-pulse rounded-2xl bg-slate-200/70" />
            ))}
          </div>
        ) : photos.length === 0 ? (
          <div className="mx-auto max-w-md rounded-3xl border-2 border-dashed border-slate-300 bg-white p-8 text-center">
            <p className="text-base font-bold text-slate-800">Belum ada foto di galeri</p>
            <p className="mt-1 text-sm text-slate-500">
              Jadilah yang pertama berfoto dan bagikan ke galeri gereja!
            </p>
            <Link
              href="/booth"
              className="mt-4 inline-flex min-h-[46px] items-center gap-2 rounded-2xl bg-sky-600 px-6 py-2.5 text-sm font-extrabold text-white hover:bg-sky-700"
            >
              <Camera className="h-4 w-4" />
              Mulai Foto Sekarang
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 md:grid-cols-4">
            {photos.map((photo) => (
              <button
                key={photo.id}
                type="button"
                onClick={() => setSelected(photo)}
                className="group flex flex-col overflow-hidden rounded-2xl border-2 border-slate-200 bg-white p-1.5 text-left shadow-sm transition hover:border-sky-400 hover:shadow-md"
              >
                <div className="aspect-[9/16] w-full overflow-hidden rounded-xl bg-slate-100">
                  <img
                    src={photo.imageUrl}
                    alt={photo.senderName || "Foto Jemaat"}
                    loading="lazy"
                    className="h-full w-full object-cover transition group-hover:scale-[1.03]"
                  />
                </div>
                <div className="px-1.5 py-2">
                  <p className="truncate text-xs font-extrabold text-slate-800">
                    {photo.senderName || "Jemaat"}
                  </p>
                  <p className="truncate text-[11px] text-slate-400">
                    {new Date(photo.createdAt).toLocaleDateString("id-ID", {
                      day: "numeric",
                      month: "short",
                    })}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Modal Preview Foto */}
      {selected && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Preview foto galeri"
          onClick={() => setSelected(null)}
          className="fixed inset-0 z-50 flex items-center justify-center overscroll-contain bg-black/80 p-4 backdrop-blur-sm"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative flex max-h-[92vh] w-full max-w-sm flex-col items-center rounded-3xl bg-white p-4 shadow-2xl"
          >
            <button
              type="button"
              aria-label="Tutup preview"
              onClick={() => setSelected(null)}
              className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-700 hover:bg-slate-200"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>

            <img
              src={selected.imageUrl}
              alt={selected.senderName || "Foto Jemaat"}
              className="max-h-[70vh] rounded-2xl object-contain"
            />

            <div className="mt-3 flex w-full items-center justify-between gap-3">
              <div>
                <p className="text-sm font-extrabold text-slate-900">
                  {selected.senderName || "Jemaat"}
                </p>
                {selected.frameName && (
                  <p className="text-xs text-slate-500">{selected.frameName}</p>
                )}
              </div>

              <button
                type="button"
                onClick={() => handleDownload(selected)}
                className="inline-flex min-h-[42px] items-center gap-1.5 rounded-xl bg-sky-600 px-4 py-2 text-xs font-extrabold text-white hover:bg-sky-700"
              >
                <Download className="h-4 w-4" />
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
