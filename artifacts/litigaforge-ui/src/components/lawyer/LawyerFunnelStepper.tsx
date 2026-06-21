const STAGES = ["Case Viewed", "Requested", "Proposal Sent", "Hired"];

interface LawyerFunnelStepperProps {
  currentIndex: number;
}

export default function LawyerFunnelStepper({ currentIndex }: LawyerFunnelStepperProps) {
  return (
    <div className="flex gap-1" role="progressbar" aria-valuenow={currentIndex} aria-valuemax={STAGES.length - 1}>
      {STAGES.map((s, i) => (
        <div
          key={s}
          title={s}
          className={`flex-1 h-1.5 rounded-full transition-colors duration-300 ${
            i <= currentIndex ? "bg-blue-600" : "bg-gray-200"
          }`}
        />
      ))}
    </div>
  );
}
