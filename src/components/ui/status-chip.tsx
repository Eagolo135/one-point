type StatusChipTone = "neutral" | "gold" | "warning";

type StatusChipProps = {
  label: string;
  tone?: StatusChipTone;
};

const TONE_STYLES: Record<StatusChipTone, string> = {
  neutral: "border-zinc-700 bg-zinc-900/70 text-zinc-200 shadow-sm",
  gold: "border-gold/70 bg-gold/15 text-gold-strong shadow-sm",
  warning: "border-danger/70 bg-danger/15 text-red-200 shadow-sm",
};

export function StatusChip({ label, tone = "neutral" }: StatusChipProps) {
  return (
    <span className={`rounded-full border px-2.5 py-1 text-xs font-medium tracking-wide ${TONE_STYLES[tone]}`}>
      {label}
    </span>
  );
}
