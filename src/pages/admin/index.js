// pages/admin/index.js
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { auth as firebaseAuth } from '../../lib/firebaseClient'; // Import client-side Firebase Auth

export default function AdminLogin() {
  const router = useRouter();
  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');

  useEffect(() => {
    // Check if the user is already authenticated via localStorage (Vercel-based)
    // AND if a Firebase user is already signed in (from a previous session)
    const adminAuthFlag = typeof window !== 'undefined' ? localStorage.getItem('admin_auth') : null;
    const unsubscribe = firebaseAuth.onAuthStateChanged(user => {
      if (adminAuthFlag === '1' && user) {
        router.replace('/admin/dashboard'); // Redirect if both flags are set
      }
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
      // 1. Make request to your custom Next.js API route for admin login
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Login failed');
      }

      // 2. If Vercel-based login is successful, get the custom token
      const customToken = data.token;
      if (!customToken) {
        throw new Error('No authentication token received.');
      }

      // 3. Sign into Firebase Authentication on the client-side using the custom token
      await firebaseAuth.signInWithCustomToken(customToken);

      // 4. Set the authentication flag in local storage (for Vercel-based state)
      localStorage.setItem('admin_auth', '1');
      
      console.log('Admin successfully logged in via custom token and redirected.');
      router.push('/admin/dashboard'); // Redirect to dashboard after successful login

    } catch (err) {
      console.error("Admin login error:", err);
      // Specific Firebase errors might be caught here if signInWithCustomToken fails
      if (err.code && err.message) {
        setError(`Firebase Auth Error: ${err.message}`);
      } else {
        setError(err.message);
      }
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
          <button className="btn btn-primary mt-md" type="submit">Login</button>
        </form>
        {error && <div className="alert alert-danger mt-md">{error}</div>}
      </div>
    </div>
  );
}
