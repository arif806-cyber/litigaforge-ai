import { Scale, Menu } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

interface PageHeaderProps {
  onMenuClick: () => void;
}

export function PageHeader({ onMenuClick }: PageHeaderProps) {
  const { user } = useAuth();

  return (
    <header className="md:hidden flex-shrink-0 border-b border-border bg-card z-20 flex items-center justify-between px-4 h-14" style={{ boxShadow: "var(--cfos-elev-1)" }}>
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
          <Scale className="w-4 h-4 text-primary" />
        </div>
        <div>
          <span className="font-bold text-sm tracking-tight">LitigaForge</span>
          {user && (
            <span className="ml-2 px-1.5 py-0.5 rounded bg-accent/20 text-[9px] font-bold text-accent-foreground uppercase tracking-wide">
              {user.role === "lawyer" ? "Advocate" : "Client"}
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={onMenuClick}
          className="flex items-center justify-center w-10 h-10 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors active:scale-95"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>
      </div>
    </header>
  );
}
