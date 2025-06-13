// pages/admin/index.js
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { auth as firebaseAuth, db } from '../../lib/firebaseClient';
import { signInWithEmailAndPassword, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import Head from 'next/head';

export default function AdminLogin() {
  const router = useRouter();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
      if (user) {
        try {
          const userDocRef = doc(db, 'users', user.uid);
          const userDocSnap = await getDoc(userDocRef);

          if (userDocSnap.exists() && userDocSnap.data()?.isAdmin) {
            router.replace('/admin/dashboard');
          } else {
            await firebaseAuth.signOut();
            setError('You do not have administrative privileges.');
            setLoading(false);
          }
        } catch (e) {
          setError('Failed to verify admin status.');
          await firebaseAuth.signOut();
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

      const userDocRef = doc(db, 'users', user.uid);
      const userDocSnap = await getDoc(userDocRef);

      if (userDocSnap.exists() && userDocSnap.data()?.isAdmin) {
        router.push('/admin/dashboard');
      } else {
        await firebaseAuth.signOut();
        setError('Invalid credentials or you do not have administrative privileges.');
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
    } finally {
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