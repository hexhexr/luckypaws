// Admin login page component (e.g., pages/admin/login.js)
import firebase from 'firebase/app';
import 'firebase/auth';
import 'firebase/firestore';
import { useState } from 'react';
import { useRouter } from 'next/router';
// Ensure your firebaseClient config is imported and initialized

const AdminLoginPage = () => {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleGoogleLogin = async () => {
    setLoading(true);
    setErrorMessage('');
    const provider = new firebase.auth.GoogleAuthProvider();
    try {
      const result = await firebase.auth().signInWithPopup(provider);
      const user = result.user; // This is the Firebase Auth user object

      // STEP 1: Get the ID token immediately after sign-in
      const idToken = await user.getIdToken();

      // STEP 2: Send ID token to your new server-side API to set custom claims
      const response = await fetch('/api/auth/set-admin-claim', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`, // Send the token for server verification
        },
      });

      const data = await response.json();

      if (!response.ok) {
        // If server says access denied, it means this Gmail is not the super admin
        await firebase.auth().signOut(); // Log out the user
        setErrorMessage(data.message || 'Login failed due to authorization.');
        return;
      }

      // STEP 3: Force a token refresh so the new custom claims are loaded
      await user.getIdToken(true); // 'true' forces a refresh

      // STEP 4: Now, check if the user actually has the admin claim locally
      // (This is redundant if set-admin-claim API confirms success, but good for robust checks)
      const decodedToken = await user.getIdTokenResult();
      if (decodedToken.claims.role === 'admin') {
        router.push('/admin/dashboard'); // Redirect to admin dashboard
      } else {
        await firebase.auth().signOut();
        setErrorMessage('Access Denied: Your account does not have administrator privileges. (Claim not set)');
      }

    } catch (error) {
      console.error("Admin Google login failed:", error);
      setErrorMessage("Login failed: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1>Admin Login</h1>
      <button onClick={handleGoogleLogin} disabled={loading}>
        {loading ? 'Logging in...' : 'Sign in with Google (Admin)'}
      </button>
      {errorMessage && <p style={{ color: 'red' }}>{errorMessage}</p>}
    </div>
  );
};

export default AdminLoginPage;