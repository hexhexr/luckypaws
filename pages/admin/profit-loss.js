import { useEffect, useState } from 'react';
import { db } from '../../lib/firebaseClient';

export default function ProfitLoss() {
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({ fbUrl: '', type: 'deposit', amount: '' });
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

  const extractUsername = (url) => {
    const match = url.match(/facebook\.com\/([^/?#]+)/i);
    return match ? match[1] : '';
  };

  const extractImage = (url) => {
    const username = extractUsername(url);
    return `https://graph.facebook.com/${username}/picture?type=large`;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const username = extractUsername(form.fbUrl);
    const image = extractImage(form.fbUrl);
    if (!username || !form.amount) {
      setError('Invalid input');
      return;
    }

    const ref = db.collection('pl-users').doc(username);
    await ref.set(
      {
        username,
        image,
        fbUrl: form.fbUrl,
        entries: [],
      },
      { merge: true }
    );

    await ref.update({
      entries: db.FieldValue.arrayUnion({
        type: form.type,
        amount: parseFloat(form.amount),
        date: new Date().toISOString(),
      }),
    });

    setForm({ fbUrl: '', type: 'deposit', amount: '' });
    loadUsers();
  };

  const loadUsers = async () => {
    const snap = await db.collection('pl-users').get();
    const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    setUsers(list);
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const getProfitLoss = (entries) => {
    let deposits = 0, cashouts = 0;
    entries.forEach(e => {
      if (e.type === 'deposit') deposits += e.amount;
      else cashouts += e.amount;
    });
    return deposits - cashouts;
  };

  const filtered = users.filter(u =>
    u.username.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="admin-dashboard">
      <div className="sidebar">
        <h1>Lucky Paw Admin</h1>
        <a className="nav-btn" href="/admin/dashboard">📋 Orders</a>
        <a className="nav-btn" href="/admin/games">🎮 Games</a>
        <a className="nav-btn" href="/admin/profit-loss">📊 Profit & Loss</a>
      </div>
      <div className="main-content">
        <h2 className="text-center mt-lg">📊 Profit / Loss Tracker</h2>

        <form onSubmit={handleSubmit}>
          <input className="input" placeholder="Facebook profile URL" name="fbUrl" value={form.fbUrl} onChange={handleChange} required />
          <input className="input" type="number" placeholder="Amount" name="amount" value={form.amount} onChange={handleChange} required />
          <select className="select" name="type" value={form.type} onChange={handleChange}>
            <option value="deposit">Deposit</option>
            <option value="cashout">Cashout</option>
          </select>
          <button className="btn btn-primary mt-md" type="submit">Submit</button>
        </form>

        {error && <div className="alert alert-danger mt-md">{error}</div>}

        <input className="input mt-md" placeholder="Search username" value={search} onChange={e => setSearch(e.target.value)} />

        <div className="card mt-lg">
          {filtered.map(user => {
            const total = getProfitLoss(user.entries);
            return (
              <div key={user.id} style={{ marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <img src={user.image} alt="dp" width="60" height="60" style={{ borderRadius: '50%' }} />
                  <div>
                    <strong>{user.username}</strong><br />
                    Profit/Loss: <span style={{ color: total >= 0 ? 'green' : 'red' }}>
                      {total >= 0 ? `+${total.toFixed(2)}` : total.toFixed(2)}
                    </span>
                  </div>
                </div>
                <ul style={{ marginTop: '0.5rem' }}>
                  {user.entries.map((e, i) => (
                    <li key={i}>
                      {e.type.toUpperCase()}: ${e.amount} on {new Date(e.date).toLocaleString()}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
