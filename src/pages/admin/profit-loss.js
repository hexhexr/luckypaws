// pages/admin/profit-loss.js
import { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head'; // Import Head for page title

// Import Firebase client-side SDK elements
import { db, auth as firebaseAuth } from '../../lib/firebaseClient';
import { collection, query, onSnapshot, getDocs, doc, getDoc } from 'firebase/firestore'; // Import necessary Firestore functions
import { onAuthStateChanged } from 'firebase/auth'; // Import onAuthStateChanged

// It's good practice to fetch data directly in the component or via a custom hook
// if the service primarily uses client-side Firebase SDK.
// For server-side rendering or more complex scenarios, keep a dedicated service.
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

  // --- AUTHENTICATION STATES ---
  const [loadingAuth, setLoadingAuth] = useState(true); // Changed name to avoid conflict
  const [isAdmin, setIsAdmin] = useState(false);

  // --- DATA STATES ---
  const [allTransactions, setAllTransactions] = useState([]);
  const [error, setError] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [loadingData, setLoadingData] = useState(true); // Separate loading state for data

  // --- PAGINATION STATES ---
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10; // Number of items per page

  // --- AUTHENTICATION AND ROLE CHECK (Same as other admin pages) ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
      if (user) {
        // User is signed in, now check their role in Firestore
        try {
          const userDocRef = doc(db, 'users', user.uid);
          const userDocSnap = await getDoc(userDocRef);

          if (userDocSnap.exists() && userDocSnap.data()?.isAdmin) {
            setIsAdmin(true);
            setLoadingAuth(false);
          } else {
            // User is signed in but not an admin
            console.log('User is not an admin. Redirecting.');
            await firebaseAuth.signOut(); // Sign them out
            router.replace('/admin');
          }
        } catch (e) {
          console.error("Error checking admin role:", e);
          await firebaseAuth.signOut(); // Sign out on error
          router.replace('/admin');
        }
      } else {
        // No user is signed in
        console.log('No user signed in. Redirecting to admin login.');
        router.replace('/admin');
      }
    });

    return () => unsubscribe(); // Clean up auth listener
  }, [router]);


  // --- LOGOUT FUNCTION (Same as other admin pages) ---
  const logout = useCallback(async () => {
    try {
      await firebaseAuth.signOut();
      router.push('/admin');
    } catch (err) {
      console.error("Logout error:", err);
      alert('Failed to logout. Please try again.');
    }
  }, [router]);


  // --- DATA FETCHING LOGIC ---
  useEffect(() => {
    if (!isAdmin) return; // Only fetch data if user is confirmed admin

    const getProfitLoss = async () => {
      setLoadingData(true);
      setError('');
      try {
        const data = await fetchProfitLossData(); // This function should use client-side Firebase
        setAllTransactions(data);
      } catch (err) {
        console.error('Failed to fetch profit/loss data:', err);
        setError('Failed to load profit/loss data. Please try again.');
      } finally {
        setLoadingData(false);
      }
    };

    // Since fetchProfitLossData uses get() which is not real-time,
    // we might want to set up an interval or a refresh button
    // or convert fetchProfitLossData to use onSnapshot for real-time updates if preferred.
    // For now, let's fetch once on isAdmin change and then provide a refresh mechanism if needed.
    getProfitLoss();

    // Optionally, if you want real-time updates for deposits/cashouts,
    // you'd set up onSnapshot listeners directly in this component's useEffect,
    // similar to how it's done in Dashboard.js for recent orders.
    // For now, we'll stick with the existing fetchProfitLossData service.

  }, [isAdmin]); // Re-fetch data when isAdmin status changes


  // --- FILTERING AND AGGREGATION LOGIC ---
  const aggregatedUsers = useMemo(() => {
    const users = {};

    allTransactions.forEach(item => {
      const username = item.username;
      if (!users[username]) {
        users[username] = {
          username: username,
          fbUsername: item.fbUsername || 'N/A', // Assuming fbUsername exists
          totalDeposit: 0,
          totalCashout: 0,
          net: 0,
          profitMargin: 0,
        };
      }

      // Filter by date range (if applicable)
      const itemDate = new Date(item.time);
      const start = filterStartDate ? new Date(filterStartDate) : null;
      const end = filterEndDate ? new Date(filterEndDate) : null;

      if ((!start || itemDate >= start) && (!end || itemDate <= end)) {
        if (item.type === 'deposit') {
          users[username].totalDeposit += parseFloat(item.amount || 0);
        } else if (item.type === 'cashout') {
          users[username].totalCashout += parseFloat(item.amountUSD || item.amount || 0); // Use amountUSD for cashouts
        }
      }
    });

    return Object.values(users).map(user => {
      user.net = user.totalDeposit - user.totalCashout;
      user.profitMargin = user.totalDeposit > 0
        ? ((user.net / user.totalDeposit) * 100).toFixed(2)
        : 0; // Handle division by zero
      return user;
    });
  }, [allTransactions, filterStartDate, filterEndDate]);

  const filteredAndSortedUsers = useMemo(() => {
    let filtered = aggregatedUsers;

    // Apply search term filter
    if (searchTerm) {
      const lowerCaseSearchTerm = searchTerm.toLowerCase();
      filtered = filtered.filter(user =>
        user.username.toLowerCase().includes(lowerCaseSearchTerm) ||
        (user.fbUsername && user.fbUsername.toLowerCase().includes(lowerCaseSearchTerm))
      );
    }

    // Sort by net profit/loss (descending) by default
    return filtered.sort((a, b) => b.net - a.net);
  }, [aggregatedUsers, searchTerm]);

  // --- PAGINATION LOGIC ---
  const totalPages = Math.ceil(filteredAndSortedUsers.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const filteredAndSortedUsersForTable = filteredAndSortedUsers.slice(startIndex, endIndex);

  const nextPage = () => {
    setCurrentPage(prev => Math.min(prev + 1, totalPages));
  };

  const prevPage = () => {
    setCurrentPage(prev => Math.max(prev - 1, 1));
  };


  // --- CONDITIONAL RENDERING FOR LOADING/ACCESS ---
  if (loadingAuth) {
    return (
      <div className="container mt-lg text-center">
        <p>Loading admin panel...</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="container mt-lg text-center">
        <p>Access Denied. You are not authorized to view this page.</p>
      </div>
    );
  }

  return (
    <div className="admin-profit-loss-container">
      <Head>
        <title>Admin Profit/Loss</title>
      </Head>
      <header className="admin-header">
        <h1>Profit/Loss Report</h1>
        <nav>
          <ul className="admin-nav">
            <li><a href="/admin/dashboard" className={router.pathname === "/admin/dashboard" ? "active" : ""}>Dashboard</a></li>
            <li><a href="/admin/cashouts" className={router.pathname === "/admin/cashouts" ? "active" : ""}>Cashouts</a></li>
            <li><a href="/admin/games" className={router.pathname === "/admin/games" ? "active" : ""}>Games</a></li>
            <li><a href="/admin/profit-loss" className={router.pathname === "/admin/profit-loss" ? "active" : ""}>Profit/Loss</a></li>
            <li><button onClick={logout} className="btn btn-secondary">Logout</button></li>
          </ul>
        </nav>
      </header>

      <div className="admin-main">
        <section className="filters-section">
          <h2>Filters</h2>
          <div className="card">
            <div className="filter-group">
              <label htmlFor="search-term">Search Username:</label>
              <input
                id="search-term"
                type="text"
                className="input"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by username or Firebase username"
              />
            </div>
            <div className="filter-group">
              <label htmlFor="start-date">Start Date:</label>
              <input
                id="start-date"
                type="date"
                className="input"
                value={filterStartDate}
                onChange={(e) => setFilterStartDate(e.target.value)}
              />
            </div>
            <div className="filter-group">
              <label htmlFor="end-date">End Date:</label>
              <input
                id="end-date"
                type="date"
                className="input"
                value={filterEndDate}
                onChange={(e) => setFilterEndDate(e.target.value)}
              />
            </div>
          </div>
        </section>

        <section className="profit-loss-data mt-lg">
          <h2>User Profit/Loss Summary</h2>
          {error && <div className="alert alert-danger mt-md">{error}</div>}
          {loadingData ? (
            <LoadingSkeleton />
          ) : filteredAndSortedUsersForTable.length === 0 ? (
            <div className="card">
              <p className="text-center">No matching profit/loss data found.</p>
            </div>
          ) : (
            <div className="card table-card">
              <div className="table-responsive">
              <table>
                <thead>
                  <tr>
                    <th>Username</th>
                    <th>Firebase Username</th>
                    <th>Total Deposit</th>
                    <th>Total Cashout</th>
                    <th>Net Profit/Loss</th>
                    <th>Profit Margin</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAndSortedUsersForTable.map(user => (
                    <tr key={user.username}>
                      <td>{user.username}</td>
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
        </section> {/* THIS IS THE CORRECTED LINE */}
      </div>
    </div>
  );
}