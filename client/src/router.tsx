import { createBrowserRouter } from 'react-router';
import HomePage from './pages/HomePage';
import SessionPage, {
  ErrorBoundary as SessionErrorBoundary,
  clientLoader as sessionLoader,
} from './pages/SessionPage';

/**
 * Application Router Configuration
 *
 * Routes:
 * - / : HomePage - Start new generation
 * - /:sessionId/:tab? : SessionPage - View persisted session with optional tab (timeline/files/preview)
 */
export const router = createBrowserRouter([
  {
    path: '/',
    Component: HomePage,
  },
  {
    path: '/:sessionId/:tab?',
    Component: SessionPage,
    loader: sessionLoader,
    ErrorBoundary: SessionErrorBoundary,
  },
]);
