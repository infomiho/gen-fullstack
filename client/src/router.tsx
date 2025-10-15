import { createBrowserRouter } from 'react-router';
import HomePage from './pages/HomePage';
import SessionPage, { clientLoader as sessionLoader } from './pages/SessionPage';

/**
 * Application Router Configuration
 *
 * Routes:
 * - / : HomePage - Start new generation
 * - /:sessionId : SessionPage - View persisted session with timeline (with clientLoader)
 */
export const router = createBrowserRouter([
  {
    path: '/',
    Component: HomePage,
  },
  {
    path: '/:sessionId',
    Component: SessionPage,
    loader: sessionLoader,
  },
]);
