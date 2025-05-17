import { useState } from 'react';
import { useRouter } from 'next/router';

export default function AdminLogin() {
  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const router = useRouter();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
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

      router.push('/admin/dashboard');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="container mt-lg">
      <div className="card">
        <h2 className="card-header text-center">🔐 Admin Login</h2>
        <form onSubmit={handleSubmit}>
          <label>Username</label>
          <input
            className="input"
            name="username"
            value={form.username}
            onChange={handleChange}
            placeholder="Enter admin username"
            required
          />
          <label>Password</label>
          <input
            className="input"
            name="password"
            type="password"
            value={form.password}
            onChange={handleChange}
            placeholder="Enter password"
            required
          />
          <button className="btn btn-primary mt-md" type="submit">Login</button>
          {error && <div className="alert alert-danger mt-md">{error}</div>}
        </form>
      </div>
    </div>
  );
}
