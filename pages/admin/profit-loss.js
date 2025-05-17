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

  // 1️⃣ Load all PL entries and their customers
  const fetchData = async () => {
    // Fetch entries
    const entrySnap = await db.collection('pl_entries').orderBy('timestamp', 'desc').get();
    const entryData = entrySnap.docs.map(d => ({ id: d.id, ...d.data() }));
    setEntries(entryData);

    // Fetch customers for those entries
    const customerIds = [...new Set(entryData.map(e => e.customerId))];
    if (customerIds.length) {
      const batches = [];
      // Firestore 'in' supports up to 10, so batch if needed
      while (customerIds.length) {
        batches.push(customerIds.splice(0, 10));
      }
      const map = {};
      await Promise.all(batches.map(async batchIds => {
        const snap = await db
          .collection('customers')
          .where(firebase.firestore.FieldPath.documentId(), 'in', batchIds)
          .get();
        snap.docs.forEach(d => map[d.id] = d.data());
      }));
      setCustomersMap(map);
    }
  };

  useEffect(() => { fetchData(); }, []);

  // 2️⃣ Handle form changes
  const handleChange = e => {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
  };

  // 3️⃣ Utility: extract FB username
  const extractFbUsername = url => {
    const m = url.match(/facebook\.com\/(?:profile\.php\?id=)?([\w\.]+)/);
    return m ? m[1] : null;
  };

  // 4️⃣ Utility: fetch FB name once
  const getFbName = async username => {
    try {
      const token = process.env.NEXT_PUBLIC_FB_ACCESS_TOKEN;
      const res = await fetch(
        `https://graph.facebook.com/${username}?fields=name&access_token=${token}`
      );
      const data = await res.json();
      return data.name || username;
    } catch {
      return username;
    }
  };

  // 5️⃣ Add or upsert customer & then add PL entry
  const handleAddEntry = async e => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const url = form.facebookUrl.trim();
      const username = extractFbUsername(url);
      const avatarUrl = `https://graph.facebook.com/${username}/picture?type=large`;

      // Lookup existing customer
      const custQuery = await db
        .collection('customers')
        .where('facebookUrl', '==', url)
        .limit(1)
        .get();

      let customerId, displayName;

      if (!custQuery.empty) {
        // existing
        const doc = custQuery.docs[0];
        customerId = doc.id;
        displayName = doc.data().displayName;
      } else {
        // new: fetch name + create
        displayName = await getFbName(username);
        const ref = await db.collection('customers').add({
          facebookUrl: url,
          displayName,
          avatarUrl,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        customerId = ref.id;
      }

      // now add PL entry
      await db.collection('pl_entries').add({
        customerId,
        type: form.type,
        amount: parseFloat(form.amount),
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
      });

      setForm({ facebookUrl: '', type: 'deposit', amount: '' });
      await fetchData();
    } catch (err) {
      console.error('Error adding entry:', err);
      alert('Failed to add entry');
    }
    setSubmitting(false);
  };

  // 6️⃣ Build the display list
  const users = Object.values(entries.reduce((acc, e) => {
    const { customerId } = e;
    if (!acc[customerId]) acc[customerId] = { entries: [] };
    acc[customerId].entries.push(e);
    return acc;
  }, {})).map(({ entries }) => {
    const cid = entries[0].customerId;
    const customer = customersMap[cid] || {};
    const deposits = entries.filter(e => e.type==='deposit').reduce((s,e)=>s+e.amount,0);
    const cashouts = entries.filter(e => e.type==='cashout').reduce((s,e)=>s+e.amount,0);
    return {
      customerId: cid,
      displayName: customer.displayName || 'Unknown',
      avatarUrl: customer.avatarUrl,
      deposits,
      cashouts,
      net: deposits - cashouts
    };
  });

  // 7️⃣ Filter & sort
  const filtered = users
    .filter(u => u.displayName.toLowerCase().includes(search.toLowerCase()))
    .sort((a,b) => {
      if (sortOption==='profit') return b.net - a.net;
      if (sortOption==='loss') return a.net - b.net;
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
        <button className="btn" disabled={submitting}>
          {submitting ? 'Saving…' : 'Add Entry'}
        </button>
      </form>

      <div className="search-form">
        <input
          className="search"
          placeholder="Search customer..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select
          value={sortOption}
          onChange={e => setSortOption(e.target.value)}
          style={{marginLeft:'1rem'}}
        >
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
