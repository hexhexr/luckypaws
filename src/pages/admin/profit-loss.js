// pages/admin/profit-loss.js
import { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link'; // Import Link for navigation
import { fetchProfitLossData, addCashout } from '../../services/profitLossService';
import { isAuthenticated } from '../../lib/auth'; // Import server-side auth utility

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
        margin-bottom: var(--spacing-sm);
        border-radius: 4px;
      }
      @keyframes loading {
        0% { background-position: -100% 0; }
        100% { background-position: 100% 0; }
      }
    `}</style>
  </div>
);

export default function AdminProfitLoss({ isAuthenticatedUser }) {
  const router = useRouter();
  const [profitLossData, setProfitLossData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cashoutForm, setCashoutForm] = useState({ username: '', amount: '', description: '' });
  const [filterType, setFilterType] = useState('all'); // 'all', 'deposit', 'cashout'
  const [sortConfig, setSortConfig] = useState({ key: 'net', direction: 'descending' });
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10; // Number of items per page

  // Client-side effect for logout (only if the server-side check didn't redirect)
  useEffect(() => {
    if (!isAuthenticatedUser && typeof window !== 'undefined') {
        router.replace('/admin');
    }
  }, [isAuthenticatedUser, router]);

  const logout = async () => {
    try {
      await fetch('/api/admin/logout', { method: 'POST' });
      router.replace('/admin');
    } catch (err) {
      console.error('Logout API error:', err);
      setError('Failed to log out.');
    }
  };

  const loadProfitLossData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchProfitLossData();
      setProfitLossData(data);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to load profit/loss data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Only load data if the user is authenticated (passed from getServerSideProps)
    if (isAuthenticatedUser) {
      loadProfitLossData();
    }
  }, [loadProfitLossData, isAuthenticatedUser]);

  const handleCashoutFormChange = (e) => {
    const { name, value } = e.target;
    setCashoutForm(prev => ({ ...prev, [name]: value }));
  };

  const handleAddCashout = async (e) => {
    e.preventDefault();
    if (!cashoutForm.username || !cashoutForm.amount || isNaN(parseFloat(cashoutForm.amount))) {
      setError('Please provide a valid username and amount for cashout.');
      return;
    }
    setError('');
    try {
      await addCashout(cashoutForm.username, parseFloat(cashoutForm.amount), cashoutForm.description);
      setCashoutForm({ username: '', amount: '', description: '' }); // Clear form
      loadProfitLossData(); // Refresh data
    } catch (err) {
      setError(err.message || 'Failed to add cashout.');
    }
  };

  const getFilteredAndSortedData = useMemo(() => {
    let filteredData = profitLossData;

    // Apply type filter
    if (filterType !== 'all') {
      filteredData = filteredData.filter(item => item.type === filterType);
    }

    // Aggregate by user
    const users = {};
    filteredData.forEach(item => {
      if (!users[item.username]) {
        users[item.username] = {
          username: item.username,
          fbUsername: item.fbUsername || item.username, // Assuming fbUsername might be a display name
          totalDeposit: 0,
          totalCashout: 0,
          net: 0,
        };
      }
      if (item.type === 'deposit') {
        users[item.username].totalDeposit += parseFloat(item.amount || 0);
      } else if (item.type === 'cashout') {
        users[item.username].totalCashout += parseFloat(item.amount || 0);
      }
      users[item.username].net = users[item.username].totalDeposit - users[item.username].totalCashout;
      users[item.username].profitMargin = users[item.username].totalDeposit > 0
        ? ((users[item.username].net / users[item.username].totalDeposit) * 100).toFixed(2)
        : '0.00';
    });

    let aggregatedUsers = Object.values(users);

    // Apply search filter
    if (searchQuery) {
      aggregatedUsers = aggregatedUsers.filter(user =>
        user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.fbUsername.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Sort data
    if (sortConfig.key) {
      aggregatedUsers.sort((a, b) => {
        if (a[sortConfig.key] < b[sortConfig.key]) {
          return sortConfig.direction === 'ascending' ? -1 : 1;
        }
        if (a[sortConfig.key] > b[sortConfig.key]) {
          return sortConfig.direction === 'ascending' ? 1 : -1;
        }
        return 0;
      });
    }

    return aggregatedUsers;
  }, [profitLossData, filterType, sortConfig, searchQuery]);

  const requestSort = (key) => {
    let direction = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  // Pagination logic
  const totalPages = Math.ceil(getFilteredAndSortedData.length / itemsPerPage);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const filteredAndSortedUsersForTable = getFilteredAndSortedData.slice(indexOfFirstItem, indexOfLastItem);

  const nextPage = () => {
    setCurrentPage(prev => Math.min(prev + 1, totalPages));
  };

  const prevPage = () => {
    setCurrentPage(prev => Math.max(prev - 1, 1));
  };


  return (
    <div className="container mt-lg">
      <div className="card">
        <h1 className="card-header">Profit & Loss Overview</h1>
        <nav className="admin-nav">
          <Link href="/admin/dashboard" className="btn btn-secondary mr-sm">
            Dashboard
          </Link>
          <Link href="/admin/games" className="btn btn-secondary mr-sm">
            Manage Games
          </Link>
          <Link href="/admin/profit-loss" className="btn btn-secondary mr-sm">
            Profit & Loss
          </Link>
          <Link href="/admin/agents" className="btn btn-secondary mr-sm">
            Manage Agents
          </Link>
          <button onClick={logout} className="btn btn-danger">Logout</button>
        </nav>

        {error && <p className="error-message mt-md">{error}</p>}

        <div className="add-cashout-section mt-lg">
          <h2 className="section-header">Add Manual Cashout</h2>
          <form onSubmit={handleAddCashout} className="cashout-form">
            <input
              type="text"
              name="username"
              className="input"
              placeholder="Username"
              value={cashoutForm.username}
              onChange={handleCashoutFormChange}
              required
            />
            <input
              type="number"
              name="amount"
              className="input"
              placeholder="Amount (USD)"
              value={cashoutForm.amount}
              onChange={handleCashoutFormChange}
              step="0.01"
              required
            />
            <textarea
              name="description"
              className="input"
              placeholder="Description (optional)"
              value={cashoutForm.description}
              onChange={handleCashoutFormChange}
              rows="2"
            ></textarea>
            <button className="btn btn-primary" type="submit">Add Cashout</button>
          </form>
        </div>

        <div className="controls-row mt-lg">
          <input
            type="text"
            className="input search-input"
            placeholder="Search by username"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <select
            className="select status-select"
            value={filterType}
            onChange={(e) => { setFilterType(e.target.value); setCurrentPage(1); }}
          >
            <option value="all">All Transactions</option>
            <option value="deposit">Deposits Only</option>
            <option value="cashout">Cashouts Only</option>
          </select>
        </div>

        {loading ? <LoadingSkeleton /> : (
          <div className="table-responsive mt-md">
            {getFilteredAndSortedData.length === 0 && !error ? (
              <p className="text-center">No profit/loss data found for the current filters.</p>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th onClick={() => requestSort('username')}>
                      Username {sortConfig.key === 'username' ? (sortConfig.direction === 'ascending' ? '↑' : '↓') : ''}
                    </th>
                    <th>Facebook Username</th>
                    <th onClick={() => requestSort('totalDeposit')}>
                      Total Deposit (USD) {sortConfig.key === 'totalDeposit' ? (sortConfig.direction === 'ascending' ? '↑' : '↓') : ''}
                    </th>
                    <th onClick={() => requestSort('totalCashout')}>
                      Total Cashout (USD) {sortConfig.key === 'totalCashout' ? (sortConfig.direction === 'ascending' ? '↑' : '↓') : ''}
                    </th>
                    <th onClick={() => requestSort('net')}>
                      Net (USD) {sortConfig.key === 'net' ? (sortConfig.direction === 'ascending' ? '↑' : '↓') : ''}
                    </th>
                    <th onClick={() => requestSort('profitMargin')}>
                      Profit Margin (%) {sortConfig.key === 'profitMargin' ? (sortConfig.direction === 'ascending' ? '↑' : '↓') : ''}
                    </th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAndSortedUsersForTable.map((user) => (
                    <tr key={user.username}>
                      <td>{user.username}</td>
                      <td>{user.fbUsername}</td>
                      <td className="text-success">{formatCurrency(user.totalDeposit)}</td>
                      <td className="text-danger">{formatCurrency(user.totalCashout)}</td>
                      <td style={{ color: user.net >= 0 ? 'var(--primary-green)' : 'var(--red-alert)' }}>{formatCurrency(user.net)}</td>
                      <td>{user.profitMargin}%</td>
                      <td>
                        <Link href={`/admin/customer/${user.username}`} className="btn-link">View Details</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {filteredAndSortedUsersForTable.length > 0 && totalPages > 1 && (
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

// Server-side authentication check for AdminProfitLoss
export async function getServerSideProps(context) {
  const { req } = context;
  const { isAuthenticated } = await import('../../lib/auth');

  if (!isAuthenticated(req)) {
    return {
      redirect: {
        destination: '/admin',
        permanent: false,
      },
    };
  }

  return {
    props: {
      isAuthenticatedUser: true,
    },
  };
}