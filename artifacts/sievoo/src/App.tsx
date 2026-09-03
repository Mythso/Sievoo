import { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import {
  Route,
  Switch,
  useLocation,
  Router as WouterRouter,
} from 'wouter';

import { Layout } from '@/components/Layout';
import NotFound from '@/pages/not-found';
import Home from '@/pages/Home';
import Calculator from '@/pages/Calculator';
import GrahamCalculator from '@/pages/GrahamCalculator';
import Fire from '@/pages/Fire';
import Portfolio from '@/pages/Portfolio';
import Academy from '@/pages/Academy';
import Article from '@/pages/Article';
import Contact from '@/pages/Contact';
import Admin from '@/pages/Admin';
import Legal from '@/pages/Legal';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function Router() {
  return (
    <Layout>
      <RoutedErrorBoundary>
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/calculator" component={Calculator} />
          <Route path="/graham-calculator" component={GrahamCalculator} />
          <Route path="/fire" component={Fire} />
          <Route path="/portfolio" component={Portfolio} />
          <Route path="/academy" component={Academy} />
          <Route path="/academy/:slug" component={Article} />
          <Route path="/contact" component={Contact} />
          <Route path="/admin" component={Admin} />
          <Route path="/privacy">
            {() => <Legal page="privacy" />}
          </Route>
          <Route path="/terms">
            {() => <Legal page="terms" />}
          </Route>
          <Route path="/about">
            {() => <Legal page="about" />}
          </Route>
          <Route path="/disclaimer">
            {() => <Legal page="disclaimer" />}
          </Route>
          <Route component={NotFound} />
        </Switch>
      </RoutedErrorBoundary>
    </Layout>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={300}>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
