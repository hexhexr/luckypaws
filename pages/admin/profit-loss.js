import { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/router';
// import { db } from '../../lib/firebaseClient'; // Removed as per previous fix
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
        height: 1em; /* Smaller height for lines */
        background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
        background-size: 200% 100%;
        animation: loading 1.5s infinite;
        margin-bottom: var(--spacing-sm); /* Smaller margin */
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
  const [itemsPerPage] = useState(10); // You can adjust this number

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

  const groupedData = useMemo(() => {
    const fromDate = new Date(range.from);
    const toDate = new Date(range.to);
    toDate.setHours(23, 59, 59, 999);

    const filtered = allData.filter(entry => {
      // Ensure entry.time or entry.created exists and is a valid date
      const entryDate = new Date(entry.time || entry.created);
      return !isNaN(entryDate.getTime()) && entryDate >= fromDate && entryDate <= toDate;
    });

    const groups = {};
    let overallDeposit = 0;
    let overallCashout = 0;

    filtered.forEach(entry => {
      const uname = entry.username ? entry.username.toLowerCase() : 'unknown'; // Handle missing username
      if (!groups[uname]) {
        groups[uname] = {
          username: entry.username || 'Unknown User',
          fbUsername: entry.fbUsername || 'N/A', // Default N/A if not present
          totalDeposit: 0,
          totalCashout: 0,
          net: 0,
          profitMargin: 0
        };
      }

      const amount = parseFloat(entry.amount || 0);

      if (entry.type === 'deposit') {
        groups[uname].totalDeposit += amount;
        overallDeposit += amount;
      } else if (entry.type === 'cashout') {
        groups[uname].totalCashout += amount;
        overallCashout += amount;
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

  const filteredAndSortedGroups = useMemo(() => {
    return groupedData.sortedGroups.filter(group =>
      group.username.toLowerCase().includes(search.toLowerCase()) ||
      group.fbUsername.toLowerCase().includes(search.toLowerCase()) // Also search by FB username
    );
  }, [groupedData.sortedGroups, search]);

  // Pagination Logic
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentUsers = filteredAndSortedGroups.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredAndSortedGroups.length / itemsPerPage);

  const paginate = (pageNumber) => setCurrentPage(pageNumber);

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

        <div className="card summary-card mt-md">
          <h3 className="card-subtitle">Overall Summary</h3>
          <div className="date-range-controls">
            <div className="date-input-group">
              <label htmlFor="fromDate">From:</label>
              <input type="date" id="fromDate" value={range.from} onChange={e => setCurrentPage(1) || setRange(prev => ({ ...prev, from: e.target.value }))} />
            </div>
            <div className="date-input-group">
              <label htmlFor="toDate">To:</label>
              <input type="date" id="toDate" value={range.to} onChange={e => setCurrentPage(1) || setRange(prev => ({ ...prev, to: e.target.value }))} />
            </div>
          </div>
          <div className="summary-numbers">
            <p>
              <span>Total Deposits:</span>
              <span className="summary-deposit">{formatCurrency(groupedData.overallDeposit)}</span>
            </p>
            <p>
              <span>Total Cashouts:</span>
              <span className="summary-cashout">{formatCurrency(groupedData.overallCashout)}</span>
            </p>
            <p>
              <span>Net Profit/Loss:</span>
              <span className="summary-net" style={{ color: (groupedData.overallDeposit - groupedData.overallCashout) >= 0 ? 'var(--primary-green)' : 'var(--red-alert)' }}>
                {formatCurrency(groupedData.overallDeposit - groupedData.overallCashout)}
              </span>
            </p>
            <p>
              <span>Profit Margin:</span>
              <span className="summary-margin">
                {groupedData.overallDeposit > 0 ? ((groupedData.overallDeposit - groupedData.overallCashout) / groupedData.overallDeposit * 100).toFixed(2) : '0'}%
              </span>
            </p>
          </div>
          <button onClick={exportToCSV} className="btn btn-secondary mt-md">Export to CSV</button>
        </div>

        <div className="card add-cashout-card mt-lg">
          <h3 className="card-subtitle">💰 Add New Cashout</h3>
          <form onSubmit={handleAddCashout}>
            <div className="form-group">
              <input
                className="input"
                placeholder="Username"
                value={newCashout.username}
                onChange={e => setNewCashout(prev => ({ ...prev, username: e.target.value }))}
                required
              />
            </div>
            <div className="form-group">
              <input
                className="input"
                type="number"
                step="0.01"
                placeholder="Amount (USD)"
                value={newCashout.amount}
                onChange={e => setNewCashout(prev => ({ ...prev, amount: e.target.value }))}
                required
              />
            </div>
            <button className="btn btn-primary" type="submit">Add Cashout</button>
          </form>
          {error && <div className="alert alert-danger mt-md">{error}</div>}
        </div>

        <input
          className="input search-input"
          placeholder="Search username or FB username"
          value={search}
          onChange={e => setCurrentPage(1) || setSearch(e.target.value)} // Reset page on search
        />

        {loading ? (
          <LoadingSkeleton />
        ) : (
          <div className="card mt-md"> {/* Consolidated table within a single card */}
            <h3 className="card-subtitle">User Profit & Loss Details</h3>
            {currentUsers.length === 0 ? (
              <p className="text-center mt-md">No user data found for the selected range or search.</p>
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
                      <th>Actions</th> {/* Added actions column */}
                    </tr>
                  </thead>
                  <tbody>
                    {currentUsers.map(user => (
                      <tr key={user.username}> {/* Using username as key */}
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

            {/* Pagination Controls */}
            {filteredAndSortedGroups.length > itemsPerPage && (
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
        )}
      </div>
    </div>
  );
}