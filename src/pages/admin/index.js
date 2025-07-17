// pages/admin/index.js
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { auth as firebaseAuth } from '../../lib/firebaseClient';
import { signInWithEmailAndPassword, onAuthStateChanged } from 'firebase/auth';
import Head from 'next/head';

export default function AdminLogin() {
  const router = useRouter();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  // This function is the single source of truth for verifying admin privileges.
  const checkAdminStatus = async (user) => {
    try {
      // By passing `true`, we force a refresh of the ID token.
      // This ensures we get the latest custom claims set on the backend.
      const idTokenResult = await user.getIdTokenResult(true);
      
      // Check if the 'admin' claim is true in the token.
      if (idTokenResult.claims.admin) {
        return true;
      } else {
        return false;
      }
    } catch (e) {
      console.error("Failed to verify admin token:", e);
      return false;
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
      if (user) {
        const hasAdminPrivileges = await checkAdminStatus(user);
        if (hasAdminPrivileges) {
          router.replace('/admin/dashboard');
        } else {
          await firebaseAuth.signOut();
          setError('You do not have administrative privileges.');
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  const handleChange = e => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const userCredential = await signInWithEmailAndPassword(firebaseAuth, form.email, form.password);
      const user = userCredential.user;

      // After login, perform the same robust check.
      const hasAdminPrivileges = await checkAdminStatus(user);

      if (hasAdminPrivileges) {
        router.push('/admin/dashboard');
      } else {
        await firebaseAuth.signOut();
        setError('Invalid credentials or you do not have administrative privileges.');
        setLoading(false);
      }
    } catch (err) {
      console.error("Admin login error:", err.code);
      switch (err.code) {
        case 'auth/user-not-found':
        case 'auth/wrong-password':
        case 'auth/invalid-credential':
          setError('Invalid email or password.');
          break;
        default:
          setError('An unexpected error occurred during login.');
      }
      setLoading(false);
    }
  };

  if (loading && !error) {
    return (
      <div className="loading-screen">
        <p>Checking authentication...</p>
      </div>
    );
  }

  return (
    <div className="container mt-xl" style={{ maxWidth: '400px' }}>
        <Head><title>Admin Login</title></Head>
        <div className="card">
            <h2 className="card-header text-center">🔐 Admin Access</h2>
            <div className="card-body">
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label htmlFor="email">Email</label>
                        <input
                            id="email"
                            className="input"
                            name="email"
                            type="email"
                            placeholder="admin@example.com"
                            value={form.email}
                            onChange={handleChange}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="password">Password</label>
                        <input
                            id="password"
                            className="input"
                            name="password"
                            type="password"
                            placeholder="Password"
                            value={form.password}
                            onChange={handleChange}
                            required
                        />
                    </div>
                    <button className="btn btn-primary btn-full-width mt-md" type="submit" disabled={loading}>
                        {loading ? 'Logging in...' : 'Login'}
                    </button>
                </form>
                {error && <div className="alert alert-danger mt-md">{error}</div>}
            </div>
        </div>
    </div>
  );
}
