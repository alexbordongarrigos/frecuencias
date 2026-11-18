import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

export interface BreakpointColumns {
  base: number;
  sm?: number;
  md?: number;
  lg?: number;
  xl?: number;
}

interface AdaptiveParticleGridProps<T> {
  items: T[];
  getItemKey: (item: T, index: number) => string;
  renderItem: (item: T, index: number) => React.ReactNode;
  columnsConfig?: BreakpointColumns;
  gapPx?: number;
  className?: string;
}

function resolveColumnsForWidth(width: number, cfg: BreakpointColumns): number {
  let cols = cfg.base;
  if (width >= 640 && cfg.sm !== undefined) cols = cfg.sm;
  if (width >= 768 && cfg.md !== undefined) cols = cfg.md;
  if (width >= 1024 && cfg.lg !== undefined) cols = cfg.lg;
  if (width >= 1280 && cfg.xl !== undefined) cols = cfg.xl;
  return Math.max(1, cols);
}

const DEFAULT_ESTIMATED_HEIGHT = 340;

/**
 * Self-balancing adaptive masonry grid with shortest-column packing and FLIP motion:
 * expanding one card never stretches neighboring cards in adjacent columns and
 * causes subsequent particles to dynamically redistribute into the shorter columns.
 */
function AdaptiveParticleGrid<T>({
  items,
  getItemKey,
  renderItem,
  columnsConfig = { base: 1, md: 2, xl: 3 },
  gapPx = 20,
  className = '',
}: AdaptiveParticleGridProps<T>) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const heightsRef = useRef<Record<string, number>>({});
  const lastRelPosRef = useRef<Record<string, { left: number; top: number }>>({});
  const prevColumnCountRef = useRef<number>(1);
  const rafMeasureRef = useRef<number | null>(null);
  const observerRef = useRef<ResizeObserver | null>(null);
  const getItemKeyRef = useRef(getItemKey);
  getItemKeyRef.current = getItemKey;

  const [columnCount, setColumnCount] = useState<number>(() =>
    typeof window !== 'undefined' ? resolveColumnsForWidth(window.innerWidth, columnsConfig) : columnsConfig.base
  );
  const [measureVersion, setMeasureVersion] = useState(0);

  // Sync responsive column count on resize
  useEffect(() => {
    const updateCols = () => {
      if (typeof window === 'undefined') return;
      const next = resolveColumnsForWidth(window.innerWidth, columnsConfig);
      setColumnCount(prev => (prev === next ? prev : next));
    };
    updateCols();
    window.addEventListener('resize', updateCols);
    return () => window.removeEventListener('resize', updateCols);
  }, [
    columnsConfig.base,
    columnsConfig.sm,
    columnsConfig.md,
    columnsConfig.lg,
    columnsConfig.xl,
  ]);

  // Shared ResizeObserver reading un-transformed offsetHeight to prevent feedback loops
  useEffect(() => {
    if (typeof ResizeObserver === 'undefined') return;

    const ro = new ResizeObserver(entries => {
      let changed = false;
      for (let i = 0; i < entries.length; i++) {
        const el = entries[i].target as HTMLElement;
        const key = el.dataset.gridKey;
        if (!key) continue;
        const nextH = el.offsetHeight;
        if (nextH <= 0) continue;
        const prevH = heightsRef.current[key];
        if (prevH === undefined || Math.abs(nextH - prevH) > 2) {
          heightsRef.current[key] = nextH;
          changed = true;
        }
      }

      if (changed && rafMeasureRef.current === null) {
        rafMeasureRef.current = requestAnimationFrame(() => {
          rafMeasureRef.current = null;
          setMeasureVersion(v => v + 1);
        });
      }
    });

    observerRef.current = ro;

    if (containerRef.current) {
      const nodes = containerRef.current.querySelectorAll<HTMLElement>('[data-grid-key]');
      nodes.forEach(node => ro.observe(node));
    }

    return () => {
      if (rafMeasureRef.current !== null) {
        cancelAnimationFrame(rafMeasureRef.current);
        rafMeasureRef.current = null;
      }
      ro.disconnect();
      observerRef.current = null;
    };
  }, []);

  // Re-attach observer whenever items or columns re-render & prune removed keys
  const keyedItems = useMemo(
    () => items.map((item, index) => ({ item, index, key: getItemKeyRef.current(item, index) })),
    [items]
  );

  useEffect(() => {
    const activeKeys = new Set(keyedItems.map(k => k.key));
    for (const key of Object.keys(heightsRef.current)) {
      if (!activeKeys.has(key)) delete heightsRef.current[key];
    }
    for (const key of Object.keys(lastRelPosRef.current)) {
      if (!activeKeys.has(key)) delete lastRelPosRef.current[key];
    }

    const ro = observerRef.current;
    const container = containerRef.current;
    if (!ro || !container) return;

    const nodes = container.querySelectorAll<HTMLElement>('[data-grid-key]');
    nodes.forEach(node => ro.observe(node));
  }, [keyedItems, columnCount]);

  // Shortest-column greedy packing
  const columns = useMemo(() => {
    const count = Math.max(1, columnCount);
    const cols: {
      items: { item: T; index: number; key: string }[];
      totalHeight: number;
    }[] = Array.from({ length: count }, () => ({ items: [], totalHeight: 0 }));

    for (let i = 0; i < keyedItems.length; i++) {
      const entry = keyedItems[i];
      let shortestIdx = 0;
      let shortestHeight = cols[0].totalHeight;
      for (let c = 1; c < count; c++) {
        if (cols[c].totalHeight < shortestHeight - 1) {
          shortestHeight = cols[c].totalHeight;
          shortestIdx = c;
        }
      }
      cols[shortestIdx].items.push(entry);
      const measured = heightsRef.current[entry.key] ?? DEFAULT_ESTIMATED_HEIGHT;
      cols[shortestIdx].totalHeight += measured + gapPx;
    }

    return cols;
  }, [keyedItems, columnCount, gapPx, measureVersion]);

  // Smooth FLIP transitions relative to container when surrounding items reflow
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const colChanged = prevColumnCountRef.current !== columnCount;
    prevColumnCountRef.current = columnCount;

    const containerRect = container.getBoundingClientRect();
    const nodes = container.querySelectorAll<HTMLElement>('[data-grid-key]');
    const nextPositions: Record<string, { left: number; top: number }> = {};
    const movedEls: { el: HTMLElement; dx: number; dy: number }[] = [];

    nodes.forEach(el => {
      const key = el.dataset.gridKey;
      if (!key) return;

      // Clear any previous transient transform before measuring committed layout position
      if (el.style.transform && el.style.transform !== 'none') {
        el.style.transition = 'none';
        el.style.transform = 'none';
      }

      const rect = el.getBoundingClientRect();
      const relLeft = rect.left - containerRect.left;
      const relTop = rect.top - containerRect.top;
      nextPositions[key] = { left: relLeft, top: relTop };

      const prev = lastRelPosRef.current[key];
      if (!colChanged && prev) {
        const dx = prev.left - relLeft;
        const dy = prev.top - relTop;
        if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
          movedEls.push({ el, dx, dy });
        }
      }
    });

    if (movedEls.length > 0) {
      for (let i = 0; i < movedEls.length; i++) {
        const { el, dx, dy } = movedEls[i];
        el.style.willChange = 'transform';
        el.style.transition = 'none';
        el.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
      }

      // Single synchronous layout flush across moved nodes
      void container.offsetHeight;

      requestAnimationFrame(() => {
        for (let i = 0; i < movedEls.length; i++) {
          const { el } = movedEls[i];
          el.style.transition = 'transform 380ms cubic-bezier(0.22, 1, 0.36, 1)';
          el.style.transform = 'translate3d(0, 0, 0)';
        }
      });

      setTimeout(() => {
        for (let i = 0; i < movedEls.length; i++) {
          movedEls[i].el.style.willChange = 'auto';
        }
      }, 420);
    }

    lastRelPosRef.current = nextPositions;
  }, [columns, columnCount]);

  return (
    <div
      ref={containerRef}
      className={`flex items-start w-full ${className}`}
      style={{ gap: `${gapPx}px` }}
    >
      {columns.map((col, colIdx) => (
        <div
          key={colIdx}
          className="flex-1 min-w-0 flex flex-col"
          style={{ gap: `${gapPx}px` }}
        >
          {col.items.map(entry => (
            <div
              key={entry.key}
              data-grid-key={entry.key}
              className="w-full h-fit"
              style={{ contain: 'layout style' }}
            >
              {renderItem(entry.item, entry.index)}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export default AdaptiveParticleGrid;
