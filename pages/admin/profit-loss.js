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
    {/* Keep this styled-jsx as it's specific to the skeleton's animation and appearance */}
    <style jsx>{`
      .loading-skeleton {
        padding: 1rem;
        border-radius: var(--radius-md); /* Consistent with card radius */
        background-color: var(--bg-light); /* Lighter background for skeleton */
        box-shadow: var(--shadow-sm); /* Subtle shadow */
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
      await loadData(); // Reload data after successful cashout
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
          fbUsername: entry.fbUsername // Assuming fbUsername is available
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
        <a className="nav-btn active" href="/admin/profit-loss">📊 Profit & Loss</a> {/* Added active class */}
        <button className="nav-btn" onClick={logout}>🚪 Logout</button>
      </div>

      <div className="main-content">
        <h2 className="section-title">📊 Profit & Loss Overview</h2>

        <div className="card summary-card"> {/* Added summary-card class for specific styling */}
          <h3 className="card-subtitle">📍 Overall Summary</h3>
          <div className="date-range-controls">
            <div className="date-input-group">
              <label htmlFor="fromDate">From:</label>
              <input type="date" id="fromDate" value={range.from} onChange={e => setRange(prev => ({ ...prev, from: e.target.value }))} />
            </div>
            <div className="date-input-group">
              <label htmlFor="toDate">To:</label>
              <input type="date" id="toDate" value={range.to} onChange={e => setRange(prev => ({ ...prev, to: e.target.value }))} />
            </div>
          </div>
          <div className="summary-numbers">
            <p>
              <span className="summary-deposit">Deposits: {formatCurrency(groupedData.overallDeposit)}</span>
            </p>
            <p>
              <span className="summary-cashout">Cashouts: {formatCurrency(groupedData.overallCashout)}</span>
            </p>
            <p className="summary-net">
              <strong className={ (groupedData.overallDeposit - groupedData.overallCashout) >= 0 ? 'text-success' : 'text-danger'}>
                Net: {formatCurrency(groupedData.overallDeposit - groupedData.overallCashout)}
              </strong>
            </p>
            <p>
              <span className="summary-margin">
                Margin: {groupedData.overallDeposit > 0 ? ((groupedData.overallDeposit - groupedData.overallCashout) / groupedData.overallDeposit * 100).toFixed(2) : '0'}%
              </span>
            </p>
          </div>
          <button onClick={exportToCSV} className="btn btn-secondary mt-md">Export to CSV</button> {/* mt-md for consistent spacing */}
        </div>

        <div className="card add-cashout-card"> {/* Added add-cashout-card class */}
          <h3 className="card-subtitle">💰 Add New Cashout</h3>
          <form onSubmit={handleAddCashout}>
            <div className="form-group">
              <label htmlFor="cashoutUsername">Username</label>
              <input
                className="input"
                id="cashoutUsername"
                placeholder="Enter username"
                value={newCashout.username}
                onChange={e => setNewCashout(prev => ({ ...prev, username: e.target.value }))}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="cashoutAmount">Amount (USD)</label>
              <input
                className="input"
                id="cashoutAmount"
                type="number"
                step="0.01"
                placeholder="e.g., 50.00"
                value={newCashout.amount}
                onChange={e => setNewCashout(prev => ({ ...prev, amount: e.target.value }))}
                required
              />
            </div>
            <button className="btn btn-primary" type="submit">Add Cashout</button>
          </form>
        </div>

        <input
          className="input search-input"
          placeholder="Search username..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />

        {error && <div className="alert alert-danger mt-md">{error}</div>}

        {loading ? (
          <LoadingSkeleton />
        ) : (
          <div className="user-profit-loss-list">
            {displayGroups.length === 0 ? (
              <p className="text-center mt-md">No data found for the selected range or search.</p>
            ) : (
              displayGroups.map(group => {
                const all = [...group.deposits, ...group.cashouts].sort((a, b) => new Date(b.time || b.created) - new Date(a.time || a.created));
                return (
                  <div key={group.username} className="card user-summary-card"> {/* Added user-summary-card */}
                    <h3 className="username-heading">
                      <a href={`/admin/customer/${group.username}`} className="username-link">
                        {group.username}
                      </a>
                    </h3>
                    {group.fbUsername && <p className="fb-username">FB: {group.fbUsername}</p>}
                    <p className="summary-line">
                      <span className="summary-deposit-individual">Deposit: {formatCurrency(group.totalDeposit)}</span>
                      <span className="summary-cashout-individual">Cashout: {formatCurrency(group.totalCashout)}</span>
                    </p>
                    <p className="summary-line">
                       <strong className={group.net >= 0 ? 'text-success' : 'text-danger'}>
                        {group.net >= 0 ? `Profit: ${formatCurrency(group.net)}` : `Loss: ${formatCurrency(Math.abs(group.net))}`}
                      </strong>
                      <span className="summary-margin-individual">Margin: {group.profitMargin}%</span>
                    </p>

                    <h4 className="transaction-history-title">Transaction History</h4>
                    <div className="table-responsive"> {/* Added for better table overflow */}
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
                            <tr key={entry.id} className={entry.type === 'deposit' ? 'deposit-row' : 'cashout-row'}>
                              <td className="transaction-type">{entry.type}</td>
                              <td className={`transaction-amount ${entry.type === 'deposit' ? 'text-success' : 'text-danger'}`}>
                                {formatCurrency(entry.amount)}
                              </td>
                              <td className="transaction-time">{new Date(entry.time || entry.created).toLocaleString()}</td>
                            </tr>
                          ))}
                          {all.length === 0 && (
                            <tr>
                                <td colSpan="3" className="text-center">No transactions found for this user in the selected range.</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
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