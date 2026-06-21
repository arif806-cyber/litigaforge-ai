import { Lock, MessageSquare } from "lucide-react";
import { Link } from "wouter";

interface MatchShape {
  id: number;
  lawyer_id: number;
  lawyer_name: string;
  district?: string;
  experience_years?: number;
  rating?: number;
  hourly_rate?: number;
  match_score: number;
  ai_explanation?: string;
  client_message?: string;
  status: string;
  case_requirement_id?: number;
}

interface LawyerMatchCardProps {
  match: MatchShape;
  isReviewing?: boolean;
  onAccept: (match: MatchShape) => void;
  onDecline: (id: number) => void;
  /** data-testid prefix for E2E tests */
  testIdPrefix?: string;
}

function MatchRing({ score }: { score: number }) {
  const radius       = 22;
  const circumference = 2 * Math.PI * radius;
  const offset       = circumference - (score / 100) * circumference;
  const color =
    score >= 80 ? "#22c55e" :
    score >= 60 ? "#f59e0b" : "#ef4444";

  return (
    <div className="relative w-14 h-14 flex-shrink-0">
      <svg width="56" height="56" className="-rotate-90" aria-hidden="true">
        <circle cx="28" cy="28" r={radius} stroke="#e5e7eb" strokeWidth="4" fill="none" />
        <circle
          cx="28" cy="28" r={radius}
          stroke={color} strokeWidth="4" fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.6s ease" }}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold select-none">
        {score}%
      </span>
    </div>
  );
}

function LawyerAvatar({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase()
    .slice(0, 2);
  return (
    <div className="w-10 h-10 rounded-full bg-sidebar flex items-center justify-center flex-shrink-0 border border-border">
      <span className="text-xs font-bold text-sidebar-foreground">{initials}</span>
    </div>
  );
}

export function LawyerMatchCard({
  match,
  isReviewing = false,
  onAccept,
  onDecline,
  testIdPrefix = "lawyer-match-card",
}: LawyerMatchCardProps) {
  const isPending  = match.status === "pending";
  const isAccepted = match.status === "accepted";

  return (
    <div
      data-testid={`${testIdPrefix}-${match.id}`}
      className="flex items-center gap-3 p-3 bg-card rounded-xl shadow-sm border border-border hover:border-primary/20 hover:shadow-md transition-all"
    >
      <MatchRing score={match.match_score} />

      <LawyerAvatar name={match.lawyer_name} />

      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm text-foreground truncate">{match.lawyer_name}</p>

        <p className="text-xs text-muted-foreground truncate">
          {[match.district, match.experience_years != null && `${match.experience_years}yr exp`]
            .filter(Boolean)
            .join(" · ")}
        </p>

        {match.hourly_rate && (
          <p className="text-xs text-amber-600 mt-0.5 font-medium">
            ₹{match.hourly_rate.toLocaleString("en-IN")}/hr
            {match.rating != null && match.rating > 0 && (
              <span className="ml-2 text-amber-500">★ {match.rating}</span>
            )}
          </p>
        )}

        {match.ai_explanation && (
          <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
            {match.ai_explanation}
          </p>
        )}

        {match.client_message && (
          <div className="mt-1.5 rounded-lg px-2.5 py-1.5 text-[11px] bg-muted border border-border text-muted-foreground">
            <span className="font-semibold text-foreground">Lawyer: </span>
            {match.client_message}
          </div>
        )}

        {isReviewing && (
          <div className="flex items-center gap-1.5 mt-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" />
            <span className="text-[11px] text-emerald-600 font-medium">
              Reviewing your case now…
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-1.5 flex-shrink-0">
        {isPending && (
          <>
            <button
              data-testid={`${testIdPrefix}-accept-${match.id}`}
              onClick={() => onAccept(match)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white active:scale-95 transition-all whitespace-nowrap"
            >
              <Lock className="w-3 h-3" /> Request
            </button>
            <button
              data-testid={`${testIdPrefix}-decline-${match.id}`}
              onClick={() => onDecline(match.id)}
              className="px-3 py-1.5 rounded-full text-xs font-semibold bg-muted hover:bg-muted/80 text-muted-foreground transition-colors whitespace-nowrap"
            >
              Pass
            </button>
          </>
        )}

        {isAccepted && (
          <Link href={`/legal-chat`}>
            <button
              data-testid={`${testIdPrefix}-chat-${match.id}`}
              className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white transition-colors whitespace-nowrap"
            >
              <MessageSquare className="w-3 h-3" /> Chat
            </button>
          </Link>
        )}

        {match.status === "declined" && (
          <span className="px-3 py-1.5 rounded-full text-xs font-semibold bg-muted text-muted-foreground whitespace-nowrap">
            Passed
          </span>
        )}
      </div>
    </div>
  );
}

export default LawyerMatchCard;
