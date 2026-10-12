import { Switch, Route, Router as WouterRouter, useLocation, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { ThemeProvider } from "@/lib/theme-provider";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { trackPageView } from "@/lib/analytics";
import { initRecaptcha } from "@/lib/recaptcha";
import { loadGoogleIdentity } from "@/lib/google-auth";
import { Loader2, ShieldAlert } from "lucide-react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { SkipLink } from "@/components/SkipLink";
import { KeyboardShortcuts } from "@/components/KeyboardShortcuts";
import { GlobalCommandPalette } from "@/components/GlobalCommandPalette";
import { viewTransitionAroundNav } from "@/lib/view-transitions";
import { SEOHelmet } from "@/components/SEOHelmet";
import { InstallPrompt } from "@/components/InstallPrompt";
import {
  getAppBase,
  getCountryFromPath,
  getCountryAliasFromPath,
  getPathWithoutCountry,
  buildCountryUrl,
  isValidCountry,
} from "@/lib/country";

const Login               = lazy(() => import("@/pages/login"));
const ForgotPassword      = lazy(() => import("@/pages/forgot-password"));
const VerifyEmail          = lazy(() => import("@/pages/verify-email"));
const ResetPassword        = lazy(() => import("@/pages/reset-password"));
const Subscription        = lazy(() => import("@/pages/subscription"));
const Ask                 = lazy(() => import("@/pages/ask"));
const Review              = lazy(() => import("@/pages/review"));
const Judgments           = lazy(() => import("@/pages/judgments"));
const JudgmentDetail      = lazy(() => import("@/pages/judgment-detail"));
const LawyersPage         = lazy(() => import("@/pages/lawyers"));
const LegalAid            = lazy(() => import("@/pages/legal-aid"));
const NotFound            = lazy(() => import("@/pages/not-found"));
const PostCase            = lazy(() => import("@/pages/post-case"));
const MyCases             = lazy(() => import("@/pages/my-cases"));
const CaseDetail          = lazy(() => import("@/pages/case-detail"));
const Matches             = lazy(() => import("@/pages/matches"));
const LegalChat           = lazy(() => import("@/pages/legal-chat"));
const AdminPage           = lazy(() => import("@/pages/admin"));
const LawyerDashboard     = lazy(() => import("@/pages/lawyer-dashboard"));
const ClientDashboard     = lazy(() => import("@/pages/client-dashboard"));
const DocumentsPage       = lazy(() => import("@/pages/documents"));
const FreeDocuments       = lazy(() => import("@/pages/free-documents"));
const DocumentTemplatePage = lazy(() => import("@/pages/document-template"));
const Blog                = lazy(() => import("@/pages/blog"));
const BlogPost            = lazy(() => import("@/pages/blog-post"));
const CityPage            = lazy(() => import("@/pages/city"));
const DemoPage            = lazy(() => import("@/pages/demo"));
const PrivacyPolicy       = lazy(() => import("@/pages/privacy"));
const TermsOfService      = lazy(() => import("@/pages/terms"));
const About               = lazy(() => import("@/pages/about"));
const Contact             = lazy(() => import("@/pages/contact"));
const Digest              = lazy(() => import("@/pages/digest"));
const ProfileResearch     = lazy(() => import("@/pages/profile-research"));
const RefundPolicy        = lazy(() => import("@/pages/refund-policy"));
const UsDemandLetter      = lazy(() => import("@/pages/us-demand-letter"));
const AccountSettings     = lazy(() => import("@/pages/settings"));
const ForgeWorkspace      = lazy(() => import("@/pages/workspace"));
const WorkspaceDemoPreview = lazy(() =>
  import("@/pages/workspace").then((m) => ({ default: m.WorkspaceDemoPreview })),
);
const MessagesPage        = lazy(() => import("@/pages/messages"));
const CnrTracker          = lazy(() => import("@/pages/cnr-tracker"));
const ForgeOsPage         = lazy(() => import("@/pages/forgeos"));
const CountryLanding      = lazy(() => import("@/pages/CountryLanding"));
// DEV-only Case File OS gallery. import.meta.env.DEV is statically replaced by
// Vite, so this whole branch (and its chunk) is tree-shaken out of prod builds.
const DesignSystem        = import.meta.env.DEV ? lazy(() => import("@/pages/design-system")) : null;

// Layout pulls in framer-motion. It only wraps the authenticated app routes —
// never the public homepage/landing/login — so lazy-load it to keep
// framer-motion (~40 KiB gz) out of the initial bundle on first paint.
const Layout = lazy(() =>
  import("@/components/layout").then((m) => ({ default: m.Layout })),
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 2, staleTime: 30000 },
  },
});

function PageLoader() {
  return (
    <div className="h-full flex items-center justify-center py-32">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );
}

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!loading && !user) {
      // Persist the intended destination so login can redirect back after auth
      try {
        const dest = `${window.location.pathname}${window.location.search}${window.location.hash}`;
        if (dest && !["/login", "/register", "/signup"].includes(window.location.pathname)) {
          sessionStorage.setItem("lf_return_to", dest);
        }
      } catch { /* ignore */ }
      setLocation("/login");
    }
  }, [user, loading, setLocation]);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }
  if (!user) return null;
  return <Component />;
}

function WorkspaceRoute() {
  const { user, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (!user) return <WorkspaceDemoPreview />;
  // An advocate's directory profile is a required onboarding step before they
  // can create a Workspace. Preserve the intended destination for completion.
  if (!user.is_demo && (user.role === "advocate" || user.role === "lawyer") && !user.lawyer_status) {
    try {
      const destination = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      sessionStorage.setItem("lf_return_to", destination);
    } catch { /* ignore */ }
    return <Redirect to="/lawyers/register" />;
  }
  return <ForgeWorkspace />;
}

function SignupRedirect() {
  return <Redirect to={`/register${window.location.search}`} />;
}

function errorRoute(section: string, Component: React.ComponentType) {
  return function StableErrorRoute() {
    return <ErrorBoundary section={section}><Component /></ErrorBoundary>;
  };
}

function protectedRoute(Component: React.ComponentType) {
  return function StableProtectedRoute() {
    return <ProtectedRoute component={Component} />;
  };
}

function protectedErrorRoute(section: string, Component: React.ComponentType) {
  return function StableProtectedErrorRoute() {
    return <ErrorBoundary section={section}><ProtectedRoute component={Component} /></ErrorBoundary>;
  };
}

const UsDemandLetterRoute = errorRoute("us-demand-letter", UsDemandLetter);
const SettingsRoute = protectedRoute(AccountSettings);
const ClientDashboardRoute = protectedRoute(ClientDashboard);
const LawyerDashboardRoute = protectedRoute(LawyerDashboard);
const SubscriptionRoute = errorRoute("subscription", Subscription);
const AskRoute = errorRoute("ask", Ask);
const ReviewRoute = errorRoute("review", Review);
const JudgmentDetailRoute = errorRoute("judgment-detail", JudgmentDetail);
const JudgmentsRoute = errorRoute("judgments", Judgments);
const LawyerRegistrationRoute = protectedErrorRoute("lawyer-registration", LawyersPage);
const CityLawyersRoute = errorRoute("city-lawyers", CityPage);
const LawyersRoute = errorRoute("lawyers", LawyersPage);
const LegalAidRoute = errorRoute("legal-aid", LegalAid);
const PostCaseRoute = protectedErrorRoute("post-case", PostCase);
const CaseDetailRoute = protectedErrorRoute("case-detail", CaseDetail);
const MyCasesRoute = protectedErrorRoute("my-cases", MyCases);
const MatchesRoute = protectedErrorRoute("matches", Matches);
const DocumentsRoute = protectedErrorRoute("documents", DocumentsPage);
const LegalChatRoute = protectedErrorRoute("legal-chat", LegalChat);
const FreeDocumentsRoute = errorRoute("free-documents", FreeDocuments);
const DocumentTemplateRoute = errorRoute("document-template", DocumentTemplatePage);
const BlogRoute = errorRoute("blog", Blog);
const BlogPostRoute = errorRoute("blog-post", BlogPost);
const AdminRoute = protectedErrorRoute("admin", AdminPage);
const ForgeOsRoute = protectedErrorRoute("forgeos", ForgeOsPage);
const StableWorkspaceRoute = errorRoute("workspace", WorkspaceRoute);
const MessagesRoute = protectedErrorRoute("messages", MessagesPage);
const CnrTrackerRoute = errorRoute("cnr-tracker", CnrTracker);

function ForLawyersRoute() {
  return <CountryLanding countryCode={(getCountryFromPath() || "in").toUpperCase()} />;
}

// Country root (e.g. /in, /us): logged-in users go straight to their dashboard;
// everyone else sees the country-specific public dashboard.
function CountryRoot() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!loading && user) {
      setLocation((user.role === "lawyer" || user.role === "advocate") ? "/lawyer-dashboard" : "/client-dashboard");
    }
  }, [user, loading, setLocation]);

  if (loading || user) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }
  return <CountryLanding countryCode={(getCountryFromPath() || "in").toUpperCase()} />;
}

// IP geolocation is slow (~4s). We cache the detected country so we only pay
// that cost once per day, and never on the critical first-paint path.
const DETECT_CACHE_KEY = "country_detected";
const DETECT_TTL_MS = 24 * 60 * 60 * 1000; // 24h

function readFreshDetectedCountry(): string | null {
  try {
    const raw = localStorage.getItem(DETECT_CACHE_KEY);
    if (!raw) return null;
    const { code, ts } = JSON.parse(raw) as { code?: string; ts?: number };
    if (code && ts && isValidCountry(code) && Date.now() - ts < DETECT_TTL_MS) {
      return code.toLowerCase();
    }
  } catch {
    /* ignore malformed cache */
  }
  return null;
}

// Best country we can determine *synchronously*, so the hero paints instantly
// without ever waiting on the network: URL segment → alias → saved manual
// choice → fresh cached detection → India default.
function resolveInitialCountry(): string {
  const fromPath = getCountryFromPath();
  if (fromPath) return fromPath.toLowerCase();
  const alias = getCountryAliasFromPath();
  if (alias && isValidCountry(alias)) return alias.toLowerCase();
  const stored = (localStorage.getItem("country_override") || "").toLowerCase();
  if (isValidCountry(stored)) return stored;
  const detected = readFreshDetectedCountry();
  if (detected) return detected;
  return "in";
}

// Ensures a valid country code is always present as the first URL segment.
// Renders immediately with the best synchronously-known country, then runs IP
// detection in the background (after first paint) and updates silently. This
// removes the geolocation request from the critical rendering path.
function CountryGate({ children }: { children: (code: string) => React.ReactNode }) {
  // Did the visitor explicitly ask for a country (URL segment or alias)?
  // Captured before we rewrite the URL, so background detection only runs for
  // ambiguous first visits to the bare root.
  const explicitRef = useRef<boolean>(
    Boolean(getCountryFromPath() || getCountryAliasFromPath()),
  );
  const [country, setCountry] = useState<string>(() => resolveInitialCountry());

  // 1) Guarantee the URL carries a valid country prefix — synchronously, no
  //    network wait — so the router mounts and the hero paints right away.
  useEffect(() => {
    if (getCountryFromPath()) return;
    // Read the alias BEFORE rewriting the URL — replaceState canonicalizes
    // /uae → /ae, after which getCountryAliasFromPath() would return null.
    const alias = getCountryAliasFromPath();
    const rel = getPathWithoutCountry();
    window.history.replaceState(
      null,
      "",
      buildCountryUrl(country, rel) + window.location.search + window.location.hash,
    );
    // A friendly alias like /uae or /usa is an explicit choice — persist it.
    if (alias && isValidCountry(alias)) {
      localStorage.setItem("country_override", country.toUpperCase());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2) Background IP detection — runs AFTER first paint, never blocks it. Only
  //    for ambiguous first visits (no explicit URL/alias, no saved manual
  //    choice, no fresh cached detection). Updates the page silently.
  useEffect(() => {
    if (explicitRef.current) return;
    const manual = (localStorage.getItem("country_override") || "").toLowerCase();
    if (isValidCountry(manual)) return; // a manual choice always wins
    if (readFreshDetectedCountry()) return; // detected < 24h ago

    let cancelled = false;
    fetch("/litigaforge/api/country-detect")
      .then((r) => r.json())
      .then((d) => {
        const raw = (d.country_code || "in").toLowerCase();
        const valid = isValidCountry(raw) ? raw : "in";
        try {
          localStorage.setItem(
            DETECT_CACHE_KEY,
            JSON.stringify({ code: valid, ts: Date.now() }),
          );
        } catch {
          /* ignore storage quota errors */
        }
        if (cancelled) return;
        // Only swap if the user hasn't picked a country since mount and the
        // detected one differs from what we optimistically rendered.
        const pickedSince = (localStorage.getItem("country_override") || "").toLowerCase();
        if (
          !isValidCountry(pickedSince) &&
          getCountryFromPath()?.toLowerCase() === country &&
          valid !== country
        ) {
          const rel = getPathWithoutCountry();
          window.history.replaceState(
            null,
            "",
            buildCountryUrl(valid, rel) + window.location.search + window.location.hash,
          );
          setCountry(valid);
          window.dispatchEvent(new Event("lf-country-change"));
        }
      })
      .catch(() => {
        /* offline / detection failed — keep the optimistic country */
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 3) Keep the router base in sync with the URL country segment so switching
  //    country (or browser back/forward) re-renders without a full page reload.
  useEffect(() => {
    const sync = () => {
      const c = getCountryFromPath();
      if (c) setCountry(c.toLowerCase());
    };
    window.addEventListener("popstate", sync);
    window.addEventListener("lf-country-change", sync);
    return () => {
      window.removeEventListener("popstate", sync);
      window.removeEventListener("lf-country-change", sync);
    };
  }, []);

  return <>{children(country.toLowerCase())}</>;
}

function Router() {
  const { user, loading } = useAuth();
  const [location, setLocation] = useLocation();

  useEffect(() => {
    // wouter location is relative to the country base (e.g. "/login" under /in)
    if (!loading && user && (location === "/login" || location === "/register")) {
      setLocation("/");
    }
  }, [user, loading, location, setLocation]);

  return (
    <Suspense fallback={<PageLoader />}>
      <Switch>
        {/* Legacy marketing route consolidated into the single country-aware
            homepage. Redirect preserves any inbound links / SEO. */}
        <Route path="/landing"><Redirect to="/" /></Route>
        <Route path="/demo" component={DemoPage} />
        {import.meta.env.DEV && DesignSystem && (
          <Route path="/design-system" component={DesignSystem} />
        )}
        <Route path="/privacy" component={PrivacyPolicy} />
        <Route path="/privacy-policy" component={PrivacyPolicy} />
        <Route path="/terms" component={TermsOfService} />
        <Route path="/about" component={About} />
        <Route path="/contact" component={Contact} />
        <Route path="/digest" component={Digest} />
        <Route path="/profile/:username/research" component={ProfileResearch} />
        <Route path="/refund-policy" component={RefundPolicy} />
        <Route path="/us-demand-letter" component={UsDemandLetterRoute} />
        <Route path="/settings" component={SettingsRoute} />
        <Route path="/login" component={Login} />
        <Route path="/register" component={Login} />
        <Route path="/signup" component={SignupRedirect} />
        <Route path="/forgot-password" component={ForgotPassword} />
        <Route path="/verify-email" component={VerifyEmail} />
        <Route path="/reset-password" component={ResetPassword} />
        <Route path="/" component={CountryRoot} />
        <Route>
          <Layout>
            <Switch>
              <Route path="/client-dashboard" component={ClientDashboardRoute} />
              <Route path="/lawyer-dashboard" component={LawyerDashboardRoute} />
              <Route path="/subscription" component={SubscriptionRoute} />
              <Route path="/ask" component={AskRoute} />
              <Route path="/review" component={ReviewRoute} />
              <Route path="/judgments/:court/:year/:slug" component={JudgmentDetailRoute} />
              <Route path="/judgments" component={JudgmentsRoute} />
              <Route path="/for-lawyers" component={ForLawyersRoute} />
              <Route path="/lawyers/register" component={LawyerRegistrationRoute} />
              <Route path="/lawyers/:city" component={CityLawyersRoute} />
              <Route path="/lawyers" component={LawyersRoute} />
              <Route path="/legal-aid" component={LegalAidRoute} />
              <Route path="/post-case" component={PostCaseRoute} />
              <Route path="/my-cases/:id" component={CaseDetailRoute} />
              <Route path="/my-cases" component={MyCasesRoute} />
              <Route path="/matches" component={MatchesRoute} />
              <Route path="/documents" component={DocumentsRoute} />
              <Route path="/legal-chat" component={LegalChatRoute} />
              <Route path="/free-documents" component={FreeDocumentsRoute} />
              <Route path="/free-documents/:slug" component={DocumentTemplateRoute} />
              <Route path="/document-template/:slug" component={DocumentTemplateRoute} />
              <Route path="/blog" component={BlogRoute} />
              <Route path="/blog/:slug" component={BlogPostRoute} />
              <Route path="/admin" component={AdminRoute} />
              <Route path="/forgeos" component={ForgeOsRoute} />
              <Route path="/workspace" component={StableWorkspaceRoute} />
              <Route path="/messages" component={MessagesRoute} />
              <Route path="/cnr-tracker" component={CnrTrackerRoute} />
              <Route path="/cnr"><Redirect to="/cnr-tracker" /></Route>
              <Route component={NotFound} />
            </Switch>
          </Layout>
        </Route>
      </Switch>
    </Suspense>
  );
}

function Analytics() {
  const [location] = useLocation();
  useEffect(() => {
    initRecaptcha();
    loadGoogleIdentity().catch(() => {});
  }, []);
  // GA4 is loaded/configured by the inline snippet in index.html; here we just
  // send a page_view on every route change (wouter location is relative to the
  // country base, e.g. "/ask" under /in). Fires on mount too, covering the
  // first load since index.html now uses send_page_view:false.
  useEffect(() => { trackPageView(location); }, [location]);
  return null;
}

function FirstVisitDisclaimer() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const seen = localStorage.getItem("lf_disclaimer_seen");
    if (!seen) setShow(true);
  }, []);

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-card border border-card-border rounded-xl shadow-2xl max-w-lg w-full p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
            <ShieldAlert className="w-5 h-5 text-amber-700 dark:text-amber-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground">Platform Disclaimer</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Before using LitigaForge AI, please acknowledge the following.
            </p>
          </div>
        </div>

        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-lg p-4">
          <p className="text-sm text-amber-900 dark:text-amber-300 leading-relaxed">
            This platform <strong>only connects users</strong> with lawyers. The final attorney-client relationship is <strong>directly between client and lawyer</strong>. We provide legal information, not legal advice. All AI outputs should be verified by a qualified lawyer.
          </p>
        </div>

        <button
          onClick={() => {
            localStorage.setItem("lf_disclaimer_seen", "1");
            setShow(false);
          }}
          className="w-full bg-primary text-primary-foreground font-medium py-2.5 rounded-lg hover:bg-primary/90 transition-colors"
          data-testid="disclaimer-acknowledge"
        >
          I Understand &mdash; Continue
        </button>
      </div>
    </div>
  );
}

function App() {
  return (
    <ThemeProvider defaultTheme="light" storageKey="vite-ui-theme">
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <AuthProvider>
            <CountryGate>
              {(country) => (
                <WouterRouter base={`${getAppBase()}/${country}`} aroundNav={viewTransitionAroundNav}>
                  <SEOHelmet />
                  <SkipLink />
                  <KeyboardShortcuts />
                  <GlobalCommandPalette />
                  <Analytics />
                  <InstallPrompt />
                  {/* <FirstVisitDisclaimer /> */}
                  <Router />
                </WouterRouter>
              )}
            </CountryGate>
          </AuthProvider>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
