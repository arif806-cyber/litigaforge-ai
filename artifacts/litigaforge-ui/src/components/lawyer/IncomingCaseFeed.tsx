import { useState, useRef, useEffect } from "react";
import LawyerFunnelStepper from "./LawyerFunnelStepper";
import { ClientPresenceBadge } from "./ClientPresenceBadge";
import { ResponseTimerBadge } from "./ResponseTimerBadge";

export interface CaseFeedItem {
  id: number;
  case_requirement_id: number;
  category: string;
  created_at: string;
  title: string;
  description: string;
  location?: string;
  budget: string;
  funnelIndex?: number;
  clientIsOnline?: boolean;
}

interface IncomingCaseFeedProps {
  cases: CaseFeedItem[];
  onAccept: (id: number) => void;
  onDecline: (id: number) => void;
  onView?: (item: CaseFeedItem) => void;
}

function EmptyState() {
  return (
    <div className="text-center text-gray-400 py-12 text-sm">
      No new client requests right now — check back soon.
    </div>
  );
}

export default function IncomingCaseFeed({
  cases,
  onAccept,
  onDecline,
  onView,
}: IncomingCaseFeedProps) {
  const [index, setIndex] = useState(0);
  const [dragX, setDragX] = useState(0);
  const startX = useRef(0);
  const dragging = useRef(false);

  const current = cases[index];

  useEffect(() => {
    if (current) onView?.(current);
  }, [index, current?.id]);

  if (!current) return <EmptyState />;

  const handleStart = (e: React.MouseEvent | React.TouchEvent) => {
    dragging.current = true;
    startX.current = "touches" in e ? e.touches[0].clientX : e.clientX;
  };

  const handleMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!dragging.current) return;
    const x = "touches" in e ? e.touches[0].clientX : e.clientX;
    setDragX(x - startX.current);
  };

  const handleEnd = () => {
    dragging.current = false;
    if (dragX > 100) { onAccept(current.id); advance(); }
    else if (dragX < -100) { onDecline(current.id); advance(); }
    setDragX(0);
  };

  const advance = () => setIndex((i) => i + 1);

  const rotation = dragX / 20;
  const bgTint =
    dragX > 50 ? "bg-green-50" : dragX < -50 ? "bg-red-50" : "bg-white";

  return (
    <div className="relative" style={{ height: "auto", minHeight: "340px" }}>
      <div
        data-testid="incoming-case-feed-card"
        className={`rounded-2xl shadow-lg p-4 ${bgTint} transition-colors border border-border select-none`}
        style={{
          transform: `translateX(${dragX}px) rotate(${rotation}deg)`,
          touchAction: "none",
          cursor: "grab",
        }}
        onMouseDown={handleStart}
        onMouseMove={handleMove}
        onMouseUp={handleEnd}
        onMouseLeave={() => { if (dragging.current) handleEnd(); }}
        onTouchStart={handleStart}
        onTouchMove={handleMove}
        onTouchEnd={handleEnd}
      >
        <div className="flex justify-between items-start mb-2">
          <span className="text-xs font-semibold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
            {current.category}
          </span>
          <ResponseTimerBadge requestedAt={current.created_at} />
        </div>

        <h3 className="font-bold text-base mb-1 text-gray-900">{current.title}</h3>
        <p className="text-sm text-gray-600 line-clamp-3">{current.description}</p>

        <div className="flex gap-3 mt-3 text-xs text-gray-500 flex-wrap">
          {current.location && <span>📍 {current.location}</span>}
          {current.budget && <span>💰 {current.budget}</span>}
        </div>

        <ClientPresenceBadge isOnline={current.clientIsOnline ?? false} />

        <div className="mt-3">
          <LawyerFunnelStepper currentIndex={current.funnelIndex ?? 0} />
          <div className="flex justify-between mt-1 text-[10px] text-gray-400">
            <span>Case Viewed</span>
            <span>Hired</span>
          </div>
        </div>

        {dragX > 50 && (
          <div className="absolute top-4 right-4 text-green-600 font-bold text-lg rotate-12 pointer-events-none">
            ACCEPT
          </div>
        )}
        {dragX < -50 && (
          <div className="absolute top-4 left-4 text-red-600 font-bold text-lg -rotate-12 pointer-events-none">
            PASS
          </div>
        )}
      </div>

      <div className="flex justify-center gap-4 mt-4">
        <button
          data-testid="feed-decline-btn"
          onClick={() => { onDecline(current.id); advance(); }}
          className="w-12 h-12 rounded-full bg-red-100 text-red-600 text-xl hover:bg-red-200 transition-colors flex items-center justify-center"
          aria-label="Pass"
        >
          ✕
        </button>
        <div className="flex items-center gap-1 text-xs text-gray-400">
          {index + 1} / {cases.length}
        </div>
        <button
          data-testid="feed-accept-btn"
          onClick={() => { onAccept(current.id); advance(); }}
          className="w-12 h-12 rounded-full bg-green-100 text-green-600 text-xl hover:bg-green-200 transition-colors flex items-center justify-center"
          aria-label="Accept"
        >
          ✓
        </button>
      </div>
    </div>
  );
}
