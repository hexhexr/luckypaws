import { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/router';
import { db } from '../../lib/firebaseClient';
import { fetchProfitLossData, addCashout } from '../../services/profitLossService';

const formatCurrency = (amount) => {
  const numAmount = parseFloat(amount);
  return isNaN(numAmount) ? '$0.00' : `$${numAmount.toFixed(2)}`;
};

const LoadingSkeleton = () => (
  <div className="loading-skeleton mt-md">
    <div className="skeleton-line" style={{ width: '80%' }}></div>
    <div className="skeleton-line" style={{ width: '90%' }}></div>
    <div className="skeleton-line" style={{ width: '70%' }}></div>
    <div className="skeleton-line" style={{ width: '85%' }}></div>
    <style jsx>{`
      .loading-skeleton {
        padding: 1rem;
        border-radius: 8px;
        background-color: #f0f0f0;
      }
      .skeleton-line {
        height: 1.2em;
        background: linear-gradient(90deg, #e0e0e0 25%, #f0f0f0 50%, #e0e0e0 75%);
        background-size: 200% 100%;
        animation: loading 1.5s infinite;
        margin-bottom: 0.5rem;
        border-radius: 4px;
      }
      @keyframes loading {
        0% { background-position: 200% 0; }
        100% { background-position: -200% 0; }
      }
    `}</style>
  </div>
);

export default function ProfitLoss() {
  const router = useRouter();
  const [allData, setAllData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [newCashout, setNewCashout] = useState({ username: '', amount: '' });
  const [range, setRange] = useState({
    from: new Date().toISOString().slice(0, 10),
    to: new Date().toISOString().slice(0, 10)
  });

  useEffect(() => {
    if (typeof window !== 'undefined' && localStorage.getItem('admin_auth') !== '1') {
      router.replace('/admin');
    }
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const combined = await fetchProfitLossData();
      setAllData(combined);
    } catch (err) {
      setError('⚠️ Failed to load data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAddCashout = async (e) => {
    e.preventDefault();
    setError('');

    const username = newCashout.username.trim();
    const amount = parseFloat(newCashout.amount);
    if (!username || isNaN(amount) || amount <= 0) {
      setError('Please enter a valid username and amount');
      return;
    }

    try {
      await addCashout(username, amount);
      setNewCashout({ username: '', amount: '' });
      await loadData();
    } catch (err) {
      console.error(err);
      setError('⚠️ Failed to add cashout.');
    }
  };

  const groupedData = useMemo(() => {
    const fromDate = new Date(range.from);
    const toDate = new Date(range.to);
    toDate.setHours(23, 59, 59, 999);

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
          username: entry.username,
          deposits: [],
          cashouts: [],
          totalDeposit: 0,
          totalCashout: 0,
          net: 0,
          profitMargin: 0,
          fbUsername: entry.fbUsername
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

    Object.values(groups).forEach(group => {
      group.net = group.totalDeposit - group.totalCashout;
      group.profitMargin = group.totalDeposit > 0
        ? ((group.net / group.totalDeposit) * 100).toFixed(2)
        : 0;
    });

    const sortedGroups = Object.values(groups).sort((a, b) =>
      a.username.localeCompare(b.username)
    );

    return { sortedGroups, overallDeposit, overallCashout };
  }, [allData, range]);

  const displayGroups = groupedData.sortedGroups.filter(group =>
    group.username.toLowerCase().includes(search.toLowerCase())
  );

  const logout = async () => {
    try {
      await fetch('/api/admin/logout', { method: 'POST' });
    } catch (err) {
      console.error(err);
    } finally {
      localStorage.removeItem('admin_auth');
      router.replace('/admin');
    }
  };

  const exportToCSV = () => {
    const headers = ['Username', 'Facebook Username', 'Total Deposits', 'Total Cashouts', 'Net Profit/Loss', 'Profit Margin (%)'];
    const rows = displayGroups.map(group => [
      group.username,
      group.fbUsername || 'N/A',
      group.totalDeposit.toFixed(2),
      group.totalCashout.toFixed(2),
      group.net.toFixed(2),
      group.profitMargin
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(e => e.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `profit_loss_${range.from}_to_${range.to}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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

        <div className="card mt-md">
          <h3>📍 Overall Summary</h3>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <div>
              From: <input type="date" value={range.from} onChange={e => setRange(prev => ({ ...prev, from: e.target.value }))} />
            </div>
            <div>
              To: <input type="date" value={range.to} onChange={e => setRange(prev => ({ ...prev, to: e.target.value }))} />
            </div>
          </div>
          <div>
            <span style={{ color: '#2ecc71' }}>Total Deposits: {formatCurrency(groupedData.overallDeposit)}</span>{' | '}
            <span style={{ color: '#e74c3c' }}>Total Cashouts: {formatCurrency(groupedData.overallCashout)}</span>{' | '}
            <strong style={{ color: (groupedData.overallDeposit - groupedData.overallCashout) >= 0 ? 'green' : 'red' }}>
              Net: {formatCurrency(groupedData.overallDeposit - groupedData.overallCashout)}
            </strong>{' | '}
            <span style={{ color: '#0984e3' }}>
              Margin: {groupedData.overallDeposit > 0 ? ((groupedData.overallDeposit - groupedData.overallCashout) / groupedData.overallDeposit * 100).toFixed(2) : '0'}%
            </span>
          </div>
          <button onClick={exportToCSV} className="btn btn-secondary mt-sm">Export to CSV</button>
        </div>

        <div className="card mt-md">
          <h3>💰 Add Cashout</h3>
          <form onSubmit={handleAddCashout}>
            <input
              className="input"
              placeholder="Username"
              value={newCashout.username}
              onChange={e => setNewCashout(prev => ({ ...prev, username: e.target.value }))}
              required
            />
            <input
              className="input"
              type="number"
              step="0.01"
              placeholder="Amount (USD)"
              value={newCashout.amount}
              onChange={e => setNewCashout(prev => ({ ...prev, amount: e.target.value }))}
              required
            />
            <button className="btn btn-primary" type="submit">Add Cashout</button>
          </form>
        </div>

        <input
          className="input mt-md"
          placeholder="Search username"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />

        {loading ? (
          <LoadingSkeleton />
        ) : error ? (
          <div className="alert alert-danger mt-md">{error}</div>
        ) : (
          <div className="mt-md">
            {displayGroups.length === 0 ? (
              <p className="text-center">No data found</p>
            ) : (
              displayGroups.map(group => {
                const all = [...group.deposits, ...group.cashouts].sort((a, b) => new Date(b.time || b.created) - new Date(a.time || a.created));
                return (
                  <div key={group.username} className="card mt-md">
                    <h3>
                      <a href={`/admin/customer/${group.username}`} style={{ color: '#0984e3' }}>{group.username}</a>
                    </h3>
                    <p style={{ color: '#888' }}>{group.fbUsername ? `FB: ${group.fbUsername}` : ''}</p>
                    <p>
                      <span style={{ color: '#2ecc71' }}>Deposit: {formatCurrency(group.totalDeposit)}</span> {' | '}
                      <span style={{ color: '#e74c3c' }}>Cashout: {formatCurrency(group.totalCashout)}</span> {' | '}
                      <strong style={{ color: group.net >= 0 ? 'green' : 'red' }}>
                        {group.net >= 0 ? `Profit: ${formatCurrency(group.net)}` : `Loss: ${formatCurrency(Math.abs(group.net))}`}
                      </strong>{' | '}
                      <span style={{ color: '#0984e3' }}>Margin: {group.profitMargin}%</span>
                    </p>
                    <table className="table mt-sm">
                      <thead>
                        <tr>
                          <th>Type</th>
                          <th>Amount</th>
                          <th>Time</th>
                        </tr>
                      </thead>
                      <tbody>
                        {all.map(entry => (
                          <tr key={entry.id}>
                            <td style={{ color: entry.type === 'deposit' ? 'green' : '#c0392b' }}>{entry.type}</td>
                            <td>{formatCurrency(entry.amount)}</td>
                            <td>{new Date(entry.time || entry.created).toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}
