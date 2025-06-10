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
      }
      @keyframes loading {
        0% { background-position: -100% 0; }
        100% { background-position: 100% 0; }
      }
    `}</style>
  </div>
);

export default function ProfitLoss() {
  const router = useRouter();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('net'); // Default sort by net profit
  const [sortOrder, setSortOrder] = useState('desc'); // 'asc' or 'desc'
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10; // Number of items per page

  // Authentication Check - This is from your original file.
  useEffect(() => {
    if (typeof window !== 'undefined' && localStorage.getItem('admin_auth') !== '1') {
      router.replace('/admin');
    }
  }, [router]);

  const loadProfitLossData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const fetchedData = await fetchProfitLossData();
      setData(fetchedData);
    } catch (err) {
      console.error('Failed to load profit/loss data:', err);
      setError(err.message || 'Failed to load data.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Use another useEffect to load data after initial auth check
  useEffect(() => {
    // Only load if not already loading, no error, and data is empty
    if (!loading && !error && data.length === 0) {
      loadProfitLossData();
    }
  }, [loading, error, data, loadProfitLossData]);


  // Process data for display
  const usersData = useMemo(() => {
    const usersMap = {};

    data.forEach(item => {
      if (!usersMap[item.username]) {
        usersMap[item.username] = {
          username: item.username,
          fbUsername: item.fbUsername || 'N/A', // Assuming fbUsername might be available
          totalDeposit: 0,
          totalCashout: 0,
          net: 0,
          profitMargin: 0,
        };
      }

      if (item.type === 'deposit') {
        usersMap[item.username].totalDeposit += item.amount;
      } else if (item.type === 'cashout') {
        usersMap[item.username].totalCashout += item.amountUSD || 0; // Assuming cashouts are in USD
      }
    });

    return Object.values(usersMap).map(user => {
      user.net = user.totalDeposit - user.totalCashout;
      user.profitMargin = user.totalDeposit > 0 ? ((user.net / user.totalDeposit) * 100).toFixed(2) : '0.00';
      return user;
    });
  }, [data]);

  const filteredAndSortedUsers = useMemo(() => {
    let filtered = usersData.filter(user =>
      user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.fbUsername.toLowerCase().includes(searchTerm.toLowerCase())
    );

    filtered.sort((a, b) => {
      let valA = a[sortBy];
      let valB = b[sortBy];

      // Handle numeric sorting
      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortOrder === 'asc' ? valA - valB : valB - valA;
      }
      // Handle string sorting (case-insensitive)
      if (typeof valA === 'string' && typeof valB === 'string') {
        return sortOrder === 'asc'
          ? valA.localeCompare(valB)
          : valB.localeCompare(valA);
      }
      return 0;
    });

    return filtered;
  }, [usersData, searchTerm, sortBy, sortOrder]);

  // Pagination logic
  const totalPages = Math.ceil(filteredAndSortedUsers.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const filteredAndSortedUsersForTable = filteredAndSortedUsers.slice(startIndex, endIndex);

  const prevPage = () => {
    setCurrentPage(prev => Math.max(prev - 1, 1));
  };

  const nextPage = () => {
    setCurrentPage(prev => Math.min(prev + 1, totalPages));
  };

  const handleSort = (column) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('asc'); // Default to ascending when changing column
    }
  };

  const getSortIndicator = (column) => {
    if (sortBy === column) {
      return sortOrder === 'asc' ? ' ▲' : ' ▼';
    }
    return '';
  };

  return (
    <div className="container mt-md">
      <div className="card">
        <h1 className="card-header">Profit & Loss</h1>
        <section className="section-card"> {/* This is the corrected opening section tag */}
          {error && <div className="alert alert-danger">{error}</div>}

          <div className="search-and-filter-controls mb-md">
            <input
              type="text"
              className="input"
              placeholder="Search by username or FB username..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {loading ? (
            <LoadingSkeleton />
          ) : (
            <div className="table-responsive">
              <table className="table table-hover">
                <thead>
                  <tr>
                    <th onClick={() => handleSort('username')}>Username{getSortIndicator('username')}</th>
                    <th onClick={() => handleSort('fbUsername')}>FB Username{getSortIndicator('fbUsername')}</th>
                    <th onClick={() => handleSort('totalDeposit')}>Total Deposit{getSortIndicator('totalDeposit')}</th>
                    <th onClick={() => handleSort('totalCashout')}>Total Cashout{getSortIndicator('totalCashout')}</th>
                    <th onClick={() => handleSort('net')}>Net Profit/Loss{getSortIndicator('net')}</th>
                    <th onClick={() => handleSort('profitMargin')}>Profit Margin{getSortIndicator('profitMargin')}</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAndSortedUsersForTable.map((user) => (
                    <tr key={user.username}>
                      <td><a href={`/admin/customer/${user.username}`} className="btn-link">{user.username}</a></td>
                      <td>{user.fbUsername}</td>
                      <td className="text-success">{formatCurrency(user.totalDeposit)}</td>
                      <td className="text-danger">{formatCurrency(user.totalCashout)}</td>
                      <td style={{ color: user.net >= 0 ? 'var(--primary-green)' : 'var(--red-alert)' }}>{formatCurrency(user.net)}</td>
                      <td>{user.profitMargin}%</td>
                      <td>
                        {/* Assuming '/admin/customer/[username]' is a valid route for user details */}
                        <a href={`/admin/customer/${user.username}`} className="btn-link">View Details</a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {filteredAndSortedUsersForTable.length > itemsPerPage && ( // Check total filtered users for pagination
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
        </section> {/* THIS IS THE MISSING CLOSING TAG */}
      </div>
    </div>
  );
}