// pages/admin/index.js
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { auth as firebaseAuth } from '../../lib/firebaseClient'; // Import client-side Firebase Auth
import { onAuthStateChanged } from 'firebase/auth'; // Explicitly import onAuthStateChanged for clarity
import axios from 'axios'; // For making API requests

export default function AdminLogin() {
  const router = useRouter();
  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false); // Add loading state

  useEffect(() => {
    // Rely solely on Firebase Auth state for redirection
    // This listener will trigger when the session cookie is verified by Firebase Auth
    const unsubscribe = onAuthStateChanged(firebaseAuth, user => {
      if (user) {
        // User is signed in (or session cookie is valid and logged in client-side)
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
    setLoading(true); // Set loading true

    try {
      // Call your backend API route for admin login
      const res = await axios.post('/api/admin/login', form);

      // If the API call is successful and a session cookie is set
      if (res.status === 200) {
        // Important: After the session cookie is set by the API,
        // Firebase Auth's onAuthStateChanged listener *might* not immediately pick it up client-side
        // for a full user object unless you explicitly sign in with a custom token.
        // For simplicity, we can force a client-side reload or redirect after success.
        // Or, if using custom tokens, sign in here.
        // Example if using custom tokens (after backend provides it in `res.data.token`):
        // await firebaseAuth.signInWithCustomToken(res.data.token);
        router.replace('/admin/dashboard'); // Redirect to dashboard
      } else {
        setError(res.data.message || 'Login failed. Please check your credentials.');
      }
    } catch (err) {
      console.error('Admin login error:', err);
      setError(err.response?.data?.message || 'An unexpected error occurred during login.');
    } finally {
      setLoading(false); // Set loading false
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
          <button
            className="btn btn-primary mt-md"
            type="submit"
            disabled={!form.username || !form.password || loading} // Disable button while loading
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>
        {error && <div className="alert alert-danger mt-md">{error}</div>}
      </div>
    </div>
  );
}