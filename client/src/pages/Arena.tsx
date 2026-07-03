import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronUp, ChevronDown } from "lucide-react";
import { api } from "../lib/api";
import { getSocket } from "../lib/socket";
import type { PaginatedSamples, SampleSummary } from "../lib/types";
import { ReelSlide } from "../components/ReelSlide";

const PAGE_SIZE = 20;

export function Arena() {
  const [samples, setSamples] = useState<SampleSummary[]>([]);
  const [genre, setGenre] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [soundOn, setSoundOn] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const slideRefs = useRef(new Map<string, HTMLDivElement>());

  // Load a specific page and merge results into the samples list.
  const loadPage = useCallback(async (pageNum: number) => {
    const res = await api.get<PaginatedSamples>(
      `/samples?status=live&page=${pageNum}&limit=${PAGE_SIZE}`
    );
    return res;
  }, []);

  useEffect(() => {
    loadPage(1)
      .then((res) => {
        const sorted = [...res.samples].sort((a, b) => new Date(a.endTime).getTime() - new Date(b.endTime).getTime());
        setSamples(sorted);
        setHasMore(res.hasMore);
        setPage(1);
        if (sorted.length > 0) setActiveId(sorted[0].id);
      })
      .finally(() => setLoading(false));
  }, [loadPage]);

  async function loadMore() {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const res = await loadPage(nextPage);
      setSamples((prev) => {
        const existingIds = new Set(prev.map((s) => s.id));
        const newSamples = res.samples.filter((s) => !existingIds.has(s.id));
        // Keep the overall list sorted by endTime.
        const merged = [...prev, ...newSamples].sort(
          (a, b) => new Date(a.endTime).getTime() - new Date(b.endTime).getTime()
        );
        return merged;
      });
      setHasMore(res.hasMore);
      setPage(nextPage);
    } finally {
      setLoadingMore(false);
    }
  }

  async function refreshSample(id: string) {
    try {
      const res = await api.get<{ sample: SampleSummary }>(`/samples/${id}`);
      setSamples((prev) => prev.map((s) => (s.id === id ? res.sample : s)));
    } catch {
      // sample may have been removed; ignore
    }
  }

  useEffect(() => {
    const socket = getSocket();
    const onActivity = (event: { sampleId: string }) => {
      refreshSample(event.sampleId);
    };
    socket.on("activity", onActivity);
    return () => {
      socket.off("activity", onActivity);
    };
  }, []);

  const filtered = useMemo(
    () => (genre === "all" ? samples : samples.filter((s) => s.genre === genre)),
    [samples, genre]
  );
  const genres = useMemo(() => ["all", ...new Set(samples.map((s) => s.genre))], [samples]);
  const activeIndex = useMemo(() => filtered.findIndex((s) => s.id === activeId), [filtered, activeId]);

  // Tracks the slide index we've most recently navigated (or scrolled) to.
  // `activeIndex` only updates once the IntersectionObserver confirms a scroll
  // has settled near a slide, which lags behind rapid-fire navigation — driving
  // goToSlide off that lagging value let a second fast keypress/wheel-tick read
  // a stale position and land on the wrong slide. This ref is the source of
  // truth for "where we're navigating from," updated synchronously on request.
  const targetIndexRef = useRef(0);
  useEffect(() => {
    if (activeIndex >= 0) targetIndexRef.current = activeIndex;
  }, [activeIndex]);

  // Auto-load next page when the user lands on the last slide.
  useEffect(() => {
    if (hasMore && !loadingMore && filtered.length > 0 && activeIndex === filtered.length - 1) {
      void loadMore();
    }
  }, [activeIndex, filtered.length, hasMore, loadingMore]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
            const id = (entry.target as HTMLElement).dataset.sampleId;
            if (id) setActiveId(id);
          }
        }
      },
      { root: container, threshold: [0.6] }
    );
    slideRefs.current.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [filtered]);

  function goToSlide(direction: 1 | -1) {
    const nextIndex = Math.min(Math.max(targetIndexRef.current + direction, 0), filtered.length - 1);
    if (nextIndex === targetIndexRef.current) return;
    targetIndexRef.current = nextIndex;
    const nextId = filtered[nextIndex]?.id;
    if (nextId) {
      slideRefs.current.get(nextId)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  // Keyboard navigation — arrow/page keys move exactly one slide.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLElement && ["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName)) return;
      if (e.key === "ArrowDown" || e.key === "PageDown") {
        e.preventDefault();
        goToSlide(1);
      } else if (e.key === "ArrowUp" || e.key === "PageUp") {
        e.preventDefault();
        goToSlide(-1);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [filtered]);

  // Desktop mouse/trackpad wheel: advance exactly one slide per scroll gesture
  // instead of free-scrolling through the list — native CSS snap alone tends to
  // let a fast wheel fling coast past several cards before settling. Touch
  // devices don't fire sustained `wheel` events, so mobile swipe is untouched
  // and still handled natively by CSS scroll-snap.
  //
  // cooldownUntil lives in a ref (not a closure-local variable) because this
  // effect re-runs whenever `filtered` changes identity, which — via the
  // IntersectionObserver reacting to the very scroll this handler just
  // triggered — can happen mid-gesture. A closure-local variable would get
  // silently reset to 0 by that re-run, letting a second wheel event through
  // partway into what the user experiences as one continuous fling.
  const wheelCooldownRef = useRef(0);
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    function onWheel(e: WheelEvent) {
      if (Math.abs(e.deltaY) < 10) return;
      e.preventDefault();
      const now = Date.now();
      if (now < wheelCooldownRef.current) {
        wheelCooldownRef.current = now + 550;
        return;
      }
      wheelCooldownRef.current = now + 550;
      goToSlide(e.deltaY > 0 ? 1 : -1);
    }
    container.addEventListener("wheel", onWheel, { passive: false });
    return () => container.removeEventListener("wheel", onWheel);
  }, [filtered]);

  // Settle guard: a smooth scrollIntoView that gets interrupted (re-render,
  // scrollbar drag, competing gesture) can leave the container parked between
  // two slides — CSS snap only re-engages on native scroll gestures, not on an
  // abandoned programmatic scroll. Once scroll events go quiet, nudge the
  // container to the nearest slide boundary so a slide is never shown cut off.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let timer: number | undefined;
    function settle() {
      const h = container!.clientHeight;
      if (!h) return;
      const target = Math.round(container!.scrollTop / h) * h;
      if (Math.abs(container!.scrollTop - target) > 2) {
        container!.scrollTo({ top: target, behavior: "smooth" });
      }
    }
    function onScroll() {
      window.clearTimeout(timer);
      timer = window.setTimeout(settle, 150);
    }
    container.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      container.removeEventListener("scroll", onScroll);
      window.clearTimeout(timer);
    };
  }, [filtered.length]);

  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex justify-center px-4 pt-4">
        <div className="scrollbar-thin pointer-events-auto flex max-w-full gap-2 overflow-x-auto rounded-full border border-border bg-surface/80 px-2 py-1.5 backdrop-blur">
          {genres.map((g) => (
            <button
              key={g}
              onClick={() => setGenre(g)}
              className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium capitalize transition ${
                genre === g ? "bg-primary text-background" : "text-muted hover:text-foreground"
              }`}
            >
              {g === "all" ? "🔥 All" : g}
            </button>
          ))}
        </div>
      </div>

      {activeIndex >= 0 && filtered.length > 0 && (
        <div className="pointer-events-none absolute left-4 top-20 z-30 flex items-center gap-2">
          <div className="rounded-full border border-border bg-surface/80 px-2.5 py-1 text-xs font-medium text-muted backdrop-blur">
            {activeIndex + 1} / {filtered.length}
          </div>
        </div>
      )}

      <div className="hidden flex-col items-center gap-3 lg:fixed lg:right-6 lg:top-1/2 lg:z-30 lg:flex lg:-translate-y-1/2">
        <button
          onClick={() => goToSlide(-1)}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface/80 backdrop-blur transition hover:bg-surface-2 disabled:opacity-30"
          aria-label="Previous"
          disabled={activeIndex <= 0}
        >
          <ChevronUp size={16} />
        </button>
        <div className="flex flex-col gap-1.5">
          {filtered.slice(0, 12).map((s, i) => (
            <span
              key={s.id}
              className={`h-1.5 w-1.5 rounded-full transition ${i === activeIndex ? "bg-primary" : "bg-border"}`}
            />
          ))}
        </div>
        <button
          onClick={() => goToSlide(1)}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface/80 backdrop-blur transition hover:bg-surface-2 disabled:opacity-30"
          aria-label="Next"
          disabled={activeIndex < 0 || activeIndex >= filtered.length - 1}
        >
          <ChevronDown size={16} />
        </button>
      </div>

      {loading ? (
        <p className="flex h-[calc(100dvh-4rem)] items-center justify-center text-sm text-muted">Loading arena…</p>
      ) : filtered.length === 0 ? (
        <div className="flex h-[calc(100dvh-4rem)] items-center justify-center px-4">
          <p className="text-sm text-muted">No live auctions match this filter.</p>
        </div>
      ) : (
        <div
          ref={containerRef}
          className="scrollbar-thin h-[calc(100dvh-4rem)] snap-y snap-mandatory overflow-y-auto overscroll-contain"
        >
          {filtered.map((sample) => (
            <div
              key={sample.id}
              ref={(el) => {
                if (el) slideRefs.current.set(sample.id, el);
                else slideRefs.current.delete(sample.id);
              }}
              data-sample-id={sample.id}
              className="h-full w-full snap-start snap-always"
            >
              <ReelSlide
                sample={sample}
                active={activeId === sample.id}
                soundOn={soundOn}
                onToggleSound={() => setSoundOn((v) => !v)}
              />
            </div>
          ))}
          {loadingMore && (
            <div className="flex h-20 items-center justify-center">
              <p className="text-sm text-muted">Loading more…</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
