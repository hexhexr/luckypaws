import { useEffect, useState } from 'react';

export default function AdminDashboard() {
  const [orders, setOrders] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [methodFilter, setMethodFilter] = useState('all');
  const [sortKey, setSortKey] = useState('created');
  const [sortDir, setSortDir] = useState('desc');
  const [page, setPage] = useState(1);
  const [confirm, setConfirm] = useState(null);
  const pageSize = 10;

  const fetchOrders = async () => {
    try {
      const res = await fetch('/api/orders');
      let ordersList = await res.json();
      if (!Array.isArray(ordersList)) ordersList = [];

      // Check live status from Speed API for each pending
      const checkedOrders = await Promise.all(
        ordersList.map(async (order) => {
          if (order.status !== 'pending') return order;

          try {
            const checkRes = await fetch(`/api/check-payment-status?id=${order.orderId}`);
            const checkData = await checkRes.json();
            if (checkData?.status === 'paid') {
              return { ...order, status: 'paid' };
            }
          } catch (err) {
            console.error(`Speed check failed for ${order.orderId}`, err);
          }

          return order;
        })
      );

      setOrders(checkedOrders);
    } catch (err) {
      console.error('Failed to fetch orders:', err);
    }
  };

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 2000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let list = [...orders];
    const q = search.toLowerCase();
    if (search) list = list.filter(o => o.username.toLowerCase().includes(q) || o.orderId.toLowerCase().includes(q));
    if (statusFilter !== 'all') list = list.filter(o => o.status === statusFilter);
    if (methodFilter !== 'all') list = list.filter(o => o.method === methodFilter);
    list.sort((a, b) => {
      const aVal = sortKey === 'amount' ? parseFloat(a.amount) : new Date(a.created);
      const bVal = sortKey === 'amount' ? parseFloat(b.amount) : new Date(b.created);
      return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
    });
    setFiltered(list);
    setPage(1);
  }, [orders, search, statusFilter, methodFilter, sortKey, sortDir]);

  const pageCount = Math.ceil(filtered.length / pageSize);
  const pageData = filtered.slice((page - 1) * pageSize, page * pageSize);

  const toggleSort = key => {
    if (sortKey === key) setSortDir(prev => (prev === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const columns = [
    { label: 'Order ID', key: 'orderId' },
    { label: 'User', key: 'username' },
    { label: 'Game', key: 'game' },
    { label: 'USD', key: 'amount' },
    { label: 'BTC', key: 'btc' },
    { label: 'Method', key: 'method' },
    { label: 'Status', key: 'status' },
    { label: 'Manual', key: 'paidManually' },
    { label: 'Date', key: 'created' },
  ];

  const handleConfirm = async () => {
    if (!confirm) return;
    const { type, orderId } = confirm;
    const url = type === 'pay' ? '/api/orders/update' : '/api/orders/delete';
    const body = type === 'pay' ? { orderId, status: 'paid' } : { orderId };

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const result = await res.json();
      if (!res.ok) console.error('API error:', result.message || 'Unknown error');
    } catch (err) {
      console.error('Fetch error:', err);
    }

    setConfirm(null);
    fetchOrders();
  };

  return (
    <div className="admin-dashboard">
      <aside className="sidebar">
        <h1>Lucky Paw Admin</h1>
        <button className="nav-btn" onClick={() => window.location.reload()}>Refresh</button>
        <button className="nav-btn" onClick={() => {
          document.cookie = 'admin_auth=; Max-Age=0; path=/;';
          window.location.href = '/admin';
        }}>Logout</button>
      </aside>

      <main className="main-content">
        <header className="header">
          <h2>Orders</h2>
          <div className="controls">
            <input type="text" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} />
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="paid">Paid</option>
            </select>
            <select value={methodFilter} onChange={e => setMethodFilter(e.target.value)}>
              <option value="all">All Methods</option>
              <option value="lightning">Lightning</option>
              <option value="onchain">On-chain</option>
            </select>
            <button className="btn" onClick={fetchOrders}>Refresh</button>
          </div>
        </header>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                {columns.map(col => (
                  <th key={col.key} onClick={() => toggleSort(col.key)}>
                    {col.label}
                    {sortKey === col.key && <span className="sort-arrow">{sortDir === 'asc' ? ' ▲' : ' ▼'}</span>}
                  </th>
                ))}
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pageData.map(o => {
                const date = new Date(o.created);
                return (
                  <tr key={o.orderId}>
                    <td>{o.orderId}</td>
                    <td>{o.username}</td>
                    <td>{o.game}</td>
                    <td>${o.amount}</td>
                    <td>{o.btc || '—'}</td>
                    <td>{o.method}</td>
                    <td><span className={`status-tag ${o.status}`}>{o.status}</span></td>
                    <td>
                      <span className={`badge ${o.paidManually ? 'badge-green' : 'badge-gray'}`}>
                        {o.paidManually ? 'Yes' : 'No'}
                      </span>
                    </td>
                    <td>{date.toLocaleDateString()}<br />{date.toLocaleTimeString()}</td>
                    <td>
                      {o.status !== 'paid' && (
                        <button className="action-btn" onClick={() => setConfirm({ type: 'pay', orderId: o.orderId })}>Pay</button>
                      )}
                      <button className="action-btn delete" onClick={() => setConfirm({ type: 'delete', orderId: o.orderId })}>Del</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <footer className="footer">
          <button disabled={page === 1} onClick={() => setPage(p => p - 1)}>Prev</button>
          <span>{page} / {pageCount}</span>
          <button disabled={page === pageCount} onClick={() => setPage(p => p + 1)}>Next</button>
        </footer>
      </main>

      {confirm && (
        <div className="modal-overlay">
          <div className="modal">
            <p>
              Confirm {confirm.type === 'pay' ? 'marking as paid' : 'deleting'} order <strong>{confirm.orderId}</strong>?
            </p>
            <div className="modal-actions">
              <button onClick={handleConfirm} className="btn">Yes</button>
              <button onClick={() => setConfirm(null)} className="btn cancel">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
