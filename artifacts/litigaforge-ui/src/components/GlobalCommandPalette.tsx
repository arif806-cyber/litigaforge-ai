import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import {
  Sparkles, LayoutDashboard, MessageSquareText, Search, Gavel,
  FileSearch, LifeBuoy, FileText, FilePlus2, Briefcase, Handshake,
  FolderOpen, CreditCard, Settings, Home,
} from "lucide-react";
import {
  CommandDialog, CommandInput, CommandList, CommandEmpty,
  CommandGroup, CommandItem, CommandShortcut,
} from "@/components/ui/command";
import { useAuth } from "@/lib/auth-context";

interface NavCommand {
  /** Base-relative wouter route (resolved under the active country base). */
  path: string;
  label: string;
  icon: React.ReactNode;
  /** Extra terms to widen fuzzy matching. */
  keywords?: string;
  /** Single-key hint shown on the right (mirrors KeyboardShortcuts). */
  shortcut?: string;
  /** Only available to signed-in users. */
  requiresAuth?: boolean;
}

const NAV_COMMANDS: NavCommand[] = [
  { path: "/ask", label: "Ask a legal question", icon: <MessageSquareText />, keywords: "ai chat question advice query", shortcut: "A" },
  { path: "/lawyers", label: "Find a lawyer", icon: <Search />, keywords: "advocate directory match verified", shortcut: "L" },
  { path: "/judgments", label: "Search judgments & precedents", icon: <Gavel />, keywords: "case law precedent indiankanoon", shortcut: "J" },
  { path: "/review", label: "Analyze a document", icon: <FileSearch />, keywords: "contract risk review analyzer fir", shortcut: "R" },
  { path: "/legal-aid", label: "Free legal aid", icon: <LifeBuoy />, keywords: "nalsa tslsa eligibility helpline" },
  { path: "/free-documents", label: "Free legal documents", icon: <FileText />, keywords: "templates draft generate" },
  { path: "/post-case", label: "Post a case", icon: <FilePlus2 />, keywords: "new requirement hire", shortcut: "P", requiresAuth: true },
  { path: "/my-cases", label: "My cases", icon: <Briefcase />, keywords: "track posted requirements", shortcut: "M", requiresAuth: true },
  { path: "/matches", label: "Match proposals", icon: <Handshake />, keywords: "lawyer score accept decline", requiresAuth: true },
  { path: "/documents", label: "My documents", icon: <FolderOpen />, keywords: "files uploads", requiresAuth: true },
  { path: "/legal-chat", label: "AI legal chat", icon: <Sparkles />, keywords: "draft assistant", requiresAuth: true },
  { path: "/subscription", label: "Subscription & plans", icon: <CreditCard />, keywords: "upgrade billing pro", shortcut: "S", requiresAuth: true },
  { path: "/settings", label: "Account settings", icon: <Settings />, keywords: "profile preferences account", requiresAuth: true },
];

/**
 * GlobalCommandPalette — a ⌘K / Ctrl+K command bar for the whole app.
 * Fuzzy-navigates app routes and offers a one-keystroke "ask the AI" action
 * that routes the typed text into the existing /ask flow. Built on the shared
 * cmdk-based command primitives; mounted once inside the router.
 */
export function GlobalCommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [, setLocation] = useLocation();
  const { user } = useAuth();

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    // Allow any UI affordance (e.g. a header "Search" button) to open the
    // palette without a keyboard, by dispatching a window event.
    function onOpenRequest() {
      setOpen(true);
    }
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("lf-open-command-palette", onOpenRequest);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("lf-open-command-palette", onOpenRequest);
    };
  }, []);

  // Reset the query whenever the palette closes so it opens fresh next time.
  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  function run(path: string) {
    setOpen(false);
    setLocation(path);
  }

  function askAI() {
    const q = query.trim();
    setOpen(false);
    setLocation(`/ask?q=${encodeURIComponent(q)}&category=general`);
  }

  const dashboardPath = user?.role === "lawyer" ? "/lawyer-dashboard" : "/client-dashboard";
  const commands = NAV_COMMANDS.filter((c) => !c.requiresAuth || Boolean(user));
  const trimmed = query.trim();

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder="Search cases, lawyers, judgments — or ask the AI…"
        value={query}
        onValueChange={setQuery}
        data-testid="command-input"
      />
      <CommandList>
        <CommandEmpty>No results. Press Enter on “Ask the AI” to get an answer.</CommandEmpty>

        {trimmed.length > 0 && (
          <CommandGroup heading="Ask LitigaForge AI">
            {/* value === current query guarantees this always survives cmdk's
                fuzzy filter and sorts to the top. */}
            <CommandItem value={trimmed} onSelect={askAI} data-testid="command-ask-ai">
              <Sparkles className="text-[hsl(var(--cfos-gold))]" />
              <span>Ask the AI: <span className="font-medium text-foreground">“{trimmed}”</span></span>
              <CommandShortcut>↵</CommandShortcut>
            </CommandItem>
          </CommandGroup>
        )}

        {user && (
          <CommandGroup heading="Dashboard">
            <CommandItem
              value="dashboard home overview"
              onSelect={() => run(dashboardPath)}
              data-testid="command-nav-dashboard"
            >
              <LayoutDashboard />
              <span>Go to dashboard</span>
            </CommandItem>
          </CommandGroup>
        )}

        <CommandGroup heading="Navigate">
          {commands.map((c) => (
            <CommandItem
              key={c.path}
              value={`${c.label} ${c.keywords ?? ""}`}
              onSelect={() => run(c.path)}
              data-testid={`command-nav-${c.path.replace(/\//g, "")}`}
            >
              {c.icon}
              <span>{c.label}</span>
              {c.shortcut && <CommandShortcut>{c.shortcut}</CommandShortcut>}
            </CommandItem>
          ))}
          <CommandItem
            value="home country landing start"
            onSelect={() => run("/")}
            data-testid="command-nav-home"
          >
            <Home />
            <span>Home</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
