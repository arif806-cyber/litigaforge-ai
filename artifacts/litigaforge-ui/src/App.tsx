import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/layout";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { ThemeProvider } from "@/lib/theme-provider";
import Forge from "@/pages/forge";
import Cases from "@/pages/cases";
import CaseDetail from "@/pages/case-detail";
import Chains from "@/pages/chains";
import UseCases from "@/pages/use-cases";
import Login from "@/pages/login";
import Register from "@/pages/register";
import Subscription from "@/pages/subscription";
import Ask from "@/pages/ask";
import Review from "@/pages/review";
import Judgments from "@/pages/judgments";
import LawyersPage from "@/pages/lawyers";
import LegalAid from "@/pages/legal-aid";
import NotFound from "@/pages/not-found";
import { Loader2, ShieldAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { LegalDisclaimerBanner } from "@/components/legal-disclaimer";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 10000 },
  },
});

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
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route>
        <Layout>
          <Switch>
            <Route path="/"             component={() => <ProtectedRoute component={Forge} />} />
            <Route path="/cases"        component={() => <ProtectedRoute component={Cases} />} />
            <Route path="/cases/:id"    component={() => <ProtectedRoute component={CaseDetail} />} />
            <Route path="/chains"       component={Chains} />
            <Route path="/use-cases"    component={UseCases} />
            <Route path="/subscription" component={Subscription} />
            <Route path="/ask"          component={Ask} />
            <Route path="/review"       component={Review} />
            <Route path="/judgments"    component={Judgments} />
            <Route path="/lawyers"      component={LawyersPage} />
            <Route path="/legal-aid"    component={LegalAid} />
            <Route component={NotFound} />
          </Switch>
        </Layout>
      </Route>
    </Switch>
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
            <h3 className="text-lg font-semibold text-foreground">Legal Disclaimer</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Before using LitigaForge AI, please acknowledge the following.
            </p>
          </div>
        </div>

        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-lg p-4">
          <p className="text-sm text-amber-900 dark:text-amber-300 leading-relaxed">
            This is an <strong>AI assistant only</strong>. All outputs should be verified by a qualified lawyer. <strong>Not a substitute for professional legal advice.</strong> No attorney-client relationship is created by using this platform.
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
              <FirstVisitDisclaimer />
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
