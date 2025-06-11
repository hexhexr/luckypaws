// pages/admin/profit-loss.js
import { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';

import { db, auth as firebaseAuth } from '../../lib/firebaseClient';
import { collection, query, onSnapshot, doc, getDoc, where } from 'firebase/firestore'; // Added 'where'
import { onAuthStateChanged } from 'firebase/auth';

// Removed: import { fetchProfitLossData } from '../../services/profitLossService';
// Reason: Data fetching is now integrated directly into the component for real-time aggregation.

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
    <div className="skeleton-line" style={{ width: '75%' }}></div>
  </div>
);

// Sortable Table Header Component (reused from dashboard)
const SortableTableHeader = ({ label, field, currentSortField, currentSortDirection, onSort }) => {
    const isCurrent = field === currentSortField;
    const sortIcon = isCurrent
        ? (currentSortDirection === 'asc' ? '▲' : '▼')
        : '';
    return (
        <th onClick={() => onSort(field)} style={{ cursor: 'pointer' }}>
            {label} {sortIcon}
        </th>
    );
};

export default function AdminProfitLoss() {
  const router = useRouter();

  // --- AUTHENTICATION STATES ---
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  // --- DATA STATES ---
  const [orders, setOrders] = useState([]); // All paid orders (deposits)
  const [cashouts, setCashouts] = useState([]); // All completed cashouts
  const [error, setError] = useState('');

  // --- FILTERING, SORTING, PAGINATION STATES (for User Profit/Loss table) ---
  const [timeframeFilter, setTimeframeFilter] = useState('all-time-users'); // 'daily', 'weekly', 'all-time-users'
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState('net'); // Default sort by net profit
  const [sortDirection, setSortDirection] = useState('desc'); // Default sort desc
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10); // Default items per page

  // --- AUTHENTICATION AND ROLE CHECK ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
      if (user) {
        try {
          const userDocRef = doc(db, 'users', user.uid);
          const userDocSnap = await getDoc(userDocRef);

          if (userDocSnap.exists() && userDocSnap.data()?.isAdmin) {
            setIsAdmin(true);
            setLoading(false);
          } else {
            console.log('User is not an admin. Redirecting.');
            await firebaseAuth.signOut();
            router.replace('/admin');
          }
        } catch (e) {
          console.error("Error checking admin role:", e);
          await firebaseAuth.signOut();
          router.replace('/admin');
        }
      } else {
        console.log('No user signed in. Redirecting to admin login.');
        router.replace('/admin');
      }
    });

    return () => unsubscribe();
  }, [router]);


  // --- REAL-TIME DATA FETCHING (Orders and Cashouts) ---
  useEffect(() => {
    if (!isAdmin) return;

    setError('');

    // Fetch all paid orders (deposits)
    const unsubscribeOrders = onSnapshot(
      query(collection(db, 'orders'), where('status', '==', 'paid')),
      (snapshot) => {
        setOrders(snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          created: doc.data().created?.toDate ? doc.data().created.toDate() : null, // Convert Timestamp to Date object
          amount: parseFloat(doc.data().amount || 0)
        })));
      },
      (err) => {
        console.error("Error fetching orders:", err);
        setError("Failed to load orders data.");
      }
    );

    // Fetch all completed cashouts from the 'cashouts' collection
    const unsubscribeCashouts = onSnapshot(
      query(collection(db, 'cashouts'), where('status', '==', 'completed')),
      (snapshot) => {
        setCashouts(snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          created: doc.data().created?.toDate ? doc.data().created.toDate() : null, // Assuming 'created' field exists and is Timestamp
          amount: parseFloat(doc.data().amountUSD || doc.data().amount || 0) // Use amountUSD if available, else amount
        })));
      },
      (err) => {
        console.error("Error fetching cashouts:", err);
        setError("Failed to load cashouts data.");
      }
    );

    return () => {
      unsubscribeOrders();
      unsubscribeCashouts();
    };
  }, [isAdmin]);


  // --- AGGREGATION LOGIC (Daily/Weekly/All-Time User Profit/Loss) ---

  // Combined and sorted transactions for time-based aggregation
  const allTransactions = useMemo(() => {
    const combined = [
      ...orders.map(o => ({ ...o, type: 'deposit', transactionDate: o.created, username: o.username })),
      ...cashouts.map(c => ({ ...c, type: 'cashout', transactionDate: c.created, username: c.username }))
    ].filter(t => t.transactionDate !== null); // Filter out transactions without valid dates

    return combined.sort((a, b) => a.transactionDate.getTime() - b.transactionDate.getTime()); // Sort oldest to newest
  }, [orders, cashouts]);


  // Daily Profit/Loss Aggregation
  const dailyStats = useMemo(() => {
    const stats = {}; // { 'YYYY-MM-DD': { totalDeposits: X, totalCashouts: Y, net: Z } }
    allTransactions.forEach(t => {
      const dateKey = t.transactionDate.toISOString().slice(0, 10); // YYYY-MM-DD
      if (!stats[dateKey]) {
        stats[dateKey] = { date: dateKey, totalDeposits: 0, totalCashouts: 0, net: 0 };
      }
      if (t.type === 'deposit') {
        stats[dateKey].totalDeposits += t.amount;
        stats[dateKey].net += t.amount;
      } else if (t.type === 'cashout') {
        stats[dateKey].totalCashouts += t.amount;
        stats[dateKey].net -= t.amount;
      }
    });
    return Object.values(stats).sort((a, b) => b.date.localeCompare(a.date)); // Sort newest to oldest
  }, [allTransactions]);

  // Weekly Profit/Loss Aggregation
  const weeklyStats = useMemo(() => {
    const stats = {}; // { 'YYYY-WW': { totalDeposits: X, totalCashouts: Y, net: Z } }

    allTransactions.forEach(t => {
      // Get week number (ISO week date - week starts on Monday)
      const date = t.transactionDate;
      const year = date.getFullYear();
      const firstDayOfYear = new Date(year, 0, 1);
      const days = Math.floor((date.getTime() - firstDayOfYear.getTime()) / (24 * 60 * 60 * 1000));
      // This is a simplified week number calculation. For strict ISO week, a more robust function is needed.
      // For general purposes, this will group by approximate weeks.
      const weekNumber = Math.ceil((days + firstDayOfYear.getDay() + 1) / 7);

      const weekKey = `${year}-${String(weekNumber).padStart(2, '0')}`;

      if (!stats[weekKey]) {
        stats[weekKey] = { week: weekKey, totalDeposits: 0, totalCashouts: 0, net: 0 };
      }
      if (t.type === 'deposit') {
        stats[weekKey].totalDeposits += t.amount;
        stats[weekKey].net += t.amount;
      } else if (t.type === 'cashout') {
        stats[weekKey].totalCashouts += t.amount;
        stats[weekKey].net -= t.amount;
      }
    });
    return Object.values(stats).sort((a, b) => b.week.localeCompare(a.week)); // Sort newest to oldest
  }, [allTransactions]);


  // All-Time User Profit/Loss Aggregation (from combined orders & cashouts)
  const userProfitLossData = useMemo(() => {
    const userMap = {}; // { username: { totalDeposits, totalCashout, net, profitMargin } }

    allTransactions.forEach(t => {
      const username = t.username || 'Unknown User'; // Handle cases where username might be missing
      if (!userMap[username]) {
        userMap[username] = {
          username,
          totalDeposits: 0,
          totalCashout: 0,
          net: 0,
          profitMargin: 0
        };
      }

      if (t.type === 'deposit') {
        userMap[username].totalDeposits += t.amount;
      } else if (t.type === 'cashout') {
        userMap[username].totalCashout += t.amount;
      }
      userMap[username].net = userMap[username].totalDeposits - userMap[username].totalCashout;
      userMap[username].profitMargin = userMap[username].totalDeposits > 0
        ? ((userMap[username].net / userMap[username].totalDeposits) * 100).toFixed(2)
        : 0;
    });

    return Object.values(userMap);
  }, [allTransactions]);

  // --- CLIENT-SIDE FILTERING, SORTING, PAGINATION LOGIC (for User table) ---
  const filteredAndSortedUsers = useMemo(() => {
    let filtered = userProfitLossData;

    // Search Filtering
    if (searchTerm) {
      const lowerCaseSearchTerm = searchTerm.toLowerCase();
      filtered = filtered.filter(user =>
        user.username.toLowerCase().includes(lowerCaseSearchTerm)
      );
    }

    // Sorting
    const sorted = [...filtered].sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];

      // Handle numeric sorting (for amount, net, profitMargin)
      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortDirection === 'asc' ? valA - valB : valB - valA;
      }
      // Handle string sorting (for username)
      if (typeof valA === 'string' && typeof valB === 'string') {
        return sortDirection === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return 0;
    });

    return sorted;
  }, [userProfitLossData, searchTerm, sortField, sortDirection]);

  // Pagination calculation for user table
  const totalPages = Math.ceil(filteredAndSortedUsers.length / itemsPerPage);
  const paginatedUsers = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredAndSortedUsers.slice(startIndex, endIndex);
  }, [filteredAndSortedUsers, currentPage, itemsPerPage]);


  // --- HANDLERS FOR UI CONTROLS ---
  const handleSort = useCallback((field) => {
    if (field === sortField) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc'); // Default to descending for new sort field
    }
    setCurrentPage(1); // Reset page on sort change
  }, [sortField, sortDirection]);

  const handleSearchChange = useCallback((e) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1); // Reset page on search change
  }, []);

  const handleItemsPerPageChange = useCallback((e) => {
    setItemsPerPage(Number(e.target.value));
    setCurrentPage(1); // Reset page on items per page change
  }, []);

  const nextPage = useCallback(() => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  }, [currentPage, totalPages]);

  const prevPage = useCallback(() => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  }, [currentPage]);

  const logout = async () => {
    try {
      await firebaseAuth.signOut();
      router.push('/admin');
    } catch (error) {
      console.error("Error logging out:", error);
      alert('Failed to log out. Please try again.');
    }
  };


  // --- CONDITIONAL RENDERING ---
  if (loading) {
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
        <h1>Admin Profit/Loss</h1>
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

      <main className="admin-main-content">
        {error && <div className="alert alert-danger mb-lg">{error}</div>}

        <section className="timeframe-selection mb-lg card">
            <h2>Profit & Loss Overview</h2>
            <div className="status-filter-buttons"> {/* Reusing button group styling */}
                <button
                    className={`btn ${timeframeFilter === 'daily' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setTimeframeFilter('daily')}
                >
                    Daily Stats
                </button>
                <button
                    className={`btn ${timeframeFilter === 'weekly' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setTimeframeFilter('weekly')}
                >
                    Weekly Stats
                </button>
                <button
                    className={`btn ${timeframeFilter === 'all-time-users' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setTimeframeFilter('all-time-users')}
                >
                    All-Time User P/L
                </button>
            </div>
        </section>

        {timeframeFilter === 'daily' && (
            <section className="daily-stats-section mt-lg">
                <h2>Daily Profit & Loss</h2>
                <div className="card table-card">
                    {dailyStats.length === 0 ? (
                        <p className="text-center">No daily data available.</p>
                    ) : (
                        <div className="table-responsive">
                        <table>
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Total Deposits</th>
                                    <th>Total Cashouts</th>
                                    <th>Net P/L</th>
                                </tr>
                            </thead>
                            <tbody>
                                {dailyStats.map(stat => (
                                    <tr key={stat.date}>
                                        <td>{stat.date}</td>
                                        <td>{formatCurrency(stat.totalDeposits)}</td>
                                        <td>{formatCurrency(stat.totalCashouts)}</td>
                                        <td style={{ color: stat.net >= 0 ? 'var(--primary-green)' : 'var(--red-alert)' }}>
                                            {formatCurrency(stat.net)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        </div>
                    )}
                </div>
            </section>
        )}

        {timeframeFilter === 'weekly' && (
            <section className="weekly-stats-section mt-lg">
                <h2>Weekly Profit & Loss</h2>
                <div className="card table-card">
                    {weeklyStats.length === 0 ? (
                        <p className="text-center">No weekly data available.</p>
                    ) : (
                        <div className="table-responsive">
                        <table>
                            <thead>
                                <tr>
                                    <th>Week (YYYY-WW)</th>
                                    <th>Total Deposits</th>
                                    <th>Total Cashouts</th>
                                    <th>Net P/L</th>
                                </tr>
                            </thead>
                            <tbody>
                                {weeklyStats.map(stat => (
                                    <tr key={stat.week}>
                                        <td>{stat.week}</td>
                                        <td>{formatCurrency(stat.totalDeposits)}</td>
                                        <td>{formatCurrency(stat.totalCashouts)}</td>
                                        <td style={{ color: stat.net >= 0 ? 'var(--primary-green)' : 'var(--red-alert)' }}>
                                            {formatCurrency(stat.net)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        </div>
                    )}
                </div>
            </section>
        )}


        {timeframeFilter === 'all-time-users' && (
            <section className="user-profit-loss-section mt-lg">
                <h2>All-Time User Profit/Loss</h2>

                <div className="card filter-controls mb-lg">
                    <div className="filter-group">
                        <label htmlFor="userSearch">Search User:</label>
                        <input
                            type="text"
                            id="userSearch"
                            className="input"
                            placeholder="Search by username..."
                            value={searchTerm}
                            onChange={handleSearchChange}
                        />
                    </div>
                     <div className="filter-group">
                        <label htmlFor="itemsPerPage">Users per page:</label>
                        <select
                            id="itemsPerPage"
                            className="input"
                            value={itemsPerPage}
                            onChange={handleItemsPerPageChange}
                        >
                            <option value={5}>5</option>
                            <option value={10}>10</option>
                            <option value={20}>20</option>
                            <option value={50}>50</option>
                        </select>
                    </div>
                </div>

                <div className="card table-card">
                {paginatedUsers.length === 0 && !loading ? (
                    <p className="text-center">No users to display based on current filters.</p>
                ) : (
                    <div className="table-responsive">
                    <table>
                        <thead>
                        <tr>
                            <SortableTableHeader
                                label="Username"
                                field="username"
                                currentSortField={sortField}
                                currentSortDirection={sortDirection}
                                onSort={handleSort}
                            />
                            <SortableTableHeader
                                label="Total Deposits"
                                field="totalDeposits"
                                currentSortField={sortField}
                                currentSortDirection={sortDirection}
                                onSort={handleSort}
                            />
                            <SortableTableHeader
                                label="Total Cashout"
                                field="totalCashout"
                                currentSortField={sortField}
                                currentSortDirection={sortDirection}
                                onSort={handleSort}
                            />
                            <SortableTableHeader
                                label="Net P/L"
                                field="net"
                                currentSortField={sortField}
                                currentSortDirection={sortDirection}
                                onSort={handleSort}
                            />
                            <SortableTableHeader
                                label="Profit Margin"
                                field="profitMargin"
                                currentSortField={sortField}
                                currentSortDirection={sortDirection}
                                onSort={handleSort}
                            />
                            <th>Actions</th>
                        </tr>
                        </thead>
                        <tbody>
                        {paginatedUsers.map((user) => (
                            <tr key={user.username}>
                                <td>{user.username}</td>
                                <td className="text-bold text-success">{formatCurrency(user.totalDeposits)}</td>
                                <td className="text-bold text-danger">{formatCurrency(user.totalCashout)}</td>
                                <td className="text-bold" style={{ color: user.net >= 0 ? 'var(--primary-green)' : 'var(--red-alert)' }}>
                                    {formatCurrency(user.net)}
                                </td>
                                <td className="text-bold">{user.profitMargin}%</td>
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
                </div>

                {filteredAndSortedUsers.length > itemsPerPage && (
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
        )}
      </main>
    </div>
  );
}