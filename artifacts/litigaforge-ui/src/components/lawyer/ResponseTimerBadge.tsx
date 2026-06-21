interface ResponseTimerBadgeProps {
  requestedAt: string;
}

export function ResponseTimerBadge({ requestedAt }: ResponseTimerBadgeProps) {
  const minutesElapsed = Math.floor(
    (Date.now() - new Date(requestedAt).getTime()) / 60_000
  );
  const urgent = minutesElapsed > 60;
  return (
    <div
      className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
        urgent ? "bg-red-100 text-red-600" : "bg-gray-100 text-gray-500"
      }`}
    >
      {urgent
        ? `⏱ ${minutesElapsed}m — respond soon to keep your match score`
        : `Requested ${minutesElapsed}m ago`}
    </div>
  );
}
