import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { EmptyStateArt } from "@/components/graphics/EmptyStateArt";

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: { label: string; onClick: () => void; variant?: "default" | "outline" | "ghost" };
  secondaryAction?: { label: string; onClick: () => void };
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function EmptyState({
  title,
  description,
  icon,
  action,
  secondaryAction,
  className,
  size = "md",
}: EmptyStateProps) {
  const sizes = {
    sm: "py-8",
    md: "py-12",
    lg: "py-20",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "flex flex-col items-center text-center px-4",
        sizes[size],
        className
      )}
    >
      <div className="mb-4">
        {icon ? (
          <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center">
            {icon}
          </div>
        ) : (
          <EmptyStateArt className="w-48 h-36" />
        )}
      </div>
      <h3 className="text-base font-semibold text-foreground mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-muted-foreground max-w-xs mb-4">{description}</p>
      )}
      <div className="flex items-center gap-2">
        {action && (
          <Button
            onClick={action.onClick}
            variant={action.variant || "default"}
            size="sm"
          >
            {action.label}
          </Button>
        )}
        {secondaryAction && (
          <Button
            onClick={secondaryAction.onClick}
            variant="ghost"
            size="sm"
          >
            {secondaryAction.label}
          </Button>
        )}
      </div>
    </motion.div>
  );
}
