import { useState, useRef, useCallback } from 'react';

interface Props {
  photos: string[];
  alt: string;
  aspect?: string;
  mode?: 'full' | 'light';
}

export function PhotoCarousel({ photos, alt, aspect = 'aspect-[16/10]', mode = 'full' }: Props) {
  const [idx, setIdx] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const prev = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    setIdx((i) => (i > 0 ? i - 1 : photos.length - 1));
  }, [photos.length]);

  const next = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    setIdx((i) => (i < photos.length - 1 ? i + 1 : 0));
  }, [photos.length]);

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

  // Light mode: single <img>, swap src on arrow click (for cards - minimal DOM)
  if (mode === 'light') {
    return (
      <div className="relative group">
        <div className={`${aspect} bg-gray-100 overflow-hidden`}>
          <img
            src={photos[idx]}
            alt={`${alt} ${idx + 1}`}
            loading="lazy"
            className="w-full h-full object-cover"
          />
        </div>
        <Arrows onPrev={prev} onNext={next} />
        <Dots count={photos.length} current={idx} />
      </div>
    );
  }

  // Full mode: scroll container with snap (for detail modal - smooth swipe)
  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setIdx(Math.round(el.scrollLeft / el.clientWidth));
  };

  const scrollTo = (i: number) => {
    scrollRef.current?.scrollTo({ left: i * (scrollRef.current?.clientWidth || 0), behavior: 'smooth' });
    setIdx(i);
  };

  return (
    <div className="relative group">
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex overflow-x-auto snap-x snap-mandatory no-scrollbar"
      >
        {photos.map((url, i) => (
          <div key={i} className={`snap-center shrink-0 w-full ${aspect} bg-gray-100`}>
            <img
              src={url}
              alt={`${alt} ${i + 1}`}
              className="w-full h-full object-cover"
              loading={i === 0 ? 'eager' : 'lazy'}
            />
          </div>
        ))}
      </div>
      <Arrows
        onPrev={(e) => { e?.stopPropagation(); scrollTo(idx > 0 ? idx - 1 : photos.length - 1); }}
        onNext={(e) => { e?.stopPropagation(); scrollTo(idx < photos.length - 1 ? idx + 1 : 0); }}
      />
      <Dots count={photos.length} current={idx} />
    </div>
  );
}

function Arrows({ onPrev, onNext }: { onPrev: (e?: React.MouseEvent) => void; onNext: (e?: React.MouseEvent) => void }) {
  return (
    <>
      <button
        onClick={onPrev}
        className="hidden sm:flex absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 text-white items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/60"
      >
        ‹
      </button>
      <button
        onClick={onNext}
        className="hidden sm:flex absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 text-white items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/60"
      >
        ›
      </button>
    </>
  );
}

function Dots({ count, current }: { count: number; current: number }) {
  return (
    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          className={`w-1.5 h-1.5 rounded-full transition-colors ${
            i === current ? 'bg-white' : 'bg-white/40'
          }`}
        />
      ))}
    </div>
  );
}
