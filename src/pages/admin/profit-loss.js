import { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/router';
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
        padding: var(--spacing-md);
        border-radius: var(--radius-sm);
        background-color: var(--card-bg);
        box-shadow: var(--shadow-sm);
      }
      .skeleton-line {
        height: 1em;
        background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
        background-size: 200% 100%;
        animation: loading 1.5s infinite;
        margin-bottom: var(--spacing-sm);
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

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  // Sorting state
  const [sortOption, setSortOption] = useState('username_asc');

  useEffect(() => {
    if (typeof window !== 'undefined' && localStorage.getItem('admin_auth') !== '1') {
      router.replace('/admin/login');
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

  // --- Grouped Data for Overall Summary (Date Filtered) ---
  const overallSummaryData = useMemo(() => {
    const fromDate = new Date(range.from);
    const toDate = new Date(range.to);
    toDate.setHours(23, 59, 59, 999);

    const filtered = allData.filter(entry => {
      const entryDate = new Date(entry.time || entry.created);
      return !isNaN(entryDate.getTime()) && entryDate >= fromDate && entryDate <= toDate;
    });

    let overallDeposit = 0;
    let overallCashout = 0;

    filtered.forEach(entry => {
      const amount = parseFloat(entry.amount || 0);
      if (entry.type === 'deposit') {
        overallDeposit += amount;
      } else if (entry.type === 'cashout') {
        overallCashout += amount;
      }
    });

    return { overallDeposit, overallCashout };
  }, [allData, range]);

  // --- Grouped Data for User Table (All Time) ---
  const allTimeGroupedUsers = useMemo(() => {
    const groups = {};
    allData.forEach(entry => {
      const uname = entry.username ? entry.username.toLowerCase() : 'unknown';
      if (!groups[uname]) {
        groups[uname] = {
          username: entry.username || 'Unknown User',
          fbUsername: entry.fbUsername || 'N/A',
          totalDeposit: 0,
          totalCashout: 0,
          net: 0,
          profitMargin: 0
        };
      }
      const amount = parseFloat(entry.amount || 0);
      if (entry.type === 'deposit') {
        groups[uname].totalDeposit += amount;
      } else if (entry.type === 'cashout') {
        groups[uname].totalCashout += amount;
      }
    });

    Object.values(groups).forEach(group => {
      group.net = group.totalDeposit - group.totalCashout;
      group.profitMargin = group.totalDeposit > 0
        ? ((group.net / group.totalDeposit) * 100).toFixed(2)
        : 0;
    });

    return Object.values(groups);
  }, [allData]);

  // --- Filtered and Sorted Users for Table ---
  const filteredAndSortedUsersForTable = useMemo(() => {
    let users = allTimeGroupedUsers.filter(group =>
      group.username.toLowerCase().includes(search.toLowerCase()) ||
      group.fbUsername.toLowerCase().includes(search.toLowerCase())
    );

    // Apply sorting
    users.sort((a, b) => {
      if (sortOption === 'net_desc') {
        return b.net - a.net;
      } else if (sortOption === 'net_asc') {
        return a.net - b.net;
      } else if (sortOption === 'username_asc') {
        return a.username.localeCompare(b.username);
      } else if (sortOption === 'username_desc') {
        return b.username.localeCompare(a.username);
      }
      return 0;
    });

    return users;
  }, [allTimeGroupedUsers, search, sortOption]);

  // Pagination Logic
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentUsers = filteredAndSortedUsersForTable.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredAndSortedUsersForTable.length / itemsPerPage);

  const handleSortChange = (e) => {
    setSortOption(e.target.value);
    setCurrentPage(1); // Reset to first page on sort change
  };

  const nextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(prev => prev + 1);
    }
  };

  const prevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(prev => prev - 1);
    }
  };

  // Function to export data to CSV
  const exportToCSV = useCallback(() => {
    const headers = ["Username", "FB Username", "Deposits (USD)", "Cashouts (USD)", "Net P/L (USD)", "Profit Margin (%)"];
    const rows = filteredAndSortedUsersForTable.map(user => [
      user.username,
      user.fbUsername,
      user.totalDeposit.toFixed(2),
      user.totalCashout.toFixed(2),
      user.net.toFixed(2),
      user.profitMargin,
    ].join(','));

    const csvContent = [headers.join(','), ...rows].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `profit-loss-report-${new Date().toISOString().slice(0, 10)}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }, [filteredAndSortedUsersForTable]);

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

  return (
    <div className="admin-dashboard">
      <div className="sidebar">
        <h1>Lucky Paw Admin</h1>
        <a className="nav-btn" href="/admin/dashboard">📋 Orders</a>
        <a className="nav-btn active" href="/admin/profit-loss">📊 Profit & Loss</a>
        <a className="nav-btn" href="/admin/games">🎮 Games</a>
        <button className="nav-btn" onClick={logout}>🚪 Logout</button>
      </div>

      <div className="main-content">
        <h2 className="section-title">📊 Profit & Loss Overview</h2>

        <div className="card summary-card compact-card">
          <h3 className="card-subtitle">Overall Summary</h3>
          <div className="summary-grid">
            <div className="date-range-controls">
              <label htmlFor="fromDate">From:</label>
              <input type="date" id="fromDate" value={range.from} onChange={e => setCurrentPage(1) || setRange(prev => ({ ...prev, from: e.target.value }))} />
              <label htmlFor="toDate">To:</label>
              <input type="date" id="toDate" value={range.to} onChange={e => setCurrentPage(1) || setRange(prev => ({ ...prev, to: e.target.value }))} />
            </div>
            <div className="summary-item">
              <span>Total Deposits:</span>
              <span className="summary-deposit">{formatCurrency(overallSummaryData.overallDeposit)}</span>
            </div>
            <div className="summary-item">
              <span>Total Cashouts:</span>
              <span className="summary-cashout">{formatCurrency(overallSummaryData.overallCashout)}</span>
            </div>
            <div className="summary-item">
              <span>Net Profit/Loss:</span>
              <span className="summary-net" style={{ color: (overallSummaryData.overallDeposit - overallSummaryData.overallCashout) >= 0 ? 'var(--primary-green)' : 'var(--red-alert)' }}>
                {formatCurrency(overallSummaryData.overallDeposit - overallSummaryData.overallCashout)}
              </span>
            </div>
            <div className="summary-item">
              <span>Profit Margin:</span>
              <span className="summary-margin">
                {overallSummaryData.overallDeposit > 0 ? ((overallSummaryData.overallDeposit - overallSummaryData.overallCashout) / overallSummaryData.overallDeposit * 100).toFixed(2) : '0'}%
              </span>
            </div>
            <button onClick={exportToCSV} className="btn btn-secondary btn-export">Export All to CSV</button>
          </div>
        </div>

        <div className="card add-cashout-card compact-card mt-md">
          <h3 className="card-subtitle">💰 Add New Cashout</h3>
          <form onSubmit={handleAddCashout} className="cashout-form-compact">
            <input
              className="input"
              placeholder="Username"
              value={newCashout.username}
              onChange={e => setNewCashout(prev => ({ ...prev, username: e.target.value }))} required
            />
            <input
              className="input"
              type="number"
              step="0.01"
              placeholder="Amount (USD)"
              value={newCashout.amount}
              onChange={e => setNewCashout(prev => ({ ...prev, amount: e.target.value }))} required
            />
            <button className="btn btn-primary btn-add-cashout" type="submit">Add Cashout</button>
          </form>
          {error && <div className="alert alert-danger mt-sm">{error}</div>}
        </div>

        <div className="card user-profit-loss-table-card mt-md">
          <h3 className="card-subtitle">User Profit & Loss Details (All Time)</h3>
          <div className="sort-controls">
            <label htmlFor="sort-by">Sort by:</label>
            <select id="sort-by" className="select" value={sortOption} onChange={handleSortChange}>
              <option value="net_desc">Highest Profit</option>
              <option value="net_asc">Highest Loss</option>
              <option value="username_asc">Username (A-Z)</option>
              <option value="username_desc">Username (Z-A)</option>
            </select>
            <input
              className="input search-input"
              placeholder="Search username or FB username"
              value={search}
              onChange={e => setCurrentPage(1) || setSearch(e.target.value)}
            />
          </div>

          {loading ? (
            <LoadingSkeleton />
          ) : currentUsers.length === 0 ? (
            <p className="text-center mt-md">No user data found.</p>
          ) : (
            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr>
                    <th>Username</th>
                    <th>FB Username</th>
                    <th>Deposits</th>
                    <th>Cashouts</th>
                    <th>Net P/L</th>
                    <th>Margin</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {currentUsers.map(user => (
                    <tr key={user.username}>
                      <td><a href={`/admin/customer/${user.username}`} className="username-link">{user.username}</a></td>
                      <td>{user.fbUsername}</td>
                      <td className="text-success">{formatCurrency(user.totalDeposit)}</td>
                      <td className="text-danger">{formatCurrency(user.totalCashout)}</td>
                      <td style={{ color: user.net >= 0 ? 'var(--primary-green)' : 'var(--red-alert)' }}>{formatCurrency(user.net)}</td>
                      <td>{user.profitMargin}%</td>
                      <td>
                        <a href={`/admin/customer/${user.username}`} className="btn-link">View Details</a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {filteredAndSortedUsersForTable.length > itemsPerPage && (
            <div className="pagination-controls mt-lg text-center">
              <button
                className="btn btn-secondary mr-md"
                onClick={prevPage}
                disabled={currentPage === 1}
              >
                ← Previous
              </button>
              <span>Page {currentPage} of {totalPages}</span>
              <button
                className="btn btn-secondary ml-md"
                onClick={nextPage}
                disabled={currentPage === totalPages}
              >
                Next →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
