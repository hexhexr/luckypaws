// pages/admin/index.js
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';

export default function AdminLogin() {
  const router = useRouter();
  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');

  // No localStorage check needed here, the getServerSideProps will handle redirection on protected pages.
  // This page is the login page itself.

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
      // No localStorage.setItem needed here, the cookie is handled by the API response.
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
          {error && <p className="text-danger mt-md text-center">{error}</p>}
        </form>
      </div>
    </div>
  );
}