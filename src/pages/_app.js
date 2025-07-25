// src/pages/_app.js
import '../styles/globals.css';
import ErrorBoundary from '../components/ErrorBoundary';
import { useRouter } from 'next/router';
import UnifiedChatController from '../components/UnifiedChatController';
import { auth } from '../lib/firebaseClient';
import { useEffect } from 'react';
import OfferBar from '../components/OfferBar'; // ADD THIS LINE to import the new component

function MyApp({ Component, pageProps }) {
  const router = useRouter();

  // --- ADD THIS FOR DEBUGGING ---
  // This code attaches the Firebase auth instance to the window object
  // so you can access it in the developer console for tasks like getting a token.
  // It will only run in the development environment.
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      window.firebaseAuth = auth;
      console.log("Firebase auth object attached to window.firebaseAuth for debugging.");
    }
  }, []);
  // --- END OF DEBUGGING CODE ---

  const noChatPages = [
    '/admin', // Correct path for pages/admin/index.js
    '/agent/login',
    '/404'
  ];

  const shouldRenderChatController = !noChatPages.includes(router.pathname);

  // FIX: Apply a theme class to the body to scope admin vs public styles
  const isAdminArea = router.pathname.startsWith('/admin') || router.pathname.startsWith('/agent');
  const themeClassName = isAdminArea ? 'admin-theme' : 'public-theme';

  return (
    <>
      <div className={themeClassName}>
        <ErrorBoundary>
          {!isAdminArea && <OfferBar />} {/* ADD THIS LINE to display the offer bar */}
          <Component {...pageProps} />
        </ErrorBoundary>
      </div>
      
      {shouldRenderChatController && <UnifiedChatController />}
    </>
  );
}

export default MyApp;