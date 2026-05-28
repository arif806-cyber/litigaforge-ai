import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/layout";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { ThemeProvider } from "@/lib/theme-provider";
import { lazy, Suspense, useEffect, useState } from "react";
import { Loader2, ShieldAlert } from "lucide-react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { SkipLink } from "@/components/SkipLink";
import { KeyboardShortcuts } from "@/components/KeyboardShortcuts";
import { SEOHelmet } from "@/components/SEOHelmet";

const Forge               = lazy(() => import("@/pages/forge"));
const Cases               = lazy(() => import("@/pages/cases"));
const CaseDetail          = lazy(() => import("@/pages/case-detail"));
const Chains              = lazy(() => import("@/pages/chains"));
const UseCases            = lazy(() => import("@/pages/use-cases"));
const Login               = lazy(() => import("@/pages/login"));
const Subscription        = lazy(() => import("@/pages/subscription"));
const Ask                 = lazy(() => import("@/pages/ask"));
const Review              = lazy(() => import("@/pages/review"));
const Judgments           = lazy(() => import("@/pages/judgments"));
const LawyersPage         = lazy(() => import("@/pages/lawyers"));
const LegalAid            = lazy(() => import("@/pages/legal-aid"));
const NotFound            = lazy(() => import("@/pages/not-found"));
const PostCase            = lazy(() => import("@/pages/post-case"));
const MyCases             = lazy(() => import("@/pages/my-cases"));
const Matches             = lazy(() => import("@/pages/matches"));
const LegalChat           = lazy(() => import("@/pages/legal-chat"));
const AdminPage           = lazy(() => import("@/pages/admin"));
const LawyerDashboard     = lazy(() => import("@/pages/lawyer-dashboard"));
const ClientDashboard     = lazy(() => import("@/pages/client-dashboard"));
const DocumentsPage       = lazy(() => import("@/pages/documents"));
const FreeDocuments       = lazy(() => import("@/pages/free-documents"));
const DocumentTemplatePage = lazy(() => import("@/pages/document-template"));

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
    if (!loading && !user) setLocation("/login");
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

function Router() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!loading && user) {
      const path = window.location.pathname;
      const base = import.meta.env.BASE_URL.replace(/\/$/, "");
      const rel = path.replace(base, "") || "/";
      if (rel === "/login" || rel === "/register") setLocation("/");
    }
  }, [user, loading, setLocation]);

  return (
    <Suspense fallback={<PageLoader />}>
      <Switch>
        <Route path="/login" component={Login} />
        <Route path="/register" component={Login} />
        <Route>
          <Layout>
            <Switch>
              <Route path="/"             component={() => <ProtectedRoute component={Forge} />} />
              <Route path="/client-dashboard" component={() => <ProtectedRoute component={ClientDashboard} />} />
              <Route path="/lawyer-dashboard" component={() => <ProtectedRoute component={LawyerDashboard} />} />
              <Route path="/cases"        component={() => <ErrorBoundary section="cases"><Cases /></ErrorBoundary>} />
              <Route path="/cases/:id"    component={() => <ErrorBoundary section="case-detail"><ProtectedRoute component={CaseDetail} /></ErrorBoundary>} />
              <Route path="/chains"       component={() => <ErrorBoundary section="chains"><Chains /></ErrorBoundary>} />
              <Route path="/use-cases"    component={() => <ErrorBoundary section="use-cases"><UseCases /></ErrorBoundary>} />
              <Route path="/subscription" component={() => <ErrorBoundary section="subscription"><Subscription /></ErrorBoundary>} />
              <Route path="/ask"          component={() => <ErrorBoundary section="ask"><Ask /></ErrorBoundary>} />
              <Route path="/review"       component={() => <ErrorBoundary section="review"><Review /></ErrorBoundary>} />
              <Route path="/judgments"    component={() => <ErrorBoundary section="judgments"><Judgments /></ErrorBoundary>} />
              <Route path="/lawyers"      component={() => <ErrorBoundary section="lawyers"><LawyersPage /></ErrorBoundary>} />
              <Route path="/legal-aid"    component={() => <ErrorBoundary section="legal-aid"><LegalAid /></ErrorBoundary>} />
              <Route path="/post-case"    component={() => <ErrorBoundary section="post-case"><ProtectedRoute component={PostCase} /></ErrorBoundary>} />
              <Route path="/my-cases"     component={() => <ErrorBoundary section="my-cases"><ProtectedRoute component={MyCases} /></ErrorBoundary>} />
              <Route path="/matches"      component={() => <ErrorBoundary section="matches"><ProtectedRoute component={Matches} /></ErrorBoundary>} />
              <Route path="/documents"    component={() => <ErrorBoundary section="documents"><ProtectedRoute component={DocumentsPage} /></ErrorBoundary>} />
              <Route path="/legal-chat"   component={() => <ErrorBoundary section="legal-chat"><ProtectedRoute component={LegalChat} /></ErrorBoundary>} />
              <Route path="/free-documents" component={() => <ErrorBoundary section="free-documents"><FreeDocuments /></ErrorBoundary>} />
              <Route path="/free-documents/:slug" component={() => <ErrorBoundary section="document-template"><DocumentTemplatePage /></ErrorBoundary>} />
              <Route path="/document-template/:slug" component={() => <ErrorBoundary section="document-template"><DocumentTemplatePage /></ErrorBoundary>} />
              <Route path="/admin"         component={() => <ErrorBoundary section="admin"><ProtectedRoute component={AdminPage} /></ErrorBoundary>} />
              <Route component={NotFound} />
            </Switch>
          </Layout>
        </Route>
      </Switch>
    </Suspense>
  );
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
            This platform <strong>only connects users</strong> with lawyers. The final attorney-client relationship is <strong>directly between client and lawyer</strong>. We are <strong>not providing legal advice</strong>. All AI outputs should be verified by a qualified lawyer.
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
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <SEOHelmet />
              <SkipLink />
              <KeyboardShortcuts />
              {/* <FirstVisitDisclaimer /> */}
              <Router />
            </WouterRouter>
          </AuthProvider>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
