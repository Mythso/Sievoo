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
import { SeoHead } from '@/components/SeoHead';
import NotFound from '@/pages/not-found';
import Home from '@/pages/Home';
import Calculator from '@/pages/Calculator';
import GrahamCalculator from '@/pages/GrahamCalculator';
import Fire from '@/pages/Fire';
import Portfolio from '@/pages/Portfolio';
import Watchlist from '@/pages/Watchlist';
import Academy from '@/pages/Academy';
import Article from '@/pages/Article';
import Contact from '@/pages/Contact';
import Admin from '@/pages/Admin';
import Account from '@/pages/Account';
import Legal from '@/pages/Legal';
import Stocks from '@/pages/Stocks';
import Stock from '@/pages/Stock';
import AnalysisDetail from '@/pages/AnalysisDetail';
import Profile from '@/pages/Profile';
import TrackRecord from '@/pages/TrackRecord';
import { LanguageProvider } from '@/lib/i18n';

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
      <SeoHead />
      <RoutedErrorBoundary>
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/calculator" component={Calculator} />
          <Route path="/graham-calculator" component={GrahamCalculator} />
          <Route path="/fire" component={Fire} />
          <Route path="/portfolio" component={Portfolio} />
          <Route path="/watchlist" component={Watchlist} />
          <Route path="/stocks" component={Stocks} />
          <Route path="/stock/:ticker" component={Stock} />
          <Route path="/analysis/:id" component={AnalysisDetail} />
          <Route path="/u/:id" component={Profile} />
          <Route path="/track-record" component={TrackRecord} />
          <Route path="/academy" component={Academy} />
          <Route path="/academy/:slug" component={Article} />
          <Route path="/no/academy" component={Academy} />
          <Route path="/no/academy/:slug" component={Article} />
          <Route path="/contact" component={Contact} />
          <Route path="/admin" component={Admin} />
          <Route path="/account" component={Account} />
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
      <LanguageProvider>
      <TooltipProvider delayDuration={300}>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
}

export default App;
