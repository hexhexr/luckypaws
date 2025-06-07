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
        height: 1em; /* Smaller height for lines */
        background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
        background-size: 200% 100%;
        animation: loading 1.5s infinite;
        border-radius: 4px;
        margin-bottom: 0.5rem;
      }
      @keyframes loading {
        0% {
          background-position: 200% 0;
        }
        100% {
          background-position: -200% 0;
        }
      }
    `}</style>
  </div>
);

export default function AdminProfitLoss() {
  const router = useRouter();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [cashoutForm, setCashoutForm] = useState({ username: '', amount: '', description: '' });
  const [isCashoutModalOpen, setIsCashoutModalOpen] = useState(false);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'ascending' });

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10; // Number of items per page

  // Authentication check
  useEffect(() => {
    if (typeof window !== 'undefined' && localStorage.getItem('admin_auth') !== '1') {
      router.replace('/admin/login');
    }
  }, []);

  const loadProfitLossData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const fetchedData = await fetchProfitLossData();
      setData(fetchedData);
    } catch (err) {
      console.error('Failed to fetch profit/loss data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfitLossData();
  }, [loadProfitLossData]);

  const handleCashoutChange = (e) => {
    const { name, value } = e.target;
    setCashoutForm(prev => ({ ...prev, [name]: value }));
  };

  const handleAddCashout = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await addCashout(cashoutForm.username, cashoutForm.amount, cashoutForm.description);
      alert('Cashout added successfully!');
      setCashoutForm({ username: '', amount: '', description: '' });
      setIsCashoutModalOpen(false);
      loadProfitLossData(); // Refresh data
    } catch (err) {
      console.error('Error adding cashout:', err);
      setError(err.message);
    }
  };

  // Process data for display (aggregation, filtering, sorting)
  const processedData = useMemo(() => {
    const userMap = new Map();

    data.forEach(item => {
      if (!userMap.has(item.username)) {
        userMap.set(item.username, {
          username: item.username,
          fbUsername: item.fbUsername || item.username, // Use fbUsername if available, else username
          totalDeposit: 0,
          totalCashout: 0,
          net: 0,
          profitMargin: 0,
        });
      }

      const user = userMap.get(item.username);
      if (item.type === 'deposit') {
        user.totalDeposit += parseFloat(item.amount || 0);
      } else if (item.type === 'cashout') {
        user.totalCashout += parseFloat(item.amount || 0);
      }
    });

    const users = Array.from(userMap.values()).map(user => {
      user.net = user.totalDeposit - user.totalCashout;
      user.profitMargin = user.totalDeposit > 0
        ? ((user.net / user.totalDeposit) * 100).toFixed(2)
        : 0;
      return user;
    });

    // Filter by search term
    const filteredUsers = search
      ? users.filter(user =>
        user.username.toLowerCase().includes(search.toLowerCase()) ||
        user.fbUsername.toLowerCase().includes(search.toLowerCase())
      )
      : users;

    // Sort users
    if (sortConfig.key) {
      filteredUsers.sort((a, b) => {
        let aValue = a[sortConfig.key];
        let bValue = b[sortConfig.key];

        // Handle numeric sorting for amount, net, profitMargin
        if (['totalDeposit', 'totalCashout', 'net', 'profitMargin'].includes(sortConfig.key)) {
          aValue = parseFloat(aValue);
          bValue = parseFloat(bValue);
        }

        if (aValue < bValue) {
          return sortConfig.direction === 'ascending' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'ascending' ? 1 : -1;
        }
        return 0;
      });
    }

    return filteredUsers;
  }, [data, search, sortConfig]);

  // Pagination logic
  const totalPages = Math.ceil(processedData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const filteredAndSortedUsersForTable = processedData.slice(startIndex, endIndex);

  const nextPage = () => {
    setCurrentPage(prev => Math.min(prev + 1, totalPages));
  };

  const prevPage = () => {
    setCurrentPage(prev => Math.max(prev - 1, 1));
  };

  const requestSort = (key) => {
    let direction = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const getSortIndicator = (key) => {
    if (sortConfig.key === key) {
      return sortConfig.direction === 'ascending' ? ' ⬆️' : ' ⬇️';
    }
    return '';
  };


  if (loading) return <LoadingSkeleton />;

  return (
    <div className="container mt-xl">
      <h1 className="card-header">Profit & Loss Analysis</h1>

      {error && <div className="alert alert-danger">{error}</div>}

      <div className="card mt-lg">
        <h2 className="card-header">Overview</h2>
        <div className="card-body">
          <div className="search-and-add-controls">
            <input
              type="text"
              placeholder="Search by username..."
              className="input search-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button className="btn btn-primary" onClick={() => setIsCashoutModalOpen(true)}>Add New Cashout</button>
          </div>

          {isCashoutModalOpen && (
            <div className="modal-overlay">
              <div className="modal">
                <h2 className="modal-title">Add Cashout</h2>
                <form onSubmit={handleAddCashout}>
                  <label htmlFor="cashout-username">Username:</label>
                  <input
                    id="cashout-username"
                    className="input"
                    name="username"
                    value={cashoutForm.username}
                    onChange={handleCashoutChange}
                    required
                  />

                  <label htmlFor="cashout-amount">Amount (USD):</label>
                  <input
                    id="cashout-amount"
                    className="input"
                    name="amount"
                    type="number"
                    step="0.01"
                    value={cashoutForm.amount}
                    onChange={handleCashoutChange}
                    required
                  />
                  <label htmlFor="cashout-description">Description (optional):</label>
                  <textarea
                    id="cashout-description"
                    className="input"
                    name="description"
                    value={cashoutForm.description}
                    onChange={handleCashoutChange}
                    rows="3"
                  ></textarea>

                  <div className="form-actions">
                    <button className="btn btn-primary" type="submit">Submit Cashout</button>
                    <button className="btn btn-secondary ml-sm" type="button" onClick={() => setIsCashoutModalOpen(false)}>Cancel</button>
                  </div>
                </form>
              </div>
            </div>
          )}


          {filteredAndSortedUsersForTable.length === 0 && !loading ? (
            <p>No profit/loss data found for the current filters.</p>
          ) : (
            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr>
                    <th onClick={() => requestSort('username')}>Username{getSortIndicator('username')}</th>
                    <th>Firebase Username</th>
                    <th onClick={() => requestSort('totalDeposit')}>Total Deposit (USD){getSortIndicator('totalDeposit')}</th>
                    <th onClick={() => requestSort('totalCashout')}>Total Cashout (USD){getSortIndicator('totalCashout')}</th>
                    <th onClick={() => requestSort('net')}>Net P/L (USD){getSortIndicator('net')}</th>
                    <th onClick={() => requestSort('profitMargin')}>Profit Margin (%) {getSortIndicator('profitMargin')}</th>
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
                        <a href={`/admin/customer/${user.username}`} className="btn-link">View Details</a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination Controls */}
          {processedData.length > itemsPerPage && (
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