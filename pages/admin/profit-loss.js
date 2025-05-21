// pages/admin/profit-loss.js
import { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/router';
import { db } from '../../lib/firebaseClient'; // Assuming this path is correct and firebaseClient is configured
import { fetchProfitLossData, addCashout } from '../../services/profitLossService'; // NEW: Import service functions

// Helper for currency formatting for consistency (as suggested by best practices)
const formatCurrency = (amount) => {
  // Ensure amount is a number before formatting
  const numAmount = parseFloat(amount);
  if (isNaN(numAmount)) {
    return '$0.00'; // Default for invalid numbers
  }
  return `$${numAmount.toFixed(2)}`;
};

// Simple Loading Skeleton Component for improved UX during data loading (NEW)
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
  const = useState(); // Combined orders and cashouts
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const = useState('');
  const [newCashout, setNewCashout] = useState({ username: '', amount: '' });
  const = useState({
    from: new Date().toISOString().slice(0, 10),
    to: new Date().toISOString().slice(0, 10)
  });

  // Authentication check for admin pages
  useEffect(() => {
    if (typeof window!== 'undefined' && localStorage.getItem('admin_auth')!== '1') {
      router.replace('/admin'); // Redirect to the admin login page
    }
  },);

  // Refactored loadData to use the service layer (addresses "Tight Coupling of UI and Data Fetching Logic")
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(''); // Clear previous errors
    try {
      const combined = await fetchProfitLossData(); // Use the service function
      setAllData(combined);
    } catch (err) {
      console.error('Failed to load profit/loss data:', err);
      // Improved error message for better user feedback (addresses "Limited Scope of Error Handling")
      setError(`⚠️ ${err.message |
| 'Failed to load financial data. Please check your network connection.'}`);
    } finally {
      setLoading(false);
    }
  },); // No dependencies, so it's stable and won't cause re-renders

  useEffect(() => {
    loadData();
  },); // Depend on loadData to re-fetch when it changes (though it's useCallback'd)

  // Refactored handleAddCashout to use the service layer (addresses "Tight Coupling of UI and Data Fetching Logic")
  const handleAddCashout = async (e) => {
    e.preventDefault();
    setError(''); // Clear previous errors

    const username = newCashout.username.trim();
    const amount = parseFloat(newCashout.amount);

    // Robust runtime input validation (addresses "Lack of Robust Runtime Input Validation")
    if (!username |
| isNaN(amount) |
| amount <= 0) {
      setError('Please enter a valid username and a positive cashout amount.');
      return;
    }

    try {
      await addCashout(username, amount); // Use the service function
      setNewCashout({ username: '', amount: '' }); // Clear form
      await loadData(); // Reload all data to reflect the new cashout
    } catch (err) {
      console.error('Error adding cashout:', err);
      // Improved error message for better user feedback
      setError(`⚠️ ${err.message |
| 'Failed to add cashout.'}`);
    }
  };

  // Group data by username and calculate totals, applying date range filter
  const groupedData = useMemo(() => {
    const fromDate = new Date(range.from);
    const toDate = new Date(range.to);
    toDate.setHours(23, 59, 59, 999); // Include full 'to' day

    const filtered = allData.filter(entry => {
      const entryDate = new Date(entry.time |
| entry.created);
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
          deposits:,
          cashouts:,
          totalDeposit: 0,
          totalCashout: 0,
          net: 0, // Initialize net
          profitMargin: 0, // NEW: Initialize profitMargin for each user
          fbUsername: entry.fbUsername // Assuming fbUsername is available on both
        };
      }

      if (entry.type === 'deposit') {
        groups[uname].deposits.push(entry);
        groups[uname].totalDeposit += parseFloat(entry.amount |
| 0);
        overallDeposit += parseFloat(entry.amount |
| 0);
      } else if (entry.type === 'cashout') {
        groups[uname].cashouts.push(entry);
        groups[uname].totalCashout += parseFloat(entry.amount |
| 0);
        overallCashout += parseFloat(entry.amount |
| 0);
      }
    });

    // Calculate net and profit margin for each group (NEW: addresses "Critical Division by Zero")
    Object.values(groups).forEach(group => {
      group.net = group.totalDeposit - group.totalCashout;
      // Implement robust division by zero handling for profitMargin
      group.profitMargin = group.totalDeposit > 0
       ? ((group.net / group.totalDeposit) * 100).toFixed(2) // Format to 2 decimal places
        : 0; // If totalDeposit is 0, profit margin is 0
    });

    // Convert to array and sort by username
    const sortedGroups = Object.values(groups).sort((a, b) =>
      a.username.localeCompare(b.username)
    );

    return { sortedGroups, overallDeposit, overallCashout };
  },); // Re-calculate when allData or range changes

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

  // NEW FEATURE: CSV Export Functionality
  const exportToCSV = () => {
    const headers =;
    const rows = displayGroups.map(group =>);

    const csvContent = [
      headers.join(','),
     ...rows.map(e => e.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download!== undefined) { // feature detection for download attribute
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `profit_loss_report_${range.from}_to_${range.to}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
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
              From: <input type="date" value={range.from} onChange={e => setRange(prev => ({...prev, from: e.target.value }))} />
            </div>
            <div>
              To: <input type="date" value={range.to} onChange={e => setRange(prev => ({...prev, to: e.target.value }))} />
            </div>
          </div>
          <div>
            <span style={{ color: '#2ecc71' }}>Total Deposits: <strong>{formatCurrency(groupedData.overallDeposit)}</strong></span> {' | '}
            <span style={{ color: '#e74c3c' }}>Total Cashouts: <strong>{formatCurrency(groupedData.overallCashout)}</strong></span> {' | '}
            <strong style={{ color: (groupedData.overallDeposit - groupedData.overallCashout) >= 0? 'green' : 'red' }}>
              Net: {formatCurrency((groupedData.overallDeposit - groupedData.overallCashout))}
            </strong>
          </div>
          {/* NEW: Display Overall Profit Margin with division by zero handling */}
          <div>
            <span style={{ color: '#0984e3' }}>Overall Profit Margin: <strong>
              {groupedData.overallDeposit > 0
               ? `${((groupedData.overallDeposit - groupedData.overallCashout) / groupedData.overallDeposit * 100).toFixed(2)}%`
                : '0%'}
            </strong></span>
          </div>
          <button onClick={exportToCSV} className="btn btn-secondary mt-sm">Export to CSV</button> {/* NEW: Export Button */}
        </div>

        {/* Add Cashout Form */}
        <div className="card mt-md">
          <h3>💰 Add New Cashout</h3>
          <form onSubmit={handleAddCashout} className="form-inline" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '0.5rem' }}>
            <input
              className="input"
              placeholder="Username"
              value={newCashout.username}
              onChange={(e) => setNewCashout(prev => ({...prev, username: e.target.value }))}
              required
            />
            <input
              className="input"
              type="number"
              step="0.01"
              placeholder="Amount (USD)"
              value={newCashout.amount}
              onChange={(e) => setNewCashout(prev => ({...prev, amount: e.target.value }))}
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

        {loading? (
          <LoadingSkeleton /> // NEW: Use LoadingSkeleton for improved loading UX
        ) : error? (
          <div className="alert alert-danger mt-md">{error}</div> {/* Improved error display */}
        ) : (
          <div className="mt-md">
            {displayGroups.length === 0? (
              <p className="text-center">No data found for the selected criteria.</p>
            ) : (
              displayGroups.map((group) => {
                // Combine and sort individual user's transactions
                const all = [...group.deposits,...group.cashouts].sort((a, b) => new Date(b.time |
| b.created) - new Date(a.time |
| a.created));
                const totalDeposit = group.totalDeposit;
                const totalCashout = group.totalCashout;
                const net = group.net; // Use calculated net from useMemo
                const profitMargin = group.profitMargin; // Use calculated profitMargin from useMemo
                const fb = group.fbUsername? `FB: ${group.fbUsername}` : '';

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
                        <span style={{ color: '#2ecc71' }}>{`Deposit: ${formatCurrency(totalDeposit)}`}</span>{' | '}
                        <span style={{ color: '#e74c3c' }}>{`Cashout: ${formatCurrency(totalCashout)}`}</span>{' | '}
                        <strong style={{ color: net >= 0? 'green' : 'red' }}>
                          {net >= 0? `Profit: ${formatCurrency(net)}` : `Loss: ${formatCurrency(Math.abs(net))}`}
                        </strong>
                        {' | '}
                        <span style={{ color: '#0984e3' }}>{`Margin: ${profitMargin}%`}</span> {/* NEW: Display Profit Margin */}
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
                        {all.map((entry) => (
                          <tr key={entry.id}>
                            <td style={{ color: entry.type === 'deposit'? 'green' : '#c0392b' }}>{entry.type}</td>
                            <td>{formatCurrency(entry.amount)}</td>
                            <td>{new Date(entry.time |
| entry.created).toLocaleString()}</td>
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