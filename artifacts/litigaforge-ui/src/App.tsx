import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/layout";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import Forge from "@/pages/forge";
import Cases from "@/pages/cases";
import CaseDetail from "@/pages/case-detail";
import Chains from "@/pages/chains";
import UseCases from "@/pages/use-cases";
import Login from "@/pages/login";
import Register from "@/pages/register";
import Subscription from "@/pages/subscription";
import AdvocateDashboard from "@/pages/advocate-dashboard";
import Templates from "@/pages/templates";
import Draft from "@/pages/draft";
import Research from "@/pages/research";
import NotFound from "@/pages/not-found";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";

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
      if (rel === "/login" || rel === "/register") {
        // Advocates go to dashboard, clients go to forge
        setLocation(user.user_type === "advocate" ? "/dashboard" : "/");
      }
    }
  }, [user, loading, setLocation]);

  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route>
        <Layout>
          <Switch>
            <Route path="/"          component={() => <ProtectedRoute component={Forge} />} />
            <Route path="/dashboard" component={() => <ProtectedRoute component={AdvocateDashboard} />} />
            <Route path="/templates" component={() => <ProtectedRoute component={Templates} />} />
            <Route path="/draft"     component={() => <ProtectedRoute component={Draft} />} />
            <Route path="/research"  component={() => <ProtectedRoute component={Research} />} />
            <Route path="/cases"     component={() => <ProtectedRoute component={Cases} />} />
            <Route path="/cases/:id" component={() => <ProtectedRoute component={CaseDetail} />} />
            <Route path="/chains"    component={() => <ProtectedRoute component={Chains} />} />
            <Route path="/use-cases" component={() => <ProtectedRoute component={UseCases} />} />
            <Route path="/subscription" component={() => <ProtectedRoute component={Subscription} />} />
            <Route component={NotFound} />
          </Switch>
        </Layout>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
        </AuthProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
