"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Maximize2, Minimize2, Sparkles } from "lucide-react";
import { fetchGalleryPhotos } from "@/lib/supabase";
import { GalleryPhoto } from "@/types/photobooth";

export default function LiveWallPage() {
  const [photos, setPhotos] = useState<GalleryPhoto[]>([]);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const loadLatest = useCallback(async () => {
    const list = await fetchGalleryPhotos();
    setPhotos(list.slice(0, 12));
  }, []);

  useEffect(() => {
    let active = true;
    fetchGalleryPhotos().then((list) => {
      if (active) setPhotos(list.slice(0, 12));
    });

    // Auto-refresh setiap 12 detik untuk layar proyektor gereja
    const interval = setInterval(() => {
      void loadLatest();
    }, 12000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [loadLatest]);

  const toggleFullscreen = async () => {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      await document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 px-5 py-6 text-white sm:px-8">
      {/* Header Proyektor */}
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <Link
            href="/gallery"
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-bold text-slate-300 hover:bg-slate-800"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Galeri
          </Link>
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-widest text-amber-300">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              ConnectFrame • GSJA El Shaddai Batu Kajang
            </div>
            <h1 className="text-xl font-black tracking-tight text-white sm:text-2xl">
              Natal: Terang Dalam Kegelapan
            </h1>
          </div>
        </div>

        <button
          type="button"
          onClick={toggleFullscreen}
          className="inline-flex min-h-[42px] items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-bold text-slate-200 hover:bg-slate-800"
        >
          {isFullscreen ? (
            <>
              <Minimize2 className="h-4 w-4" aria-hidden="true" />
              Keluar Layar Penuh
            </>
          ) : (
            <>
              <Maximize2 className="h-4 w-4" aria-hidden="true" />
              Layar Penuh Proyektor
            </>
          )}
        </button>
      </header>

      {/* Grid Foto Terbaru */}
      {photos.length === 0 ? (
        <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
          <p className="text-2xl font-extrabold text-amber-200">
            Menunggu Foto Pertama Jemaat...
          </p>
          <p className="mt-2 text-sm text-slate-400">
            Scan QR Code photobooth lalu kirim fotomu ke Galeri Bersama untuk tampil di layar ini!
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {photos.map((photo) => (
            <div
              key={photo.id}
              className="flex flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 p-2 shadow-lg"
            >
              <div className="aspect-[9/16] w-full overflow-hidden rounded-xl bg-slate-950">
                <img
                  src={photo.imageUrl}
                  alt={photo.senderName || "Foto Jemaat"}
                  className="h-full w-full object-cover"
                />
              </div>
              <p className="mt-2 truncate px-1 text-center text-xs font-bold text-amber-100">
                {photo.senderName || "Jemaat GSJA"}
              </p>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
