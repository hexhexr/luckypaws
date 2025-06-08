// pages/admin/index.js
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { auth as firebaseAuth } from '../../lib/firebaseClient'; // Import client-side Firebase Auth

export default function AdminLogin() {
  const router = useRouter();
  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');

  useEffect(() => {
    // Rely solely on Firebase Auth state for redirection
    const unsubscribe = firebaseAuth.onAuthStateChanged(user => {
      if (user) {
        // User is signed in, redirect to dashboard
        router.replace('/admin/dashboard');
      }
      // If no user, stay on login page
    });

    return () => unsubscribe(); // Clean up auth listener
  }, [router]);

  const handleChange = e => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setError(''); // Clear previous errors

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (res.ok && data.token) {
        // Sign in to Firebase Authentication with the custom token received from your API
        await firebaseAuth.signInWithCustomToken(data.token);
        console.log('Admin successfully logged in via custom token. The onAuthStateChanged listener will handle the redirect.');
        // The onAuthStateChanged listener in this component will now trigger the redirect.
      } else {
        setError(data.error || 'Login failed. Please check your credentials.');
      }
    } catch (err) {
      console.error('Admin login error:', err);
      // More user-friendly error messages based on network or API issues
      setError(err.message || 'An unexpected error occurred during login.');
    }
  };

  return (
    <div className="container mt-lg" style={{ maxWidth: '400px' }}>
      <div className="card">
        <h2 className="card-header text-center">🔐 Admin Access</h2>
        <form onSubmit={handleSubmit}>
          <label>Username</label>
          <input
            className="input"
            name="username"
            placeholder="Admin username"
            value={form.username}
            onChange={handleChange}
            required
          />
          <label>Password</label>
          <input
            className="input"
            name="password"
            type="password"
            placeholder="Password"
            value={form.password}
            onChange={handleChange}
            required
          />
          <button className="btn btn-primary mt-md" type="submit" disabled={!form.username || !form.password}>
            Login
          </button>
        </form>
        {error && <div className="alert alert-danger mt-md">{error}</div>}
      </div>
    </div>
  );
}