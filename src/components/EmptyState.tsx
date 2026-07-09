import type { LucideIcon } from 'lucide-react';

interface Props {
  icon: LucideIcon;
  message: string;
}

export default function EmptyState({ icon: Icon, message }: Props) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-6 text-center">
      <Icon size={28} className="text-ink-muted/40" aria-hidden="true" />
      <p className="text-ink-muted text-sm">{message}</p>
    </div>
  );
}
