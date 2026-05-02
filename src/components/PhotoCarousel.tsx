import { useState, useRef, useEffect } from 'react';

interface Props {
  photos: string[];
  alt: string;
  aspect?: string;
}

export function PhotoCarousel({ photos, alt, aspect = 'aspect-[16/10]' }: Props) {
  const [idx, setIdx] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const startIdx = useRef(0);
  const touching = useRef(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const onTouchStart = () => {
      touching.current = true;
      startIdx.current = Math.round(el.scrollLeft / el.clientWidth);
    };

    const onTouchEnd = () => {
      touching.current = false;
    };

    const onScroll = () => {
      const w = el.clientWidth;
      if (!w) return;

      if (touching.current) {
        // Clamp scroll to ±1 photo from where the touch started
        const minScroll = Math.max(0, (startIdx.current - 1) * w);
        const maxScroll = Math.min((photos.length - 1) * w, (startIdx.current + 1) * w);
        if (el.scrollLeft < minScroll) el.scrollLeft = minScroll;
        else if (el.scrollLeft > maxScroll) el.scrollLeft = maxScroll;
      }

      setIdx(Math.round(el.scrollLeft / w));
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    el.addEventListener('touchcancel', onTouchEnd, { passive: true });
    el.addEventListener('scroll', onScroll, { passive: false });

    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', onTouchEnd);
      el.removeEventListener('scroll', onScroll);
    };
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

  const scrollTo = (i: number, e?: React.MouseEvent) => {
    e?.stopPropagation();
    startIdx.current = i; // update so clamp doesn't fight the programmatic scroll
    scrollRef.current?.scrollTo({ left: i * (scrollRef.current?.clientWidth || 0), behavior: 'smooth' });
  };

  const prevIdx = idx > 0 ? idx - 1 : photos.length - 1;
  const nextIdx = idx < photos.length - 1 ? idx + 1 : 0;

  return (
    <div className="relative group">
      <div
        ref={scrollRef}
        className="flex overflow-x-auto snap-x snap-mandatory no-scrollbar"
      >
        {photos.map((url, i) => (
          <div
            key={i}
            className={`snap-center shrink-0 w-full ${aspect} bg-gray-100`}
            style={{ scrollSnapStop: 'always' }}
          >
            {Math.abs(i - idx) <= 1 || i === 0 ? (
              <img
                src={url}
                alt={`${alt} ${i + 1}`}
                className="w-full h-full object-cover"
                loading={i === 0 ? 'eager' : 'lazy'}
              />
            ) : (
              <div className="w-full h-full" />
            )}
          </div>
        ))}
      </div>

      <button
        onClick={(e) => scrollTo(prevIdx, e)}
        className="hidden sm:flex absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 text-white items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/60"
      >
        ‹
      </button>
      <button
        onClick={(e) => scrollTo(nextIdx, e)}
        className="hidden sm:flex absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 text-white items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/60"
      >
        ›
      </button>

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
