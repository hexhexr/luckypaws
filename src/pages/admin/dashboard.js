// src/pages/admin/dashboard.js
import { useEffect, useState, useCallback, useMemo } from 'react'; // Added useMemo
import { useRouter } from 'next/router';
import Head from 'next/head';
import { db } from '../../lib/firebaseClient';
import { auth as firebaseAuth } from '../../lib/firebaseClient';
// Corrected import: Removed `limit` from import list as it's not used in the final query
import { collection, query, where, onSnapshot, orderBy, addDoc, serverTimestamp, getDocs, doc, deleteDoc, updateDoc, setDoc, getDoc } from "firebase/firestore";
import { onAuthStateChanged } from 'firebase/auth'; // Removed createUserWithEmailAndPassword as it's not used here

// --- Helper Components ---

const StatCard = ({ title, value, icon, color }) => (
    // Uses .card as a base but keeps specific styling for layout and dynamic color
    <div className="card stat-card" style={{ borderColor: color }}> {/* Added explicit shadow matching .card */}
        <div>
            <h4 className="stat-card-title" style={{ color }}>{title}</h4>
            <h2 className="stat-card-value">{value}</h2>
        </div>
        <span className="stat-card-icon" style={{ color }}>{icon}</span>
    </div>
);

const OrderDetailModal = ({ order, onClose }) => {
    if (!order) return null;
    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
                <button className="modal-close-btn" onClick={onClose}>&times;</button>
                <h3>Order Details: {order.id}</h3>
                <div className="modal-content-grid">
                    <p><strong>Username:</strong> {order.username}</p>
                    <p><strong>Amount:</strong> ${parseFloat(order.amount || 0).toFixed(2)}</p>
                    <p><strong>Status:</strong> {order.status}</p>
                    <p><strong>Created:</strong> {order.created ? new Date(order.created).toLocaleString() : 'N/A'}</p>
                    <p><strong>Method:</strong> {order.method || 'N/A'}</p>
                    <p><strong>Transaction ID:</strong> {order.transactionId || 'N/A'}</p>
                    <p><strong>Lightning Invoice:</strong> {order.lightningInvoice || 'N/A'}</p>
                    <p><strong>Gateway ID:</strong> {order.paymentGatewayId || 'N/A'}</p>
                    <p><strong>Read:</strong> {order.read ? 'Yes' : 'No'}</p>
                </div>
            </div>
        </div>
    );
};

// New Sortable Table Header Component
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


export default function AdminDashboard() {
  const router = useRouter();

  // --- AUTHENTICATION STATES ---
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  // --- DASHBOARD DATA STATES ---
  const [totalOrders, setTotalOrders] = useState(0);
  const [totalPaidOrders, setTotalPaidOrders] = useState(0);
  const [totalPendingOrders, setTotalPendingOrders] = useState(0);
  const [totalUsers, setTotalUsers] = useState(0);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [totalCashouts, setTotalCashouts] = useState(0);
  const [allOrders, setAllOrders] = useState([]); // Stores all orders for client-side processing
  const [error, setError] = useState('');
  const [modalOrder, setModalOrder] = useState(null);

  // --- NEW FILTERING, SORTING, PAGINATION STATES ---
  const [statusFilter, setStatusFilter] = useState('paid'); // Default to 'paid'
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState('created'); // Default sort field
  const [sortDirection, setSortDirection] = useState('desc'); // Default sort direction
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

  // --- LOGOUT FUNCTION ---
  const logout = useCallback(async () => {
    try {
      await firebaseAuth.signOut();
      router.push('/admin');
    } catch (err) {
      console.error("Logout error:", err);
      alert('Failed to logout. Please try again.');
    }
  }, [router]);

  // --- DATA FETCHING ---
  useEffect(() => {
    if (!isAdmin) return;

    setError('');

    // Fetch total number of orders in real-time
    const unsubscribeTotalOrders = onSnapshot(collection(db, 'orders'), (snapshot) => {
      setTotalOrders(snapshot.size);
    }, (error) => {
      console.error("Error fetching total orders count:", error);
      setError("Failed to load total orders count.");
    });

    // Fetch all orders based on statusFilter for client-side processing
    // Removed `limit(10)` and `orderBy` from this Firestore query to fetch all relevant orders
    let ordersRef = collection(db, 'orders');
    let ordersQuery = statusFilter === 'all'
        ? query(ordersRef) // Get all orders if filter is 'all'
        : query(ordersRef, where('status', '==', statusFilter)); // Filter by status

    const unsubscribeOrders = onSnapshot(ordersQuery, (snapshot) => {
      let paid = 0;
      let pending = 0;
      let revenue = 0;

      const fetchedOrders = snapshot.docs.map(doc => {
        const data = doc.data();
        if (data.status === 'paid') {
          paid++;
          revenue += parseFloat(data.amount || 0);
        } else if (data.status === 'pending') {
          pending++;
        }
        return {
          id: doc.id,
          ...data,
          // Convert Firestore Timestamp to ISO string or keep original if not Timestamp
          created: data.created?.toDate ? data.created.toDate().toISOString() : data.created,
          // Ensure amount is a number for search/sort
          amount: parseFloat(data.amount || 0)
        };
      });
      setAllOrders(fetchedOrders); // Store all filtered orders for client-side processing
      setTotalPaidOrders(paid);
      setTotalPendingOrders(pending);
      setTotalRevenue(revenue);
      setCurrentPage(1); // Reset to first page on filter/data change
    }, (error) => {
      console.error("Error fetching recent orders:", error);
      setError("Failed to load orders.");
    });

    // Fetch total users
    const unsubscribeUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      setTotalUsers(snapshot.size);
    }, (error) => {
      console.error("Error fetching users count:", error);
      setError("Failed to load users count.");
    });

    // Fetch total cashouts from the 'cashouts' collection
    const cashoutsQuery = query(collection(db, 'cashouts'), where('status', '==', 'completed'));
    const unsubscribeCashouts = onSnapshot(cashoutsQuery, (snapshot) => {
      let totalCashoutsValue = 0;
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        totalCashoutsValue += parseFloat(data.amountUSD || data.amount || 0);
      });
      setTotalCashouts(totalCashoutsValue);
    }, (error) => {
      console.error("Error fetching total cashouts:", error);
      setError("Failed to load total cashouts.");
    });

    // Cleanup function for all listeners
    return () => {
      unsubscribeTotalOrders();
      unsubscribeOrders();
      unsubscribeUsers();
      unsubscribeCashouts();
    };
  }, [isAdmin, statusFilter]); // Re-run effect if statusFilter changes

  // --- CLIENT-SIDE FILTERING, SORTING, PAGINATION LOGIC ---
  const processedOrders = useMemo(() => {
    let filtered = allOrders;

    // Search Filtering
    if (searchTerm) {
      const lowerCaseSearchTerm = searchTerm.toLowerCase();
      filtered = filtered.filter(order =>
        order.username?.toLowerCase().includes(lowerCaseSearchTerm) ||
        order.amount?.toString().includes(lowerCaseSearchTerm) ||
        order.lightningInvoice?.toLowerCase().includes(lowerCaseSearchTerm) ||
        order.facebookName?.toLowerCase().includes(lowerCaseSearchTerm) // Assuming facebookName might exist
      );
    }

    // Sorting
    const sorted = [...filtered].sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];

      // Handle date sorting (assuming 'created' is an ISO string or comparable)
      if (sortField === 'created') {
        valA = new Date(valA);
        valB = new Date(valB);
      } else if (typeof valA === 'string') {
        valA = valA.toLowerCase();
        valB = valB.toLowerCase();
      }

      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return sorted;
  }, [allOrders, searchTerm, sortField, sortDirection]);

  // Pagination calculation
  const totalPages = Math.ceil(processedOrders.length / itemsPerPage);
  const paginatedOrders = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return processedOrders.slice(startIndex, endIndex);
  }, [processedOrders, currentPage, itemsPerPage]);

  // --- HANDLERS FOR NEW UI CONTROLS ---
  const handleSort = useCallback((field) => {
    if (field === sortField) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc'); // Default to descending for new sort field
    }
    setCurrentPage(1); // Reset page on sort change
  }, [sortField, sortDirection]);

  const handleStatusFilterChange = useCallback((filter) => {
    setStatusFilter(filter);
    // currentPage will be reset in the useEffect for orders due to statusFilter dependency
  }, []);

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


  // --- ORDER ACTIONS ---
  const viewOrderDetails = (orderId) => {
    // Find the order from the complete list, not just recentOrders
    const order = allOrders.find(o => o.id === orderId);
    setModalOrder(order);
  };

  const markAsRead = async (orderId) => {
    try {
      const orderRef = doc(db, 'orders', orderId);
      await updateDoc(orderRef, { read: true });
      // UI will update automatically due to onSnapshot
    } catch (err) {
      console.error("Error marking order as read:", err);
      alert('Failed to mark order as read.');
    }
  };

  const archiveOrder = async (orderId) => {
    try {
      const orderRef = doc(db, 'orders', orderId);
      await updateDoc(orderRef, { status: 'archived' }); // Or move to a separate 'archivedOrders' collection
      // UI will update automatically due to onSnapshot
    } catch (err) {
      console.error("Error archiving order:", err);
      alert('Failed to archive order.');
    }
  };

  // --- CONDITIONAL RENDERING FOR LOADING/ACCESS ---
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
    <div className="admin-dashboard-container">
      <Head>
        <title>Admin Dashboard</title>
      </Head>
      <header className="admin-header">
        <h1>Admin Dashboard</h1>
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

        <section className="stats-grid">
          <StatCard
            title="Total Orders"
            value={totalOrders}
            icon="📦"
            color="var(--primary-blue)" // Changed from var(--blue) for consistency
          />
          <StatCard
            title="Paid Orders"
            value={totalPaidOrders}
            icon="✅"
            color="var(--primary-green)"
          />
          <StatCard
            title="Pending Orders"
            value={totalPendingOrders}
            icon="⏳"
            color="var(--orange)"
          />
          <StatCard
            title="Total Users"
            value={totalUsers}
            icon="👥"
            color="var(--purple)"
          />
          <StatCard
            title="Total Revenue"
            value={`$${parseFloat(totalRevenue).toFixed(2)}`}
            icon="💰"
            color="var(--primary-green)"
          />
          <StatCard
            title="Total Cashouts"
            value={`$${parseFloat(totalCashouts).toFixed(2)}`}
            icon="💸"
            color="var(--red-alert)"
          />
        </section>

        <section className="recent-orders-section mt-lg">
            <h2>Orders Management</h2> {/* Changed heading */}

            <div className="card filter-controls mb-lg"> {/* New filter control container */}
                <div className="filter-group">
                    <label htmlFor="orderSearch">Search Orders:</label>
                    <input
                        type="text"
                        id="orderSearch"
                        className="input"
                        placeholder="Username, Amount, Invoice, Facebook Name..."
                        value={searchTerm}
                        onChange={handleSearchChange}
                    />
                </div>

                <div className="filter-group">
                    <label>Status Filter:</label>
                    <div className="status-filter-buttons">
                        <button
                            className={`btn btn-small ${statusFilter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
                            onClick={() => handleStatusFilterChange('all')}
                        >
                            All
                        </button>
                        <button
                            className={`btn btn-small ${statusFilter === 'paid' ? 'btn-primary' : 'btn-secondary'}`}
                            onClick={() => handleStatusFilterChange('paid')}
                        >
                            Paid
                        </button>
                        <button
                            className={`btn btn-small ${statusFilter === 'pending' ? 'btn-primary' : 'btn-secondary'}`}
                            onClick={() => handleStatusFilterChange('pending')}
                        >
                            Pending
                        </button>
                    </div>
                </div>

                <div className="filter-group">
                    <label htmlFor="itemsPerPage">Orders per page:</label>
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
            {paginatedOrders.length === 0 && !loading ? (
                <p className="text-center">No orders to display based on current filters.</p>
            ) : (
                <div className="table-responsive">
                <table>
                    <thead>
                    <tr>
                        <SortableTableHeader
                            label="Order ID"
                            field="id"
                            currentSortField={sortField}
                            currentSortDirection={sortDirection}
                            onSort={handleSort}
                        />
                        <SortableTableHeader
                            label="Username"
                            field="username"
                            currentSortField={sortField}
                            currentSortDirection={sortDirection}
                            onSort={handleSort}
                        />
                         <SortableTableHeader
                            label="Amount"
                            field="amount"
                            currentSortField={sortField}
                            currentSortDirection={sortDirection}
                            onSort={handleSort}
                        />
                         <SortableTableHeader
                            label="Status"
                            field="status"
                            currentSortField={sortField}
                            currentSortDirection={sortDirection}
                            onSort={handleSort}
                        />
                        <SortableTableHeader
                            label="Created"
                            field="created"
                            currentSortField={sortField}
                            currentSortDirection={sortDirection}
                            onSort={handleSort}
                        />
                        <th>Method</th>
                        <th>Transaction ID</th>
                        <th>Lightning Invoice</th>
                        <th>Actions</th>
                    </tr>
                    </thead>
                    <tbody>
                    {paginatedOrders.map((order) => (
                        <tr key={order.id} className={order.read ? 'order-read' : 'order-unread'}>
                        <td>{order.id}</td>
                        <td>{order.username}</td>
                        <td className="text-bold">${parseFloat(order.amount || 0).toFixed(2)}</td>
                        <td>
                            <span className={`status-badge status-${order.status}`}>
                               {order.status ? order.status.charAt(0).toUpperCase() + order.status.slice(1) : 'N/A'}
                            </span>
                        </td>
                        <td>{order.created ? new Date(order.created).toLocaleString() : 'N/A'}</td>
                        <td>{order.method || 'N/A'}</td>
                        <td>{order.transactionId || 'N/A'}</td>
                        <td>{order.lightningInvoice || 'N/A'}</td>
                        <td>
                            <div className="action-buttons">
                                <button className="btn btn-info btn-small" onClick={() => viewOrderDetails(order.id)}>Details</button>
                                {/* THE FIX IS APPLIED HERE */}
                                {order.status === 'paid' && !order.read && (
                                <button className="btn btn-success btn-small" onClick={async () => await markAsRead(order.id)}>Mark Read</button>
                                )}
                                {order.status !== 'archived' && (
                                    <button className="btn btn-secondary btn-small" onClick={async () => await archiveOrder(order.id)}>Archive</button>
                                )}
                            </div>
                        </td>
                        </tr>
                    ))}
                    </tbody>
                </table>
                </div>
            )}
            </div>

            {/* Pagination Controls */}
            {processedOrders.length > itemsPerPage && ( // Only show if there's more than one page
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

        {modalOrder && <OrderDetailModal order={modalOrder} onClose={() => setModalOrder(null)} />}
      </main>
    </div>
  );
}