// src/pages/agent/login.js
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { auth as firebaseAuth, db } from '../../lib/firebaseClient';
import { signInWithEmailAndPassword, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

export default function AgentLogin() {
  const router = useRouter();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  // This effect handles redirection if a user is already logged in
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
      if (user) {
        // User is signed in, check their role.
        try {
          const userDocRef = doc(db, 'users', user.uid);
          const userDocSnap = await getDoc(userDocRef);

          if (userDocSnap.exists() && userDocSnap.data()?.agent) {
            // If they are an agent, redirect to the agent dashboard.
            router.replace('/agent');
          } else {
            // If they are not an agent (e.g., an admin or regular user), sign them out from this portal.
            await firebaseAuth.signOut();
            setError('You do not have agent privileges.');
            setLoading(false);
          }
        } catch (e) {
          setError('Failed to verify agent status.');
          await firebaseAuth.signOut();
          setLoading(false);
        }
      } else {
        // No user is signed in, show the login form.
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
      // Use Firebase's standard sign-in method
      const userCredential = await signInWithEmailAndPassword(firebaseAuth, form.email, form.password);
      const user = userCredential.user;

      // After successful Firebase Auth login, verify their role from Firestore
      const userDocRef = doc(db, 'users', user.uid);
      const userDocSnap = await getDoc(userDocRef);

      if (userDocSnap.exists() && userDocSnap.data()?.agent) {
        // If the role is 'agent', redirect to the agent dashboard
        router.push('/agent');
      } else {
        // If the user logs in but is not an agent, sign them out and show an error.
        await firebaseAuth.signOut();
        setError('Invalid credentials or you do not have agent privileges.');
        setLoading(false);
      }
    } catch (err) {
      console.error("Agent login error:", err.code);
      setError('Invalid email or password.');
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="loading-screen">
        <p>Checking authentication...</p>
      </div>
    );
  }

  return (
    <div className="container mt-xl" style={{ maxWidth: '400px' }}>
      <Head><title>Agent Login</title></Head>
      <div className="card">
        <h2 className="card-header text-center">🤝 Agent Portal Login</h2>
        <div className="card-body">
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                className="input"
                name="email"
                type="email"
                placeholder="agent@example.com"
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