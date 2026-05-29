import { useState, useRef } from "react";
import { Link } from "wouter";
import { motion, useInView, AnimatePresence } from "framer-motion";
import {
  Scale, Sparkles, Users, FileSearch, MessageSquare, BookOpen,
  Shield, ArrowRight, Zap, Globe, Menu, X, Gavel, Heart,
  FileText, Brain, Check, Star, Clock, ChevronRight, AlertCircle,
  Building2, Search, MessageCircle, BadgeCheck
} from "lucide-react";

/* ── animation helpers ── */
const fadeUp = { hidden: { opacity: 0, y: 28 }, visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } } };
const fadeIn  = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { duration: 0.5 } } };
const stagger = { visible: { transition: { staggerChildren: 0.09 } } };

function useSection() {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  return { ref, inView };
}

/* ── Glow orb ── */
function GlowOrb({ className }: { className: string }) {
  return <div className={`absolute rounded-full blur-3xl pointer-events-none ${className}`} />;
}

/* ══════════════════════════════════════════════════════════
   NAVBAR
══════════════════════════════════════════════════════════ */
function Navbar() {
  const [open, setOpen] = useState(false);

  const links = [
    { label: "Features", href: "#features" },
    { label: "How It Works", href: "#how" },
    { label: "Lawyers", href: "#why" },
  ];

  return (
    <header
      style={{ backgroundColor: "rgba(6, 13, 26, 0.85)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl"
    >
      <nav className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/landing" className="flex items-center gap-2.5 select-none">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg, #2563eb, #7c3aed)" }}>
            <Scale className="w-4.5 h-4.5 text-white" />
          </div>
          <span className="font-bold text-white text-[15px] tracking-tight">LitigaForge <span style={{ color: "#3b82f6" }}>AI</span></span>
        </Link>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-8">
          {links.map(l => (
            <a key={l.label} href={l.href} style={{ color: "#94a3b8" }} className="text-sm hover:text-white transition-colors duration-200 font-medium">
              {l.label}
            </a>
          ))}
        </div>

        {/* CTA buttons */}
        <div className="hidden md:flex items-center gap-3">
          <Link href="/login" style={{ color: "#94a3b8" }} className="text-sm font-medium hover:text-white transition-colors px-4 py-2">Login</Link>
          <Link href="/login"
            style={{ background: "linear-gradient(135deg, #1d4ed8, #2563eb)", boxShadow: "0 0 20px rgba(59,130,246,0.3)" }}
            className="text-sm font-semibold text-white px-5 py-2 rounded-lg hover:opacity-90 transition-opacity">
            Get Started Free
          </Link>
        </div>

        {/* Mobile hamburger */}
        <button onClick={() => setOpen(!open)} className="md:hidden w-9 h-9 flex items-center justify-center rounded-lg" style={{ color: "#94a3b8" }}>
          {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </nav>

      {/* Mobile menu */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
            style={{ borderTop: "1px solid rgba(255,255,255,0.06)", backgroundColor: "rgba(6,13,26,0.98)" }}
            className="md:hidden overflow-hidden"
          >
            <div className="px-5 py-4 flex flex-col gap-4">
              {links.map(l => (
                <a key={l.label} href={l.href} onClick={() => setOpen(false)} style={{ color: "#94a3b8" }} className="text-sm font-medium py-1">
                  {l.label}
                </a>
              ))}
              <div className="flex flex-col gap-2 pt-2" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                <Link href="/login" style={{ color: "#94a3b8" }} className="text-sm font-medium py-2 text-center">Login</Link>
                <Link href="/login"
                  style={{ background: "linear-gradient(135deg, #1d4ed8, #2563eb)" }}
                  className="text-sm font-semibold text-white px-5 py-2.5 rounded-lg text-center">
                  Get Started Free
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

/* ══════════════════════════════════════════════════════════
   HERO — split layout: editorial left · AI match card right
══════════════════════════════════════════════════════════ */

/** Animated score arc (SVG ring) */
function ScoreRing({ score }: { score: number }) {
  const r = 32, circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  return (
    <svg width="84" height="84" viewBox="0 0 84 84" className="rotate-[-90deg]">
      <circle cx="42" cy="42" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
      <motion.circle
        cx="42" cy="42" r={r} fill="none"
        stroke="url(#scoreGrad)" strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray={circ}
        initial={{ strokeDashoffset: circ }}
        animate={{ strokeDashoffset: circ - dash }}
        transition={{ duration: 1.4, delay: 0.9, ease: "easeOut" }}
      />
      <defs>
        <linearGradient id="scoreGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#a78bfa" />
        </linearGradient>
      </defs>
    </svg>
  );
}

/** Floating AI match result card */
function MatchCard() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 32, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.7, delay: 0.55, ease: [0.22, 1, 0.36, 1] }}
      style={{
        background: "rgba(15,23,42,0.85)",
        border: "1px solid rgba(59,130,246,0.22)",
        boxShadow: "0 32px 80px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.04), inset 0 1px 0 rgba(255,255,255,0.06)",
        backdropFilter: "blur(20px)",
      }}
      className="w-full max-w-sm rounded-2xl overflow-hidden"
    >
      {/* Card header */}
      <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs font-semibold" style={{ color: "#94a3b8" }}>AI Match Result</span>
        </div>
        <div style={{ background: "rgba(59,130,246,0.15)", border: "1px solid rgba(59,130,246,0.25)" }}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full">
          <Sparkles className="w-3 h-3" style={{ color: "#60a5fa" }} />
          <span className="text-[10px] font-bold" style={{ color: "#93c5fd" }}>Claude + Gemini</span>
        </div>
      </div>

      {/* Score + lawyer */}
      <div className="px-5 py-5">
        <div className="flex items-center gap-4 mb-5">
          {/* Score ring */}
          <div className="relative flex-shrink-0">
            <ScoreRing score={96} />
            <div className="absolute inset-0 flex flex-col items-center justify-center rotate-90" style={{ top: 0 }}>
              <span className="text-xl font-extrabold text-white leading-none">96</span>
              <span className="text-[9px] font-semibold" style={{ color: "#64748b" }}>/ 100</span>
            </div>
          </div>
          {/* Lawyer info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="font-bold text-white text-[15px]">Adv. Priya Sharma</span>
              <BadgeCheck className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#34d399" }} />
            </div>
            <p className="text-xs mb-2" style={{ color: "#64748b" }}>Criminal Law · Hyderabad · 12 yrs</p>
            <div className="flex flex-wrap gap-1.5">
              {["IPC Cases", "Telugu", "Hindi", "English"].map(t => (
                <span key={t} className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                  style={{ background: "rgba(255,255,255,0.06)", color: "#94a3b8", border: "1px solid rgba(255,255,255,0.08)" }}>
                  {t}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* AI explanation */}
        <div className="rounded-xl p-3.5 mb-4" style={{ background: "rgba(37,99,235,0.08)", border: "1px solid rgba(59,130,246,0.14)" }}>
          <p className="text-xs leading-relaxed" style={{ color: "#93c5fd" }}>
            <span className="font-semibold">Why matched:</span> Specialises in IPC §420 fraud cases with 94% success rate in Hyderabad district. High client satisfaction in Telugu-speaking cases. Available this week.
          </p>
        </div>

        {/* Status row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span className="text-xs font-medium" style={{ color: "#34d399" }}>Available Now</span>
            </div>
            <div className="flex items-center gap-1">
              {[1,2,3,4,5].map(s => (
                <Star key={s} className="w-3 h-3" style={{ fill: s <= 5 ? "#f59e0b" : "none", color: "#f59e0b" }} />
              ))}
            </div>
          </div>
          <span className="text-xs font-semibold" style={{ color: "#60a5fa" }}>₹1,500/hr</span>
        </div>
      </div>

      {/* Action buttons */}
      <div className="px-5 pb-5 flex gap-2.5">
        <button className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white transition-opacity hover:opacity-90"
          style={{ background: "linear-gradient(135deg, #1d4ed8, #2563eb)", boxShadow: "0 0 16px rgba(37,99,235,0.35)" }}>
          Accept Match
        </button>
        <button className="px-4 py-2.5 rounded-xl text-xs font-semibold transition-colors"
          style={{ background: "rgba(255,255,255,0.06)", color: "#94a3b8", border: "1px solid rgba(255,255,255,0.08)" }}>
          View Profile
        </button>
      </div>

      {/* Footer label */}
      <div className="px-5 pb-4 text-center">
        <p className="text-[10px]" style={{ color: "#334155" }}>9 more matches ranked by AI · Updated just now</p>
      </div>
    </motion.div>
  );
}

function Hero() {
  return (
    <section className="relative min-h-screen flex items-center overflow-hidden px-5 pt-20 pb-12">
      {/* ── Background ── */}
      {/* Deep radial glow — blue left, purple right, gold bottom-right */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-120px] left-[-100px] w-[700px] h-[700px] rounded-full opacity-[0.18]"
          style={{ background: "radial-gradient(circle, #1d4ed8, transparent 65%)" }} />
        <div className="absolute top-[-80px] right-[-120px] w-[500px] h-[500px] rounded-full opacity-[0.1]"
          style={{ background: "radial-gradient(circle, #7c3aed, transparent 65%)" }} />
        <div className="absolute bottom-0 right-[5%] w-[350px] h-[350px] rounded-full opacity-[0.09]"
          style={{ background: "radial-gradient(circle, #f59e0b, transparent 65%)" }} />
        {/* Dot grid */}
        <div className="absolute inset-0 opacity-[0.025]"
          style={{ backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.9) 1px, transparent 1px)", backgroundSize: "28px 28px" }} />
        {/* Horizontal separator glow at bottom */}
        <div className="absolute bottom-0 left-0 right-0 h-px"
          style={{ background: "linear-gradient(90deg, transparent, rgba(59,130,246,0.25), rgba(167,139,250,0.2), transparent)" }} />
      </div>

      {/* ── Content ── */}
      <div className="relative z-10 max-w-6xl mx-auto w-full flex flex-col lg:flex-row items-center gap-12 lg:gap-16">

        {/* ──────────── LEFT: Editorial copy ──────────── */}
        <div className="flex-1 flex flex-col items-start text-left max-w-xl">

          {/* Overline badge */}
          <motion.div
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.05 }}
            style={{ background: "rgba(37,99,235,0.12)", border: "1px solid rgba(59,130,246,0.28)" }}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
            <span className="text-[11px] font-bold tracking-widest uppercase" style={{ color: "#93c5fd" }}>
              India's Legal AI Platform · TG &amp; AP
            </span>
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.13, ease: [0.22, 1, 0.36, 1] }}
            className="text-4xl sm:text-5xl lg:text-[3.6rem] xl:text-[4rem] font-extrabold leading-[1.06] tracking-tight mb-5">
            <span className="text-white">Legal Intelligence</span>
            <br />
            <span style={{
              background: "linear-gradient(120deg, #60a5fa 0%, #818cf8 45%, #c084fc 75%, #f59e0b 100%)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
            }}>
              Built for Telangana &amp; AP
            </span>
          </motion.h1>

          {/* Subheadline */}
          <motion.p
            initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, delay: 0.22 }}
            className="text-[17px] leading-relaxed mb-8 font-medium" style={{ color: "#94a3b8", maxWidth: "44ch" }}>
            Post your case, get AI-matched with a verified advocate in minutes, and navigate every step of the legal process with confidence.
          </motion.p>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.3 }}
            className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto mb-9">
            <Link href="/login"
              style={{ background: "linear-gradient(135deg, #1e40af, #2563eb)", boxShadow: "0 0 36px rgba(37,99,235,0.5), 0 6px 20px rgba(0,0,0,0.45)" }}
              className="group flex items-center justify-center gap-2.5 px-7 py-3.5 rounded-xl text-white font-bold text-[15px] hover:opacity-90 transition-all hover:scale-[1.02] active:scale-[0.99]">
              Get Started Free
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <a href="#demo"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)" }}
              className="group flex items-center justify-center gap-2.5 px-7 py-3.5 rounded-xl text-white font-semibold text-[15px] hover:bg-white/[0.09] transition-all">
              {/* Play circle */}
              <span className="flex items-center justify-center w-7 h-7 rounded-full flex-shrink-0 transition-transform group-hover:scale-110"
                style={{ background: "rgba(59,130,246,0.2)", border: "1px solid rgba(59,130,246,0.35)" }}>
                <svg width="10" height="12" viewBox="0 0 10 12" fill="none">
                  <path d="M1 1.5L9 6L1 10.5V1.5Z" fill="#60a5fa" />
                </svg>
              </span>
              Watch 60-sec Demo
            </a>
          </motion.div>

          {/* Trust signals */}
          <motion.div
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.38 }}
            className="flex flex-col gap-4">
            {/* Avatar stack + review count */}
            <div className="flex items-center gap-4">
              <div className="flex -space-x-2.5">
                {["#3b82f6","#8b5cf6","#f59e0b","#10b981","#f472b6"].map((c, i) => (
                  <div key={i} className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold text-white ring-2 flex-shrink-0"
                    style={{ background: `linear-gradient(135deg, ${c}cc, ${c})`, ringColor: "#060d1a" }}>
                    {["R","S","P","A","K"][i]}
                  </div>
                ))}
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  {[1,2,3,4,5].map(s => <Star key={s} className="w-3.5 h-3.5" style={{ fill: "#f59e0b", color: "#f59e0b" }} />)}
                  <span className="text-sm font-bold text-white">4.9</span>
                </div>
                <p className="text-xs" style={{ color: "#475569" }}>Trusted by 200+ clients across TG &amp; AP</p>
              </div>
            </div>

            {/* Inline chips */}
            <div className="flex flex-wrap gap-2">
              {[
                { label: "✓  Verified Advocates Only",        color: "#34d399" },
                { label: "⚡  Free to start, no credit card", color: "#60a5fa" },
                { label: "🔒  Anonymous case posting",         color: "#c084fc" },
              ].map(({ label, color }) => (
                <span key={label} className="text-[11px] font-semibold px-3 py-1 rounded-full"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color }}>
                  {label}
                </span>
              ))}
            </div>

            {/* "Built for real legal workflows" trust line */}
            <p className="text-xs font-medium flex items-center gap-2" style={{ color: "#334155" }}>
              <span className="w-5 h-px bg-slate-700 flex-shrink-0" />
              Built for real legal workflows in Telangana &amp; AP · Backed by eCourts + Mee Seva APIs
            </p>
          </motion.div>
        </div>

        {/* ──────────── RIGHT: Floating AI match card ──────────── */}
        <div className="w-full lg:w-auto lg:flex-shrink-0 flex justify-center lg:justify-end">
          {/* Outer glow wrapper */}
          <div className="relative">
            {/* Card glow */}
            <div className="absolute -inset-6 rounded-3xl opacity-30 blur-2xl pointer-events-none"
              style={{ background: "radial-gradient(ellipse, #2563eb 0%, #7c3aed 50%, transparent 80%)" }} />
            <MatchCard />

            {/* Floating mini-badge above the card */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 1.1, duration: 0.5 }}
              style={{ background: "rgba(15,23,42,0.9)", border: "1px solid rgba(16,185,129,0.3)", boxShadow: "0 8px 24px rgba(0,0,0,0.4)" }}
              className="absolute -top-4 -right-4 flex items-center gap-2 px-3 py-2 rounded-xl">
              <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: "rgba(16,185,129,0.15)" }}>
                <Zap className="w-3.5 h-3.5" style={{ color: "#34d399" }} />
              </div>
              <div>
                <p className="text-[10px] font-bold text-white leading-none">Matched in</p>
                <p className="text-[10px] font-extrabold leading-none" style={{ color: "#34d399" }}>47 seconds</p>
              </div>
            </motion.div>

            {/* Floating mini-badge below the card */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 1.3, duration: 0.5 }}
              style={{ background: "rgba(15,23,42,0.9)", border: "1px solid rgba(245,158,11,0.3)", boxShadow: "0 8px 24px rgba(0,0,0,0.4)" }}
              className="absolute -bottom-4 -left-4 flex items-center gap-2.5 px-3 py-2 rounded-xl">
              <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: "rgba(245,158,11,0.15)" }}>
                <Shield className="w-3.5 h-3.5" style={{ color: "#fbbf24" }} />
              </div>
              <div>
                <p className="text-[10px] font-bold text-white leading-none">Bar Verified</p>
                <p className="text-[10px]" style={{ color: "#64748b" }}>AP State Bar Council</p>
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Scroll hint */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.6 }}
        className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5">
        <div className="w-px h-7 bg-gradient-to-b from-transparent via-slate-600 to-transparent" />
        <span className="text-[11px]" style={{ color: "#334155" }}>Scroll to explore</span>
      </motion.div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════
   PROBLEM SECTION
══════════════════════════════════════════════════════════ */
const problems = [
  {
    icon: AlertCircle,
    color: "#ef4444",
    title: "No Transparency",
    desc: "Finding a lawyer in Telangana & AP is completely opaque. No ratings, no verification, no way to compare — just word-of-mouth and luck.",
  },
  {
    icon: Shield,
    color: "#f59e0b",
    title: "Unverified Credentials",
    desc: "Anyone can claim to be an advocate. Clients have no reliable way to verify bar registration, experience, or practice areas before paying.",
  },
  {
    icon: Clock,
    color: "#a78bfa",
    title: "No AI Intelligence",
    desc: "Legal consultations are costly and slow. There's no smart system to help you understand your case, find precedents, or draft documents — before you even meet a lawyer.",
  },
];

function ProblemSection() {
  const { ref, inView } = useSection();
  return (
    <motion.section ref={ref} id="problem" initial="hidden" animate={inView ? "visible" : "hidden"} variants={stagger}
      className="relative py-24 px-5 overflow-hidden">
      <GlowOrb className="w-[400px] h-[400px] top-0 right-0 opacity-[0.07]" style={{ background: "radial-gradient(circle, #ef4444, transparent)" } as React.CSSProperties} />
      <div className="max-w-5xl mx-auto">
        <motion.div variants={fadeUp} className="text-center mb-14">
          <span className="text-xs font-bold tracking-widest uppercase" style={{ color: "#ef4444" }}>The Problem</span>
          <h2 className="text-3xl md:text-4xl font-extrabold text-white mt-3 leading-tight">Legal Help in Telangana &amp; AP<br className="hidden md:block" /> is Fundamentally Broken</h2>
          <p className="mt-4 text-base max-w-xl mx-auto leading-relaxed" style={{ color: "#64748b" }}>Millions face legal challenges every year with no efficient, transparent, or affordable path to justice.</p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-5">
          {problems.map(({ icon: Icon, color, title, desc }) => (
            <motion.div key={title} variants={fadeUp}
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
              className="rounded-2xl p-6 hover:bg-white/[0.05] transition-colors duration-300 group">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-4" style={{ background: `${color}20` }}>
                <Icon className="w-5 h-5" style={{ color }} />
              </div>
              <h3 className="font-bold text-white text-[17px] mb-2">{title}</h3>
              <p className="text-sm leading-relaxed" style={{ color: "#64748b" }}>{desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.section>
  );
}

/* ══════════════════════════════════════════════════════════
   HOW IT WORKS
══════════════════════════════════════════════════════════ */
const steps = [
  { num: "01", icon: FileText,   color: "#3b82f6", title: "Post Your Case", desc: "Describe your legal situation. Choose to stay anonymous. Takes under 2 minutes." },
  { num: "02", icon: Brain,      color: "#8b5cf6", title: "AI Analyses & Scores", desc: "Our multi-AI engine (Claude + Gemini + GPT) finds the top 10 matching lawyers and scores them 0-100." },
  { num: "03", icon: Star,       color: "#f59e0b", title: "Review Proposals", desc: "Lawyers send proposals with their approach. AI explains each match score with transparent reasoning." },
  { num: "04", icon: Gavel,      color: "#10b981", title: "Connect & Get Help", desc: "Accept the best match. Chat securely, share documents, and track your case in real time." },
];

function HowItWorks() {
  const { ref, inView } = useSection();
  return (
    <motion.section ref={ref} id="how" initial="hidden" animate={inView ? "visible" : "hidden"} variants={stagger}
      className="relative py-24 px-5">
      <div className="max-w-5xl mx-auto">
        <motion.div variants={fadeUp} className="text-center mb-14">
          <span className="text-xs font-bold tracking-widest uppercase" style={{ color: "#60a5fa" }}>How It Works</span>
          <h2 className="text-3xl md:text-4xl font-extrabold text-white mt-3">From Case to Lawyer in 4 Steps</h2>
          <p className="mt-4 text-base max-w-lg mx-auto" style={{ color: "#64748b" }}>No phone calls, no directories. Just post, get matched, review, and connect.</p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
          {steps.map(({ num, icon: Icon, color, title, desc }) => (
            <motion.div key={num} variants={fadeUp}
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
              className="relative rounded-2xl p-6 group hover:bg-white/[0.05] transition-colors duration-300">
              {/* Step number */}
              <div className="absolute top-5 right-5 text-[11px] font-bold" style={{ color: "rgba(255,255,255,0.12)" }}>{num}</div>
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-5" style={{ background: `${color}18`, border: `1px solid ${color}30` }}>
                <Icon className="w-5 h-5" style={{ color }} />
              </div>
              <h3 className="font-bold text-white text-[15px] mb-2">{title}</h3>
              <p className="text-sm leading-relaxed" style={{ color: "#64748b" }}>{desc}</p>
              {/* Connector arrow — visible on lg */}
              {num !== "04" && (
                <ChevronRight className="hidden lg:block absolute -right-3 top-1/2 -translate-y-1/2 w-5 h-5 z-10" style={{ color: "rgba(255,255,255,0.15)" }} />
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </motion.section>
  );
}

/* ══════════════════════════════════════════════════════════
   FEATURES
══════════════════════════════════════════════════════════ */
const features = [
  {
    icon: Scale, color: "#3b82f6", gradient: "from-blue-600/20 to-blue-900/5",
    title: "AI Legal Forge",
    desc: "Paste your case facts. Our engine runs 16 government API chains and synthesises a full legal strategy using 3 AI models simultaneously.",
    badge: "Flagship",
  },
  {
    icon: Sparkles, color: "#a78bfa", gradient: "from-violet-600/20 to-violet-900/5",
    title: "Smart Lawyer Matching",
    desc: "AI scores lawyers 0-100 based on specialisation, location, language, rating, and availability. No guesswork — just transparent ranked proposals.",
    badge: "",
  },
  {
    icon: MessageSquare, color: "#34d399", gradient: "from-emerald-600/20 to-emerald-900/5",
    title: "AI Legal Chat",
    desc: "Interactive drafting assistant with 4 document templates. Chat live with Claude or Gemini to draft contracts, FIRs, complaints, and more.",
    badge: "",
  },
  {
    icon: FileSearch, color: "#f59e0b", gradient: "from-amber-600/20 to-amber-900/5",
    title: "Document Analyzer",
    desc: "Paste any contract, FIR, or agreement. AI returns a risk score, flags missing clauses, and gives actionable recommendations in seconds.",
    badge: "",
  },
  {
    icon: BookOpen, color: "#f472b6", gradient: "from-pink-600/20 to-pink-900/5",
    title: "Judgment Finder",
    desc: "Search decades of Indian case law. AI returns 5 relevant precedents with IndianKanoon links — ready to cite in your case.",
    badge: "",
  },
  {
    icon: Heart, color: "#fb923c", gradient: "from-orange-600/20 to-orange-900/5",
    title: "Free Legal Aid Finder",
    desc: "NALSA eligibility wizard + all 8 Telangana DLSA district contacts. Know your rights and access free government legal aid instantly.",
    badge: "",
  },
];

function Features() {
  const { ref, inView } = useSection();
  return (
    <motion.section ref={ref} id="features" initial="hidden" animate={inView ? "visible" : "hidden"} variants={stagger}
      className="relative py-24 px-5 overflow-hidden">
      <GlowOrb className="w-[500px] h-[500px] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.06]" style={{ background: "radial-gradient(circle, #3b82f6, transparent)" } as React.CSSProperties} />
      <div className="max-w-6xl mx-auto">
        <motion.div variants={fadeUp} className="text-center mb-14">
          <span className="text-xs font-bold tracking-widest uppercase" style={{ color: "#f59e0b" }}>Features</span>
          <h2 className="text-3xl md:text-4xl font-extrabold text-white mt-3">Everything You Need.<br className="hidden md:block" /> Nothing You Don't.</h2>
          <p className="mt-4 text-base max-w-lg mx-auto" style={{ color: "#64748b" }}>6 powerful tools — all in one platform — built specifically for Indian legal needs.</p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map(({ icon: Icon, color, gradient, title, desc, badge }) => (
            <motion.div key={title} variants={fadeUp}
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
              className="group relative rounded-2xl p-6 hover:bg-white/[0.05] transition-all duration-300 cursor-default overflow-hidden">
              {/* Gradient bg on hover */}
              <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl`} />
              <div className="relative z-10">
                {badge && (
                  <span className="absolute top-0 right-0 text-[10px] font-bold px-2.5 py-1 rounded-full" style={{ background: `${color}25`, color, border: `1px solid ${color}40` }}>{badge}</span>
                )}
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4" style={{ background: `${color}18`, border: `1px solid ${color}30` }}>
                  <Icon className="w-5 h-5" style={{ color }} />
                </div>
                <h3 className="font-bold text-white text-[17px] mb-2">{title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: "#64748b" }}>{desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.section>
  );
}

/* ══════════════════════════════════════════════════════════
   WHY LITIGAFORGE
══════════════════════════════════════════════════════════ */
const trustPoints = [
  { icon: BadgeCheck, color: "#34d399", title: "Verified Lawyers Only",    desc: "Every advocate is bar-verified, rated by clients, and screened by our team before appearing on the platform." },
  { icon: Brain,      color: "#60a5fa", title: "Triple AI Intelligence",   desc: "Claude Sonnet + Gemini 2.5 Flash + GPT-5 work in parallel and cascade to guarantee the best legal insights." },
  { icon: Building2,  color: "#fbbf24", title: "Hyper-Local Expertise",    desc: "Built exclusively for Telangana & AP — with Mee Seva, eCourts, Transport TS, and 12 more live government APIs." },
  { icon: Globe,      color: "#a78bfa", title: "Transparent & Explainable", desc: "Every AI match score comes with a written explanation. No black-box decisions — you always know why a lawyer was matched." },
];

function WhyLitigaForge() {
  const { ref, inView } = useSection();
  return (
    <motion.section ref={ref} id="why" initial="hidden" animate={inView ? "visible" : "hidden"} variants={stagger}
      className="relative py-24 px-5 overflow-hidden">
      {/* Divider glow */}
      <div className="absolute top-0 left-0 right-0 h-px" style={{ background: "linear-gradient(90deg, transparent, rgba(59,130,246,0.3), transparent)" }} />
      <GlowOrb className="w-[350px] h-[350px] bottom-0 left-0 opacity-[0.08]" style={{ background: "radial-gradient(circle, #7c3aed, transparent)" } as React.CSSProperties} />

      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col lg:flex-row gap-14 items-start">
          {/* Left */}
          <motion.div variants={fadeUp} className="lg:w-[38%] flex-shrink-0">
            <span className="text-xs font-bold tracking-widest uppercase" style={{ color: "#a78bfa" }}>Why LitigaForge</span>
            <h2 className="text-3xl md:text-4xl font-extrabold text-white mt-3 leading-tight">Built Different. <span style={{ color: "#3b82f6" }}>For India.</span></h2>
            <p className="mt-4 text-base leading-relaxed" style={{ color: "#64748b" }}>
              We didn't just build another directory. We built a full legal intelligence platform — with real-time government data, multi-AI strategy synthesis, and genuine lawyer verification.
            </p>
            <Link href="/login"
              style={{ background: "linear-gradient(135deg, #1d4ed8, #2563eb)", boxShadow: "0 0 24px rgba(37,99,235,0.35)" }}
              className="mt-8 inline-flex items-center gap-2 px-6 py-3 rounded-xl text-white font-bold text-sm hover:opacity-90 transition-opacity">
              Start for Free <ArrowRight className="w-4 h-4" />
            </Link>
          </motion.div>

          {/* Right grid */}
          <div className="flex-1 grid sm:grid-cols-2 gap-4">
            {trustPoints.map(({ icon: Icon, color, title, desc }) => (
              <motion.div key={title} variants={fadeUp}
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
                className="rounded-xl p-5 hover:bg-white/[0.05] transition-colors duration-300">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${color}18` }}>
                    <Icon className="w-4 h-4" style={{ color }} />
                  </div>
                  <h3 className="font-bold text-white text-[15px]">{title}</h3>
                </div>
                <p className="text-sm leading-relaxed pl-12" style={{ color: "#64748b" }}>{desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </motion.section>
  );
}

/* ══════════════════════════════════════════════════════════
   SOCIAL PROOF TICKER
══════════════════════════════════════════════════════════ */
const stats = [
  { value: "200+", label: "Verified Advocates" },
  { value: "16",   label: "Live Govt. APIs" },
  { value: "3",    label: "AI Models" },
  { value: "9",    label: "Case Types" },
  { value: "10+",  label: "Free Doc Templates" },
  { value: "8",    label: "DLSA Districts" },
];

function StatsBanner() {
  const { ref, inView } = useSection();
  return (
    <motion.section ref={ref} initial="hidden" animate={inView ? "visible" : "hidden"} variants={stagger}
      className="py-16 px-5" style={{ background: "rgba(255,255,255,0.02)", borderTop: "1px solid rgba(255,255,255,0.05)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
      <div className="max-w-5xl mx-auto grid grid-cols-3 md:grid-cols-6 gap-6 text-center">
        {stats.map(({ value, label }) => (
          <motion.div key={label} variants={fadeUp} className="flex flex-col items-center gap-1">
            <span className="text-2xl md:text-3xl font-extrabold text-white">{value}</span>
            <span className="text-xs font-medium" style={{ color: "#475569" }}>{label}</span>
          </motion.div>
        ))}
      </div>
    </motion.section>
  );
}

/* ══════════════════════════════════════════════════════════
   FINAL CTA
══════════════════════════════════════════════════════════ */
function CTASection() {
  const { ref, inView } = useSection();
  return (
    <motion.section ref={ref} initial="hidden" animate={inView ? "visible" : "hidden"} variants={stagger}
      className="relative py-28 px-5 text-center overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 opacity-30" style={{ background: "radial-gradient(ellipse at center, #1e3a8a 0%, transparent 65%)" }} />
      <div className="absolute top-0 left-0 right-0 h-px" style={{ background: "linear-gradient(90deg, transparent, rgba(59,130,246,0.3), transparent)" }} />

      <div className="relative z-10 max-w-3xl mx-auto">
        <motion.div variants={fadeUp}
          style={{ background: "rgba(37,99,235,0.15)", border: "1px solid rgba(59,130,246,0.25)" }}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-6">
          <Sparkles className="w-3.5 h-3.5" style={{ color: "#60a5fa" }} />
          <span className="text-xs font-semibold tracking-wide" style={{ color: "#93c5fd" }}>FREE TO START · NO CREDIT CARD</span>
        </motion.div>

        <motion.h2 variants={fadeUp} className="text-4xl md:text-5xl font-extrabold text-white leading-tight">
          Ready to Solve Your<br />
          <span style={{ background: "linear-gradient(135deg, #3b82f6, #f59e0b)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
            Legal Problem Today?
          </span>
        </motion.h2>

        <motion.p variants={fadeUp} className="mt-5 text-base md:text-lg leading-relaxed" style={{ color: "#94a3b8" }}>
          Join thousands of clients and advocates across Telangana &amp; AP using AI-powered legal intelligence. Post your case anonymously. Get matched in minutes.
        </motion.p>

        <motion.div variants={fadeUp} className="mt-9 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link href="/login"
            style={{ background: "linear-gradient(135deg, #1d4ed8, #2563eb)", boxShadow: "0 0 40px rgba(37,99,235,0.5), 0 8px 24px rgba(0,0,0,0.4)" }}
            className="group flex items-center gap-2.5 px-8 py-4 rounded-xl text-white font-bold text-[15px] hover:opacity-90 transition-all hover:scale-[1.02] w-full sm:w-auto justify-center">
            <Gavel className="w-4 h-4" />
            Post Your Case Free
            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </Link>
          <Link href="/lawyers"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)" }}
            className="flex items-center gap-2 px-8 py-4 rounded-xl text-white font-semibold text-[15px] hover:bg-white/10 transition-all w-full sm:w-auto justify-center">
            <Search className="w-4 h-4" style={{ color: "#60a5fa" }} />
            Find a Lawyer
          </Link>
        </motion.div>

        {/* Checkpoints */}
        <motion.div variants={fadeUp} className="mt-10 flex flex-wrap items-center justify-center gap-6">
          {["No setup fee", "Anonymous case posting", "AI explanations included", "Cancel anytime"].map(item => (
            <div key={item} className="flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#34d399" }} />
              <span className="text-sm" style={{ color: "#64748b" }}>{item}</span>
            </div>
          ))}
        </motion.div>
      </div>
    </motion.section>
  );
}

/* ══════════════════════════════════════════════════════════
   FOOTER
══════════════════════════════════════════════════════════ */
function Footer() {
  return (
    <footer style={{ borderTop: "1px solid rgba(255,255,255,0.05)", background: "rgba(0,0,0,0.3)" }} className="py-10 px-5">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          {/* Brand */}
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg, #2563eb, #7c3aed)" }}>
              <Scale className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-bold text-white text-sm">LitigaForge AI</span>
          </div>

          {/* Links */}
          <div className="flex flex-wrap gap-5">
            {[
              { label: "Legal Q&A",       href: "/ask" },
              { label: "Lawyer Directory", href: "/lawyers" },
              { label: "Free Documents",  href: "/free-documents" },
              { label: "Free Legal Aid",  href: "/legal-aid" },
              { label: "AI Forge",        href: "/" },
            ].map(l => (
              <Link key={l.label} href={l.href} style={{ color: "#64748b" }} className="text-xs hover:text-white transition-colors">
                {l.label}
              </Link>
            ))}
          </div>
        </div>

        <div className="mt-8 pt-6 flex flex-col md:flex-row items-center justify-between gap-3" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
          <p className="text-xs" style={{ color: "#334155" }}>© 2025 LitigaForge AI · Telangana & Andhra Pradesh</p>
          <p className="text-xs text-center md:text-right" style={{ color: "#334155" }}>
            Not legal advice. AI outputs must be verified by a qualified advocate. Platform connects clients to lawyers only.
          </p>
        </div>
      </div>
    </footer>
  );
}

/* ══════════════════════════════════════════════════════════
   PAGE ROOT
══════════════════════════════════════════════════════════ */
export default function LandingPage() {
  return (
    <div className="dark" style={{ minHeight: "100vh", background: "#060d1a", color: "#e2e8f0", fontFamily: "Inter, sans-serif" }}>
      <Navbar />
      <Hero />
      <ProblemSection />
      <HowItWorks />
      <Features />
      <WhyLitigaForge />
      <StatsBanner />
      <CTASection />
      <Footer />
    </div>
  );
}
