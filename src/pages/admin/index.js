// pages/admin/index.js
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';

export default function AdminLogin() {
  const router = useRouter();
  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');

  // No client-side localStorage check needed here on initial load,
  // as the redirect is handled by getServerSideProps on protected pages.
  // We keep this useEffect for redirection if already logged in and landing here directly.
  useEffect(() => {
    // Note: A more robust check here might involve a quick API call
    // or a server-side check on page load if this page itself needs
    // to redirect authenticated users without a refresh.
    // For now, this is a basic client-side redirect.
    const checkAuthAndRedirect = async () => {
      try {
        const res = await fetch('/api/admin/check-auth'); // You might need to create this API route
        if (res.ok) {
          router.replace('/admin/dashboard');
        }
      } catch (err) {
        // Not authenticated, stay on login page
      }
    };
    checkAuthAndRedirect();
  }, []);


  const handleChange = e => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setError('');
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Login failed');

      // Authentication is now handled by the HTTP-only cookie set by the API.
      // No client-side localStorage manipulation is needed here.
      router.push('/admin/dashboard');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="container mt-lg" style={{ maxWidth: '400px' }}>
      <div className="card">
        <h2 className="card-header text-center">🔐 Admin Access</h2>
        <form onSubmit={handleSubmit}>
          <label htmlFor="username">Username</label>
          <input
            id="username"
            className="input"
            name="username"
            placeholder="Admin username"
            value={form.username}
            onChange={handleChange}
            required
          />
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
          {error && <p className="error-message">{error}</p>}
          <button className="btn btn-primary mt-md" type="submit">Login</button>
        </form>
      </div>
    </div>
  );
}

// Optional: Add a simple API route for check-auth if the client-side useEffect needs it
// pages/api/admin/check-auth.js
/*
import { isAuthenticated } from '../../lib/auth';

export default function handler(req, res) {
  if (req.method === 'GET') {
    if (isAuthenticated(req)) {
      return res.status(200).json({ authenticated: true });
    } else {
      return res.status(401).json({ authenticated: false });
    }
  }
  return res.status(405).json({ message: 'Method not allowed' });
}
*/