import { useState } from 'react';
import { useRouter } from 'next/router';

export default function AdminLogin() {
  const router = useRouter();
  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');

  const handleChange = e => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async e => {
    e.preventDefault();
    setError('');
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (res.ok && data.success) {
      router.replace('/admin/dashboard');
    } else {
      setError(data.message || 'Login failed');
    }
  };

  return (
    <div className="main-container">
      <div className="card" style={{ maxWidth: '360px', margin: '0 auto' }}>
        <h1 className="heading-lg">Admin Login</h1>
        <form onSubmit={handleSubmit}>
          <input
            className="input"
            name="username"
            placeholder="Username"
            value={form.username}
            onChange={handleChange}
            required
          />
          <input
            className="input"
            type="password"
            name="password"
            placeholder="Password"
            value={form.password}
            onChange={handleChange}
            required
          />
          <button className="button button-primary" type="submit">
            Log In
          </button>
        </form>
        {error && <p className="text-secondary">{error}</p>}
      </div>
    </div>
  );
}
