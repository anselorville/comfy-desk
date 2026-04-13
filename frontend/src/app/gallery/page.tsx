"use client";

import { useEffect, useState } from "react";
import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";

interface GalleryImage {
  src: string;
  name: string;
}

export default function GalleryPage() {
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [index, setIndex] = useState(-1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/gallery")
      .then((r) => r.json())
      .then((data) => setImages(data.images ?? []))
      .catch(() => setImages([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-br from-slate-800 to-slate-500">
          生成画廊
        </h1>
        <span className="text-sm font-medium text-slate-500">
          {images.length} 张图片
        </span>
      </div>

      {loading ? (
        <div className="text-center py-16 text-slate-500">加载中...</div>
      ) : images.length === 0 ? (
        <div className="text-center py-20 text-slate-500 border-2 border-dashed border-slate-200 rounded-2xl">
          <p className="text-5xl mb-4">▦</p>
          <p className="m-0">还没有生成任何图片</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {images.map((img, idx) => (
            <div
              key={idx}
              id={`gallery-img-${idx}`}
              onClick={() => setIndex(idx)}
              className="group relative rounded-xl overflow-hidden border border-slate-200 cursor-pointer shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300"
            >
              <img
                src={img.src}
                alt={img.name}
                className="w-full aspect-square object-cover block"
              />
            </div>
          ))}
        </div>
      )}

      {/* Lightbox Component */}
      <Lightbox
        open={index >= 0}
        close={() => setIndex(-1)}
        index={index}
        slides={images.map(img => ({ src: img.src }))}
      />
    </div>
  );
}
