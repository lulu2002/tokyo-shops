import { useState, useRef, useCallback } from 'react';

interface Props {
  photos: string[];
  alt: string;
  aspect?: string;
  mode?: 'full' | 'card';
}

export function PhotoCarousel({ photos, alt, aspect = 'aspect-[16/10]', mode = 'full' }: Props) {
  const [idx, setIdx] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollTo = useCallback((i: number) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' });
    setIdx(i);
  }, []);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setIdx(Math.round(el.scrollLeft / el.clientWidth));
  };

  const prevIdx = idx > 0 ? idx - 1 : photos.length - 1;
  const nextIdx = idx < photos.length - 1 ? idx + 1 : 0;

  if (photos.length === 0) {
    return (
      <div className={`${aspect} bg-gray-100 flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-200`}>
        <span className="text-6xl opacity-30">🏪</span>
      </div>
    );
  }

  if (photos.length === 1) {
    return (
      <div className={`${aspect} bg-gray-100 overflow-hidden`}>
        <img src={photos[0]} alt={alt} loading="lazy" className="w-full h-full object-cover" />
      </div>
    );
  }

  return (
    <div className="relative group">
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex overflow-x-auto snap-x snap-mandatory no-scrollbar"
      >
        {photos.map((url, i) => (
          <div key={i} className={`snap-center shrink-0 w-full ${aspect} bg-gray-100`}>
            {/* Only load current + neighbors, placeholder for the rest */}
            {i === idx || i === prevIdx || i === nextIdx ? (
              <img
                src={url}
                alt={`${alt} ${i + 1}`}
                className="w-full h-full object-cover"
                loading={i === idx ? 'eager' : 'lazy'}
              />
            ) : (
              <div className="w-full h-full" />
            )}
          </div>
        ))}
      </div>

      {/* Desktop arrows */}
      <button
        onClick={(e) => { e.stopPropagation(); scrollTo(prevIdx); }}
        className="hidden sm:flex absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 text-white items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/60"
      >
        ‹
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); scrollTo(nextIdx); }}
        className="hidden sm:flex absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 text-white items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/60"
      >
        ›
      </button>

      {/* Dots */}
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
        {photos.map((_, i) => (
          <span
            key={i}
            className={`w-1.5 h-1.5 rounded-full transition-colors ${
              i === idx ? 'bg-white' : 'bg-white/40'
            }`}
          />
        ))}
      </div>
    </div>
  );
}
