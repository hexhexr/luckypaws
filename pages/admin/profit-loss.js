// pages/admin/profit-loss.js
import { useState, useEffect } from 'react';
import { db } from '../../lib/firebaseClient';
import Link from 'next/link';

export default function ProfitLossPage() {
  const [entries, setEntries] = useState([]);
  const [form, setForm] = useState({ facebookUrl: '', type: 'deposit', amount: '' });
  const [search, setSearch] = useState('');
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchEntries();
  }, []);

  const fetchEntries = async () => {
    try {
      const snapshot = await db.collection('pl_entries').orderBy('timestamp', 'desc').get();
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setEntries(data);
    } catch (err) {
      console.error('Error fetching entries:', err);
    }
  };

  const handleChange = e => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const extractFbUsername = url => {
    const match = url.match(/facebook\.com\/(?:profile\.php\?id=)?([\w\.]+)/);
    return match ? match[1] : null;
  };

  const getFbName = async username => {
    try {
      const res = await fetch(`https://graph.facebook.com/${username}?fields=name&access_token=undefined`);
      const data = await res.json();
      return data.name || username;
    } catch {
      return username;
    }
  };

  const handleAddEntry = async e => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const username = extractFbUsername(form.facebookUrl);
      const fbImage = `https://graph.facebook.com/${username}/picture?type=large`;
      const fbName = await getFbName(username);
      const payload = {
        facebookUrl: form.facebookUrl,
        fbName,
        fbImage,
        type: form.type,
        amount: parseFloat(form.amount),
        timestamp: new Date().toISOString(),
      };
      await db.collection('pl_entries').add(payload);
      setForm({ facebookUrl: '', type: 'deposit', amount: '' });
      await fetchEntries();
    } catch (error) {
      console.error('Failed to add entry:', error);
    }
    setSubmitting(false);
  };

  const users = [...new Set(entries.map(e => e.facebookUrl))].map(url => {
    const userEntries = entries.filter(e => e.facebookUrl === url);
    const deposits = userEntries.filter(e => e.type === 'deposit').reduce((sum, e) => sum + e.amount, 0);
    const cashouts = userEntries.filter(e => e.type === 'cashout').reduce((sum, e) => sum + e.amount, 0);
    const net = deposits - cashouts;
    return {
      url,
      fbName: userEntries[0]?.fbName,
      fbImage: userEntries[0]?.fbImage,
      deposits,
      cashouts,
      net,
      entries: userEntries,
    };
  });

  useEffect(() => {
    const q = search.toLowerCase();
    const list = users.filter(u => u.fbName.toLowerCase().includes(q) || u.url.toLowerCase().includes(q));
    setFilteredUsers(list);
  }, [search, entries]);

  return (
    <div className="pl-section">
      <nav className="sidebar-menu">
        <Link href="/admin/dashboard" className="nav-btn">📊 Dashboard</Link>
        <Link href="/admin/profit-loss" className="nav-btn active">💰 Profit & Loss</Link>
      </nav>

      <h1>📈 Profit & Loss Checker</h1>

      <form onSubmit={handleAddEntry} className="entry-form">
        <input name="facebookUrl" value={form.facebookUrl} onChange={handleChange} placeholder="Facebook profile link" required />
        <input name="amount" type="number" value={form.amount} onChange={handleChange} placeholder="Amount" required />
        <select name="type" value={form.type} onChange={handleChange}>
          <option value="deposit">Deposit</option>
          <option value="cashout">Cashout</option>
        </select>
        <button className="btn" disabled={submitting}>{submitting ? 'Saving...' : 'Add Entry'}</button>
      </form>

      <div className="search-form">
        <input
          className="search"
          placeholder="Search user by name or URL..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <button className="btn" onClick={fetchEntries}>🔍 Search</button>
      </div>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Profile</th>
              <th>Name</th>
              <th>Deposits ($)</th>
              <th>Cashouts ($)</th>
              <th>Net</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map(user => (
              <tr key={user.url}>
                <td><img src={user.fbImage} alt={user.fbName} className="avatar" /></td>
                <td>{user.fbName}</td>
                <td>{user.deposits.toFixed(2)}</td>
                <td>{user.cashouts.toFixed(2)}</td>
                <td className={user.net >= 0 ? 'profit' : 'loss'}>
                  {user.net >= 0 ? `+${user.net.toFixed(2)}` : `-${Math.abs(user.net).toFixed(2)}`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
