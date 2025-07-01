import '../styles/globals.css';
import ErrorBoundary from '../components/ErrorBoundary';
import { useRouter } from 'next/router';
import UnifiedChatController from '../components/UnifiedChatController';

function MyApp({ Component, pageProps }) {
  const router = useRouter();
  
  // This is the definitive fix for the login page issue.
  // The admin login page is at `/admin`, not `/admin/login`.
  const noChatPages = [
    '/admin', // Correct path for pages/admin/index.js
    '/agent/login',
    '/404'
  ];

  const shouldRenderChatController = !noChatPages.includes(router.pathname);

  const isAdminArea = router.pathname.startsWith('/admin') || router.pathname.startsWith('/agent');
  const themeClassName = isAdminArea ? 'admin-theme' : 'public-theme';

  return (
    <>
      <div className={themeClassName}>
        <ErrorBoundary>
          <Component {...pageProps} />
        </ErrorBoundary>
      </div>
      
      {shouldRenderChatController && <UnifiedChatController />}
    </>
  );
}

export default MyApp;