// pages/admin/profit-loss.js
import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/router';
import { db } from '../../lib/firebaseClient'; // Ensure this path is correct

export default function ProfitLoss() {
  const router = useRouter();
  const [allData, setAllData] = useState([]); // Combined orders and cashouts
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [newCashout, setNewCashout] = useState({ username: '', amount: '' });
  const [range, setRange] = useState({
    from: new Date().toISOString().slice(0, 10),
    to: new Date().toISOString().slice(0, 10)
  });

  // Authentication check for admin pages
  useEffect(() => {
    if (typeof window !== 'undefined' && localStorage.getItem('admin_auth') !== '1') {
      router.replace('/admin'); // Redirect to the admin login page
    }
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      // Fetch paid orders (deposits)
      const orderSnap = await db.collection('orders').where('status', '==', 'paid').get();
      const depositList = orderSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        type: 'deposit',
        time: doc.data().created // Use 'created' for deposits
      }));

      // Fetch cashouts from 'profitLoss' collection with type 'cashout'
      const cashoutSnap = await db.collection('profitLoss').where('type', '==', 'cashout').get();
      const cashoutList = cashoutSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        type: 'cashout',
        time: doc.data().time || doc.data().created // Use 'time' or fallback to 'created'
      }));

      // Combine and sort by time/created
      const combined = [...depositList, ...cashoutList].sort((a, b) => new Date(b.time || b.created) - new Date(a.time || a.created));
      setAllData(combined);
    } catch (err) {
      console.error('Failed to load profit/loss data:', err);
      setError('⚠️ Failed to load profit/loss data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // Optional: Set up real-time listener or refresh interval if needed
    // const interval = setInterval(loadData, 10000); // Refresh every 10 seconds
    // return () => clearInterval(interval);
  }, []);


  const handleAddCashout = async (e) => {
    e.preventDefault();
    setError('');

    const username = newCashout.username.trim();
    const amount = parseFloat(newCashout.amount);

    if (!username || isNaN(amount) || amount <= 0) {
      setError('Please enter a valid username and a positive cashout amount.');
      return;
    }

    try {
      const res = await fetch('/api/admin/cashouts/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, amount }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to add cashout');
      }
      setNewCashout({ username: '', amount: '' }); // Clear form
      await loadData(); // Reload all data
    } catch (err) {
      console.error('Error adding cashout:', err);
      setError(`⚠️ Error adding cashout: ${err.message}`);
    }
  };

  // Group data by username and calculate totals, applying date range filter
  const groupedData = useMemo(() => {
    const fromDate = new Date(range.from);
    const toDate = new Date(range.to);
    toDate.setHours(23, 59, 59, 999); // Include full 'to' day

    const filtered = allData.filter(entry => {
      const entryDate = new Date(entry.time || entry.created);
      return entryDate >= fromDate && entryDate <= toDate;
    });

    const groups = {};
    let overallDeposit = 0;
    let overallCashout = 0;

    filtered.forEach(entry => {
      const uname = entry.username.toLowerCase();
      if (!groups[uname]) {
        groups[uname] = {
          username: entry.username, // Keep original casing
          deposits: [],
          cashouts: [],
          totalDeposit: 0,
          totalCashout: 0,
          fbUsername: entry.fbUsername // Assuming fbUsername is available on both
        };
      }

      if (entry.type === 'deposit') {
        groups[uname].deposits.push(entry);
        groups[uname].totalDeposit += parseFloat(entry.amount || 0);
        overallDeposit += parseFloat(entry.amount || 0);
      } else if (entry.type === 'cashout') {
        groups[uname].cashouts.push(entry);
        groups[uname].totalCashout += parseFloat(entry.amount || 0);
        overallCashout += parseFloat(entry.amount || 0);
      }
    });

    // Convert to array and sort by username
    const sortedGroups = Object.values(groups).sort((a, b) =>
      a.username.localeCompare(b.username)
    );

    return { sortedGroups, overallDeposit, overallCashout };
  }, [allData, range]); // Re-calculate when allData or range changes

  const displayGroups = groupedData.sortedGroups.filter(group =>
    group.username.toLowerCase().includes(search.toLowerCase())
  );

  const logout = async () => {
    try {
      await fetch('/api/admin/logout', { method: 'POST' });
    } catch (err) {
      console.error('Logout API error:', err);
    } finally {
      localStorage.removeItem('admin_auth');
      router.replace('/admin');
    }
  };


  return (
    <div className="admin-dashboard">
      <div className="sidebar">
        <h1>Lucky Paw Admin</h1>
        <a className="nav-btn" href="/admin/dashboard">📋 Orders</a>
        <a className="nav-btn" href="/admin/games">🎮 Games</a>
        <a className="nav-btn" href="/admin/profit-loss">📊 Profit & Loss</a>
        <button className="nav-btn" onClick={logout}>🚪 Logout</button>
      </div>

      <div className="main-content">
        <h2 className="text-center mt-lg">📊 Profit & Loss</h2>

        <div className="card mt-md" style={{ background: '#f9f9f9', border: '1px solid #ddd', padding: '1rem', borderRadius: '12px' }}>
          <h3>📍 Overall Summary (Date Range)</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginBottom: '0.5rem' }}>
            <div>
              From: <input type="date" value={range.from} onChange={e => setRange(prev => ({ ...prev, from: e.target.value }))} />
            </div>
            <div>
              To: <input type="date" value={range.to} onChange={e => setRange(prev => ({ ...prev, to: e.target.value }))} />
            </div>
          </div>
          <div>
            <span style={{ color: '#2ecc71' }}>Total Deposits: <strong><span class="math-inline">\{groupedData\.overallDeposit\.toFixed\(2\)\}</strong\></span\> \{' \| '\}
<span style\=\{\{ color\: '\#e74c3c' \}\}\>Total Cashouts\: <strong\></span>{groupedData.overallCashout.toFixed(2)}</strong></span> {' | '}
            <strong style={{ color: (groupedData.overallDeposit - groupedData.overallCashout) >= 0 ? 'green' : 'red' }}>
              Net: ${((groupedData.overallDeposit - groupedData.overallCashout)).toFixed(2)}
            </strong>
          </div>
        </div>

        {/* Add Cashout Form */}
        <div className="card mt-md">
          <h3>💰 Add New Cashout</h3>
          <form onSubmit={handleAddCashout} className="form-inline" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '0.5rem' }}>
            <input
              className="input"
              placeholder="Username"
              value={newCashout.username}
              onChange={(e) => setNewCashout(prev => ({ ...prev, username: e.target.value }))}
              required
            />
            <input
              className="input"
              type="number"
              step="0.01"
              placeholder="Amount (USD)"
              value={newCashout.amount}
              onChange={(e) => setNewCashout(prev => ({ ...prev, amount: e.target.value }))}
              required
            />
            <button className="btn btn-primary" type="submit">Add Cashout</button>
          </form>
        </div>


        <input
          className="input mt-md"
          placeholder="Search by username"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />

        {loading ? (
          <p className="text-center mt-md">Loading data...</p>
        ) : error ? (
          <div className="alert alert-danger mt-md">{error}</div>
        ) : (
          <div className="mt-md">
            {displayGroups.length === 0 ? (
              <p className="text-center">No data found for the selected criteria.</p>
            ) : (
              displayGroups.map((group) => {
                const all = [...group.deposits, ...group.cashouts].sort((a, b) => new Date(b.time || b.created) - new Date(a.time || a.created));
                const totalDeposit = group.totalDeposit;
                const totalCashout = group.totalCashout;
                const net = totalDeposit - totalCashout;
                const fb = group.fbUsername ? `FB: ${group.fbUsername}` : '';

                return (
                  <div key={group.username} className="card mt-md">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                      <h3 style={{ margin: 0 }}>
                        <a href={`/admin/customer/${group.username}`} style={{ color: '#0984e3', fontWeight: 600 }}>
                          {group.username}
                        </a>
                      </h3>
                      <div style={{ fontSize: '0.85rem', color: '#888' }}>{fb}</div>
                      <div>
                        {/* Corrected lines with template literals wrapped in curly braces */}
                        <span style={{ color: '#2ecc71' }}>{`Deposit: $${totalDeposit.toFixed(2)}`}</span>{' | '}
                        <span style={{ color: '#e74c3c' }}>{` Cashout: $${totalCashout.toFixed(2)}`}</span>{' | '}
                        <strong style={{ color: net >= 0 ? 'green' : 'red' }}>
                          {net >= 0 ? `Profit: $${net.toFixed(2)}` : `Loss: $${Math.abs(net).toFixed(2)}`}
                        </strong>
                      </div>
                    </div>

                    <table className="table mt-sm">
                      <thead>
                        <tr>
                          <th>Type</th>
                          <th>Amount</th>
                          <th>Time</th>
                        </tr>
                      </thead>
                      <tbody>
                        {all.map((entry, idx) => (
                          <tr key={idx}>
                            <td style={{ color: entry.type === 'deposit' ? 'green' : '#c0392b' }}>{entry.type}</td>
                            <td>${entry.amount}</td>
                            <td>{new Date(entry.time || entry.created).toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })}
            )}
          </div>
        )}
      </div>
    </div>
  );
}