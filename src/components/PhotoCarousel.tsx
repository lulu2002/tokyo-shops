import { useState, useRef, useCallback } from 'react';

interface Props {
  photos: string[];
  alt: string;
  aspect?: string;
  mode?: 'full' | 'card';
}

export function PhotoCarousel({ photos, alt, aspect = 'aspect-[16/10]', mode = 'full' }: Props) {
  const [idx, setIdx] = useState(0);

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

  if (mode === 'card') {
    return <CardCarousel photos={photos} alt={alt} aspect={aspect} idx={idx} setIdx={setIdx} />;
  }

  return <FullCarousel photos={photos} alt={alt} aspect={aspect} idx={idx} setIdx={setIdx} />;
}

// Card mode: transform-based with smooth animation + touch drag
function CardCarousel({ photos, alt, aspect, idx, setIdx }: {
  photos: string[]; alt: string; aspect: string;
  idx: number; setIdx: (i: number) => void;
}) {
  const [dragOffset, setDragOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const lockRef = useRef(false);
  const touchRef = useRef<{ startX: number; startY: number; decided: boolean; isHorizontal: boolean } | null>(null);

  const prevIdx = idx > 0 ? idx - 1 : photos.length - 1;
  const nextIdx = idx < photos.length - 1 ? idx + 1 : 0;

  const goTo = useCallback((i: number) => {
    setIdx(i);
    setDragOffset(0);
    lockRef.current = true;
    setTimeout(() => { lockRef.current = false; }, 320);
  }, [setIdx]);

  const onTouchStart = (e: React.TouchEvent) => {
    if (lockRef.current) return;
    touchRef.current = {
      startX: e.touches[0].clientX,
      startY: e.touches[0].clientY,
      decided: false,
      isHorizontal: false,
    };
    setDragging(true);
    setDragOffset(0);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    const t = touchRef.current;
    if (!t || lockRef.current) return;
    const dx = e.touches[0].clientX - t.startX;
    const dy = e.touches[0].clientY - t.startY;

    if (!t.decided) {
      if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
        t.decided = true;
        t.isHorizontal = Math.abs(dx) > Math.abs(dy);
      }
      return;
    }

    if (!t.isHorizontal) return;

    // Clamp drag to 60% of container width
    const w = containerRef.current?.clientWidth || 300;
    const maxDrag = w * 0.6;
    let offset = Math.max(-maxDrag, Math.min(maxDrag, dx));
    if ((idx === 0 && offset > 0) || (idx === photos.length - 1 && offset < 0)) {
      offset = offset * 0.2;
    }
    setDragOffset(offset);
  };

  const onTouchEnd = () => {
    const t = touchRef.current;
    if (!t) return;

    const w = containerRef.current?.clientWidth || 300;
    if (t.isHorizontal && Math.abs(dragOffset) > w * 0.15) {
      if (dragOffset < 0 && idx < photos.length - 1) goTo(idx + 1);
      else if (dragOffset > 0 && idx > 0) goTo(idx - 1);
      else setDragOffset(0);
    } else {
      setDragOffset(0);
    }

    setDragging(false);
    touchRef.current = null;
  };

  const w = containerRef.current?.clientWidth || 1;
  const dragPercent = (dragOffset / w) * 100;
  const translateX = -(idx * 100) + dragPercent;

  return (
    <div className="relative group">
      <div
        ref={containerRef}
        className={`${aspect} overflow-hidden`}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div
          className="flex h-full"
          style={{
            transform: `translateX(${translateX}%)`,
            transition: dragging ? 'none' : 'transform 300ms cubic-bezier(0.25, 1, 0.5, 1)',
            width: `${photos.length * 100}%`,
          }}
        >
          {photos.map((url, i) => (
            <div key={i} className="h-full bg-gray-100" style={{ width: `${100 / photos.length}%` }}>
              {i === idx || i === prevIdx || i === nextIdx ? (
                <img
                  src={url}
                  alt={`${alt} ${i + 1}`}
                  className="w-full h-full object-cover"
                  loading={i === idx ? 'eager' : 'lazy'}
                  draggable={false}
                />
              ) : (
                <div className="w-full h-full" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Desktop arrows */}
      <button
        onClick={(e) => { e.stopPropagation(); goTo(prevIdx); }}
        className="hidden sm:flex absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 text-white items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/60"
      >
        ‹
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); goTo(nextIdx); }}
        className="hidden sm:flex absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 text-white items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/60"
      >
        ›
      </button>

      <Dots count={photos.length} current={idx} />
    </div>
  );
}

// Full mode: scroll container with snap (for detail modal)
function FullCarousel({ photos, alt, aspect, idx, setIdx }: {
  photos: string[]; alt: string; aspect: string;
  idx: number; setIdx: (i: number) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setIdx(Math.round(el.scrollLeft / el.clientWidth));
  };

  const scrollTo = (i: number) => {
    scrollRef.current?.scrollTo({ left: i * (scrollRef.current?.clientWidth || 0), behavior: 'smooth' });
    setIdx(i);
  };

  const prevIdx = idx > 0 ? idx - 1 : photos.length - 1;
  const nextIdx = idx < photos.length - 1 ? idx + 1 : 0;

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

      <Dots count={photos.length} current={idx} />
    </div>
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
