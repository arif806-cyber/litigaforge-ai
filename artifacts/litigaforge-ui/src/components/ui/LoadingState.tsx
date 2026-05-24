import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface LoadingStateProps {
  message?: string;
  subMessage?: string;
  className?: string;
  size?: "sm" | "md" | "lg";
  inline?: boolean;
}

export function LoadingState({
  message,
  subMessage,
  className,
  size = "md",
  inline = false,
}: LoadingStateProps) {
  const sizes = {
    sm: { spinner: "w-4 h-4", wrapper: "py-4" },
    md: { spinner: "w-8 h-8", wrapper: "py-8" },
    lg: { spinner: "w-10 h-10", wrapper: "py-16" },
  };
  const s = sizes[size];

  const content = (
    <div className={cn("flex flex-col items-center justify-center gap-3", !inline && s.wrapper)}>
      <div className="relative">
        <Loader2 className={cn(s.spinner, "animate-spin text-primary")} />
        <div className="absolute inset-0 bg-primary/20 blur-lg rounded-full animate-pulse-glow" />
      </div>
      {message && (
        <p className="text-sm font-medium text-foreground tracking-tight">{message}</p>
      )}
      {subMessage && (
        <p className="text-xs text-muted-foreground">{subMessage}</p>
      )}
    </div>
  );

  if (inline) return content;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={cn("flex-1 flex items-center justify-center", className)}
    >
      {content}
    </motion.div>
  );
}
