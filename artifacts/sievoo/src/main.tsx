import { createRoot } from 'react-dom/client';

import { setAuthTokenGetter } from '@workspace/api-client-react';

import App from './App';
import { getToken } from '@/lib/auth';
import { ErrorBoundary } from '@/components/error-boundary';

import './index.css';

// The session token lives in localStorage (not a cookie), so the generated
// API client attaches it as a bearer token on every request.
setAuthTokenGetter(() => getToken());

createRoot(document.getElementById('root')!, {
  // Keeps caught errors off reportError(), which would raise the dev overlay.
  onCaughtError: (error, errorInfo) => {
    console.error(error, errorInfo.componentStack);
  },
}).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);
