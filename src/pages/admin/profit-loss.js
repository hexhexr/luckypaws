// pages/admin/profit-loss.js
import { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head'; // Import Head for page title

// Import Firebase client-side SDK elements
import { db, auth as firebaseAuth } from '../../lib/firebaseClient';
import { collection, query, onSnapshot, getDocs, doc, getDoc } from 'firebase/firestore'; // Import necessary Firestore functions
import { onAuthStateChanged } from 'firebase/auth'; // Import onAuthStateChanged

// Assuming fetchProfitLossData is meant for client-side use given firebaseClient import.
// You might need to adjust fetchProfitLossData if it's currently expecting global db.
import { fetchProfitLossData } from '../../services/profitLossService'; // Assuming this uses client-side Firebase

const formatCurrency = (amount) => {
  const numAmount = parseFloat(amount);
  return isNaN(numAmount) ? '$0.00' : `$${numAmount.toFixed(2)}`;
};

const LoadingSkeleton = () => (
  <div className="loading-skeleton mt-md">
    <div className="skeleton-line" style={{ width: '80%' }}></div>
    <div className="skeleton-line" style={{ width: '90%' }}></div>
    <div className="skeleton-line" style={{ width: '70%' }}></div>
  </div>
);

export default function AdminProfitLoss() { // Corrected component name here
  const router = useRouter();

  // --- AUTHENTICATION STATES ---
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  // --- DATA STATES ---
  const [usersData, setUsersData] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState('');

  // --- SEARCH AND FILTER STATES ---
  const [searchTerm, setSearchTerm] = useState('');
  const [minNet, setMinNet] = useState('');
  const [maxNet, setMaxNet] = useState('');
  const [sortColumn, setSortColumn] = useState(null);
  const [sortDirection, setSortDirection] = useState('asc'); // 'asc' or 'desc'

  // --- PAGINATION STATES ---
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10; // Number of items per page

  // Authentication Check
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
      if (!user) {
        router.replace('/admin'); // Redirect to /admin (login) if no user
        return;
      }
      try {
        const idTokenResult = await user.getIdTokenResult(true);
        if (idTokenResult.claims.admin) {
          setIsAdmin(true);
        } else {
          router.replace('/admin'); // Redirect if not admin
        }
      } catch (e) {
        console.error("Error checking admin claims:", e);
        router.replace('/admin');
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  // Fetch data when admin status is confirmed
  useEffect(() => {
    if (isAdmin) {
      const fetchData = async () => {
        setLoadingData(true);
        setError('');
        try {
          // fetchProfitLossData should interact with Firestore client-side
          const data = await fetchProfitLossData();
          setUsersData(data);
        } catch (err) {
          console.error("Error fetching profit/loss data:", err);
          setError('Failed to load profit/loss data. Please try again.');
        } finally {
          setLoadingData(false);
        }
      };
      fetchData();
    }
  }, [isAdmin]); // Refetch when admin status changes

  // Memoized for performance: filter and sort users
  const filteredAndSortedUsers = useMemo(() => {
    let filtered = usersData.filter(user => {
      const matchesSearch = searchTerm === '' ||
                            user.username.toLowerCase().includes(searchTerm.toLowerCase());

      const userNet = parseFloat(user.net);
      const matchesMinNet = minNet === '' || userNet >= parseFloat(minNet);
      const matchesMaxNet = maxNet === '' || userNet <= parseFloat(maxNet);

      return matchesSearch && matchesMinNet && matchesMaxNet;
    });

    if (sortColumn) {
      filtered.sort((a, b) => {
        const aValue = a[sortColumn];
        const bValue = b[sortColumn];

        if (typeof aValue === 'string' && typeof bValue === 'string') {
          return sortDirection === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
        }
        // Handle numeric sorting for amount-related columns
        if (typeof aValue === 'number' && typeof bValue === 'number') {
            return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
        }
        // Fallback for mixed types or other cases
        if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  }, [usersData, searchTerm, minNet, maxNet, sortColumn, sortDirection]);

  // Pagination Logic
  const totalPages = Math.ceil(filteredAndSortedUsers.length / itemsPerPage);
  const paginatedUsers = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredAndSortedUsers.slice(startIndex, endIndex);
  }, [filteredAndSortedUsers, currentPage, itemsPerPage]);

  const nextPage = () => {
    setCurrentPage(prev => Math.min(prev + 1, totalPages));
  };

  const prevPage = () => {
    setCurrentPage(prev => Math.max(prev - 1, 1));
  };

  const handleSort = (column) => {
    if (sortColumn === column) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  if (loading) {
    return <div className="container mt-md"><p>Loading authentication...</p></div>;
  }

  if (!isAdmin) {
    return <div className="container mt-md"><p>Access Denied. Redirecting to login...</p></div>;
  }

  return (
    <div className="admin-dashboard-layout">
      <Head>
        <title>Admin Profit/Loss - LuckyPaw</title>
      </Head>

      <main className="admin-main-content">
        <div className="container mt-md">
          <h1 className="card-header">Profit/Loss Overview</h1>

          {error && <div className="alert alert-danger">{error}</div>}

          <section className="admin-filter-section section-card mb-lg">
            <h2>Filter & Search</h2>
            <div className="filter-controls form-inline">
              <input
                type="text"
                placeholder="Search by Username"
                className="form-control mr-md"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1); // Reset pagination on search
                }}
              />
              <input
                type="number"
                placeholder="Min Net ($)"
                className="form-control mr-md"
                value={minNet}
                onChange={(e) => {
                  setMinNet(e.target.value);
                  setCurrentPage(1); // Reset pagination on filter change
                }}
              />
              <input
                type="number"
                placeholder="Max Net ($)"
                className="form-control"
                value={maxNet}
                onChange={(e) => {
                  setMaxNet(e.target.value);
                  setCurrentPage(1); // Reset pagination on filter change
                }}
              />
            </div>
          </section>

          {loadingData ? (
            <LoadingSkeleton />
          ) : (
            <div className="admin-table-section section-card">
              <div className="section-header">
                <h2>User Profit/Loss Data</h2>
                <span>Total Users: {filteredAndSortedUsers.length}</span>
              </div>
              <div className="table-responsive">
              <table className="table table-hover">
                <thead>
                  <tr>
                    <th onClick={() => handleSort('username')}>Username {sortColumn === 'username' && (sortDirection === 'asc' ? '▲' : '▼')}</th>
                    <th onClick={() => handleSort('totalDeposit')}>Total Deposit {sortColumn === 'totalDeposit' && (sortDirection === 'asc' ? '▲' : '▼')}</th>
                    <th onClick={() => handleSort('totalWithdrawal')}>Total Withdrawal {sortColumn === 'totalWithdrawal' && (sortDirection === 'asc' ? '▲' : '▼')}</th>
                    <th onClick={() => handleSort('totalCashout')}>Total Cashout {sortColumn === 'totalCashout' && (sortDirection === 'asc' ? '▲' : '▼')}</th>
                    <th onClick={() => handleSort('net')}>Net (P/L) {sortColumn === 'net' && (sortDirection === 'asc' ? '▲' : '▼')}</th>
                    <th onClick={() => handleSort('profitMargin')}>Profit Margin {sortColumn === 'profitMargin' && (sortDirection === 'asc' ? '▲' : '▼')}</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedUsers.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="text-center">No matching users found.</td>
                    </tr>
                  ) : (
                    paginatedUsers.map((user) => (
                      <tr key={user.username}>
                        <td>{user.username}</td>
                        <td className="text-success">{formatCurrency(user.totalDeposit)}</td>
                        <td className="text-danger">{formatCurrency(user.totalWithdrawal)}</td>
                        <td className="text-danger">{formatCurrency(user.totalCashout)}</td>
                        <td style={{ color: user.net >= 0 ? 'var(--primary-green)' : 'var(--red-alert)' }}>{formatCurrency(user.net)}</td>
                        <td>{user.profitMargin}%</td>
                        <td>
                          {/* Assuming '/admin/customer/[username]' is a valid route for user details */}
                          <a href={`/admin/customer/${user.username}`} className="btn-link">View Details</a>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              </div>
            </div>
          )}

          {filteredAndSortedUsers.length > itemsPerPage && ( // Check total filtered users for pagination
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
        </section>
      </div>
    </div>
  );
}