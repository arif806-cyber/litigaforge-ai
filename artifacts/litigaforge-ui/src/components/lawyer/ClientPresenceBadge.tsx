interface ClientPresenceBadgeProps {
  isOnline: boolean;
}

export function ClientPresenceBadge({ isOnline }: ClientPresenceBadgeProps) {
  if (!isOnline) return null;
  return (
    <div className="flex items-center gap-1">
      <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
      <span className="text-[11px] text-green-600 font-medium">Client is online now</span>
    </div>
  );
}
