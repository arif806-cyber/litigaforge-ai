import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

export const EASE = [0.22, 1, 0.36, 1] as const;

export function Disclosure({ dark = false }: { dark?: boolean }) {
  return (
    <div
      className={`absolute bottom-[8.5%] left-[4.2%] z-30 font-mono text-[1.05vmin] tracking-[0.14em] ${
        dark ? 'text-white/45' : 'text-[#526477]'
      }`}
    >
      FICTIONAL DEMO CONTENT · NO CLIENT DATA
    </div>
  );
}

export function StepTitle({
  number,
  title,
  dark = false,
}: {
  number: string;
  title: string;
  dark?: boolean;
}) {
  return (
    <div className="flex items-center gap-[1.2vmin]">
      <span className="font-mono text-[1.5vmin] font-bold tracking-[0.18em] text-[#0d9488]">
        {number}
      </span>
      <span className={`font-display text-[3.1vmin] font-semibold tracking-[-0.045em] ${dark ? 'text-white' : 'text-[#1a2744]'}`}>
        {title}
      </span>
    </div>
  );
}

export function AppTopbar({ section = 'Forge Workspace' }: { section?: string }) {
  return (
    <div className="flex h-[6.3vmin] items-center justify-between border-b border-[#dbe2e4] px-[2.4vmin]">
      <div className="flex items-center gap-[1.2vmin]">
        <span className="font-display text-[1.6vmin] font-bold tracking-[-0.04em] text-[#1a2744]">LitigaForge</span>
        <span className="h-[1.7vmin] w-px bg-[#c8d2d7]" />
        <span className="font-mono text-[1.2vmin] text-[#60717a]">{section}</span>
      </div>
      <span className="rounded-full border border-[#c9d7d6] bg-[#eff8f6] px-[1.1vmin] py-[0.55vmin] font-mono text-[1vmin] tracking-[0.09em] text-[#0d766e]">
        DEMO MATTER
      </span>
    </div>
  );
}

export function DemoWindow({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`overflow-hidden rounded-[1.6vmin] border border-[#cfd9dc] bg-[#fbfcf8] shadow-[0_2.5vmin_8vmin_rgba(15,34,48,0.16)] ${className}`}>
      <AppTopbar />
      {children}
    </div>
  );
}

export function Tag({
  children,
  tone = 'teal',
}: {
  children: ReactNode;
  tone?: 'teal' | 'amber' | 'slate';
}) {
  const themes = {
    teal: 'border-[#9fd5cf] bg-[#e5f4f1] text-[#0c766e]',
    amber: 'border-[#ecd196] bg-[#fff5dc] text-[#946100]',
    slate: 'border-[#d0d8dd] bg-[#f3f5f3] text-[#64737a]',
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-[1vmin] py-[0.5vmin] font-mono text-[1.05vmin] tracking-[0.08em] ${themes[tone]}`}>
      {children}
    </span>
  );
}

export function Marker({
  x,
  y,
  delay = 0,
}: {
  x: string;
  y: string;
  delay?: number;
}) {
  return (
    <motion.div
      className="pointer-events-none absolute z-40 h-[2.2vmin] w-[2.2vmin] rounded-full border-[0.28vmin] border-[#f59e0b] shadow-[0_0_0_0.45vmin_rgba(245,158,11,0.14)]"
      style={{ left: x, top: y }}
      initial={{ opacity: 0, scale: 1.8 }}
      animate={{ opacity: 1, scale: [1.5, 0.86, 1] }}
      transition={{ delay, duration: 0.55, times: [0, 0.65, 1], ease: EASE }}
    />
  );
}

export function Rule({ className = '' }: { className?: string }) {
  return <div className={`h-px bg-[#d8e1e2] ${className}`} />;
}
