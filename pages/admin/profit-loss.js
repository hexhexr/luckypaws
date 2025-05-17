// pages/admin/profit-loss.js
import { useState, useEffect } from 'react';
import { db } from '../../lib/firebaseClient';
import Link from 'next/link';

export default function ProfitLossPage() {
  const [entries, setEntries] = useState([]);
  const [form, setForm] = useState({ facebookUrl: '', type: 'deposit', amount: '' });
  const [search, setSearch] = useState('');
  const [filteredUsers, setFilteredUsers] = useState([]);

  useEffect(() => {
    fetchEntries();
  }, []);

  const fetchEntries = async () => {
    const snapshot = await db.collection('pl_entries').orderBy('timestamp', 'desc').get();
    const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    setEntries(data);
  };

  const handleChange = e => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const extractFbUsername = url => {
    const parts = url.split('/');
    return parts[parts.length - 1] || parts[parts.length - 2];
  };

  const handleAddEntry = async e => {
    e.preventDefault();
    const username = extractFbUsername(form.facebookUrl);
    const fbImage = `https://graph.facebook.com/${username}/picture?type=large`;
    const fbName = username;
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
    fetchEntries();
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
        <button className="btn">Add Entry</button>
      </form>

      <input className="search" placeholder="Search user by name or URL..." value={search} onChange={e => setSearch(e.target.value)} />

      <div className="user-list">
        {filteredUsers.map(user => (
          <div key={user.url} className="user-card">
            <img src={user.fbImage} alt={user.fbName} className="avatar" />
            <div>
              <strong>{user.fbName}</strong>
              <p>Total Deposits: ${user.deposits.toFixed(2)}</p>
              <p>Total Cashouts: ${user.cashouts.toFixed(2)}</p>
              <p>
                Net: <strong className={user.net >= 0 ? 'profit' : 'loss'}>
                  {user.net >= 0 ? `Profit +$${user.net.toFixed(2)}` : `Loss -$${Math.abs(user.net).toFixed(2)}`}
                </strong>
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
