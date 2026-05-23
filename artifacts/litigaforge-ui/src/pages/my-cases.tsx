import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Link } from "wouter";
import {
  FileText, MapPin, Clock, EyeOff, ArrowRight, Plus,
  Search, Filter, Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";

const STATUS_COLORS: Record<string, string> = {
  open: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  pending: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  closed: "bg-muted text-muted-foreground",
};

export default function MyCases() {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["my-cases"],
    queryFn: () => apiFetch("/cases/requirements/mine"),
    enabled: !!user,
  });

  if (!user) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center space-y-4">
          <FileText className="w-12 h-12 text-muted-foreground mx-auto" />
          <h2 className="text-xl font-semibold">Sign In Required</h2>
          <Button onClick={() => window.location.href = "/login"}>Sign In</Button>
        </div>
      </div>
    );
  }

  const cases = data?.cases ?? [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-4 md:p-8 max-w-5xl mx-auto space-y-6"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">My Legal Requirements</h1>
          <p className="text-muted-foreground mt-1">
            Cases you have posted and proposals received from lawyers.
          </p>
        </div>
        <Link href="/post-case">
          <Button data-testid="new-case-button">
            <Plus className="w-4 h-4 mr-2" />
            Post New Case
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : cases.length === 0 ? (
        <div className="bg-card border border-card-border rounded-xl p-12 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto">
            <FileText className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold">No Cases Posted Yet</h3>
          <p className="text-muted-foreground max-w-md mx-auto">
            Post your first legal requirement to connect with verified lawyers in your area.
          </p>
          <Link href="/post-case">
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Post a Case
            </Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {cases.map((c: any, i: number) => (
            <motion.div
              key={c.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-card border border-card-border rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-lg">{c.title}</h3>
                    {c.is_anonymous && (
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                        <EyeOff className="w-3 h-3" /> Anonymous
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                    <span className="inline-flex items-center gap-1">
                      <FileText className="w-3.5 h-3.5" />
                      {c.case_type}
                    </span>
                    {c.location && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5" />
                        {c.location}
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {new Date(c.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  {c.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">{c.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className={cn("text-xs font-medium px-2.5 py-1 rounded-full", STATUS_COLORS[c.status] || STATUS_COLORS.open)}>
                    {c.status?.toUpperCase()}
                  </span>
                  <Link href={`/matches?case=${c.id}`}>
                    <Button variant="outline" size="sm">
                      Find Lawyers
                      <ArrowRight className="w-3.5 h-3.5 ml-1" />
                    </Button>
                  </Link>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
