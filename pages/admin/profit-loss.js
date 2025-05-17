// pages/admin/profit-loss.js
import { useState, useEffect } from 'react';
import Link from 'next/link';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import { db } from '../../lib/firebaseClient';

export default function ProfitLossPage() {
  const [entries, setEntries] = useState([]);
  const [customersMap, setCustomersMap] = useState({});
  const [form, setForm] = useState({ facebookUrl: '', type: 'deposit', amount: '' });
  const [search, setSearch] = useState('');
  const [sortOption, setSortOption] = useState('default');
  const [submitting, setSubmitting] = useState(false);

  // Load PL entries and linked customers
  const fetchData = async () => {
    const entrySnap = await db.collection('pl_entries').orderBy('timestamp', 'desc').get();
    const entryData = entrySnap.docs.map(d => ({ id: d.id, ...d.data() }));
    setEntries(entryData);

    const customerIds = [...new Set(entryData.map(e => e.customerId))];
    if (customerIds.length) {
      const batches = [];
      while (customerIds.length) {
        batches.push(customerIds.splice(0, 10));
      }
      const map = {};
      await Promise.all(batches.map(async batchIds => {
        const snap = await db.collection('customers')
          .where(firebase.firestore.FieldPath.documentId(), 'in', batchIds)
          .get();
        snap.docs.forEach(d => map[d.id] = d.data());
      }));
      setCustomersMap(map);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleChange = e => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const extractFbUsername = url => {
    const m = url.match(/facebook\.com\/(?:profile\.php\?id=)?([\w\.]+)/);
    return m ? m[1] : url;
  };

  const handleAddEntry = async e => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const url = form.facebookUrl.trim();
      const username = extractFbUsername(url);
      const avatarUrl = `https://graph.facebook.com/${username}/picture?type=large`;

      // Upsert customer
      const custQuery = await db.collection('customers')
        .where('facebookUrl', '==', url)
        .limit(1)
        .get();

      let customerId;

      if (!custQuery.empty) {
        customerId = custQuery.docs[0].id;
      } else {
        const ref = await db.collection('customers').add({
          facebookUrl: url,
          displayName: username,
          avatarUrl,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        customerId = ref.id;
      }

      // Add PL entry
      await db.collection('pl_entries').add({
        customerId,
        type: form.type,
        amount: parseFloat(form.amount),
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
      });

      setForm({ facebookUrl: '', type: 'deposit', amount: '' });
      await fetchData();
    } catch (err) {
      console.error('Error adding PL entry:', err);
    }
    setSubmitting(false);
  };

  const users = Object.values(entries.reduce((acc, e) => {
    const { customerId } = e;
    if (!acc[customerId]) acc[customerId] = [];
    acc[customerId].push(e);
    return acc;
  }, {})).map(group => {
    const { customerId } = group[0];
    const customer = customersMap[customerId] || {};
    const deposits = group.filter(e => e.type === 'deposit').reduce((s, e) => s + e.amount, 0);
    const cashouts = group.filter(e => e.type === 'cashout').reduce((s, e) => s + e.amount, 0);
    return {
      customerId,
      displayName: customer.displayName || extractFbUsername(group[0].facebookUrl),
      avatarUrl: customer.avatarUrl,
      deposits,
      cashouts,
      net: deposits - cashouts
    };
  });

  const filtered = users
    .filter(u => u.displayName.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sortOption === 'profit') return b.net - a.net;
      if (sortOption === 'loss') return a.net - b.net;
      return 0;
    });

  return (
    <div className="pl-section">
      <nav className="sidebar-menu">
        <Link href="/admin/dashboard"><a className="nav-btn">📊 Dashboard</a></Link>
        <Link href="/admin/profit-loss"><a className="nav-btn active">💰 Profit & Loss</a></Link>
        <Link href="/admin/games"><a className="nav-btn">🎮 Manage Games</a></Link>
      </nav>

      <h1>📈 Profit & Loss Checker</h1>

      <form onSubmit={handleAddEntry} className="entry-form">
        <input
          name="facebookUrl"
          value={form.facebookUrl}
          onChange={handleChange}
          placeholder="Facebook profile URL"
          required
        />
        <input
          name="amount"
          type="number"
          value={form.amount}
          onChange={handleChange}
          placeholder="Amount"
          required
        />
        <select name="type" value={form.type} onChange={handleChange}>
          <option value="deposit">Deposit</option>
          <option value="cashout">Cashout</option>
        </select>
        <button className="btn" disabled={submitting}>{submitting ? 'Saving…' : 'Add Entry'}</button>
      </form>

      <div className="search-form">
        <input
          className="search"
          placeholder="Search customer..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select value={sortOption} onChange={e => setSortOption(e.target.value)} style={{ marginLeft: '1rem' }}>
          <option value="default">Sort: Default</option>
          <option value="profit">Profit High → Low</option>
          <option value="loss">Loss High → Low</option>
        </select>
      </div>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Avatar</th>
              <th>Name</th>
              <th>Deposits</th>
              <th>Cashouts</th>
              <th>Net</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(u => (
              <tr key={u.customerId}>
                <td><img src={u.avatarUrl} alt="" className="avatar" /></td>
                <td>{u.displayName}</td>
                <td>${u.deposits.toFixed(2)}</td>
                <td>${u.cashouts.toFixed(2)}</td>
                <td className={u.net >= 0 ? 'profit' : 'loss'}>
                  {u.net >= 0 ? `+$${u.net.toFixed(2)}` : `-$${Math.abs(u.net).toFixed(2)}`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
