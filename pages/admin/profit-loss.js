import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { db } from '../../lib/firebaseClient';

export default function ProfitLoss() {
  const router = useRouter();
  const [orders, setOrders] = useState([]);
  const [cashouts, setCashouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [codeFilter, setCodeFilter] = useState('');
  const [summary, setSummary] = useState({ deposit: 0, cashout: 0 });

  useEffect(() => {
    if (typeof window !== 'undefined' && localStorage.getItem('admin_auth') !== '1') {
      router.replace('/admin/login');
    }
  }, []);

  useEffect(() => {
    const loadData = async () => {
      try {
        const orderSnap = await db.collection('orders').where('status', '==', 'paid').get();
        const depositList = orderSnap.docs.map(doc => ({ id: doc.id, ...doc.data(), type: 'deposit' }));

        const cashoutSnap = await db.collection('profitLoss').where('type', '==', 'cashout').get();
        const cashoutList = cashoutSnap.docs.map(doc => ({ id: doc.id, ...doc.data(), type: 'cashout' }));

        setOrders(depositList);
        setCashouts(cashoutList);
        summarize(depositList, cashoutList);
      } catch (err) {
        console.error('Error loading profit/loss data:', err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const summarize = (deposits, cashouts) => {
    const totalDeposit = deposits.reduce((sum, d) => sum + Number(d.amount || 0), 0);
    const totalCashout = cashouts.reduce((sum, c) => sum + Number(c.amount || 0), 0);
    setSummary({ deposit: totalDeposit, cashout: totalCashout });
  };

  const filteredDeposits = orders.filter(d =>
    d.username?.toLowerCase().includes(search.toLowerCase()) &&
    (codeFilter === '' || d.username.endsWith(codeFilter))
  );

  const filteredCashouts = cashouts.filter(c =>
    c.username?.toLowerCase().includes(search.toLowerCase()) &&
    (codeFilter === '' || c.username.endsWith(codeFilter))
  );

  const usernames = [...new Set([
    ...filteredDeposits.map(d => d.username),
    ...filteredCashouts.map(c => c.username)
  ])];

  const extractFB = url => {
    const match = url?.match(/facebook\.com\/([^/?#]+)/);
    return match ? match[1] : null;
  };

  const groupData = username => {
    const deposits = filteredDeposits.filter(d => d.username === username);
    const cashouts = filteredCashouts.filter(c => c.username === username);
    const fb = deposits[0]?.facebook || cashouts[0]?.facebook || '';
    const name = deposits[0]?.customerName || cashouts[0]?.customerName || '';

    const all = [
      ...deposits,
      ...cashouts
    ].sort((a, b) => new Date(b.time || b.created) - new Date(a.time || a.created));

    const totalDeposit = deposits.reduce((a, b) => a + Number(b.amount || 0), 0);
    const totalCashout = cashouts.reduce((a, b) => a + Number(b.amount || 0), 0);
    const net = totalDeposit - totalCashout;

    return { all, fb, name, totalDeposit, totalCashout, net };
  };

  return (
    <div className="container mt-lg">
      <div className="card">
        <h2 className="text-center">📊 Profit & Loss</h2>

        <div className="mt-md">
          <input
            className="input"
            placeholder="Search username or Facebook link"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <div className="mt-sm">
          <input
            className="input"
            placeholder="Filter by page code (e.g. -LKP1)"
            value={codeFilter}
            onChange={e => setCodeFilter(e.target.value)}
          />
        </div>

        <div className="mt-md">
          <p><strong>Total Deposits:</strong> ${summary.deposit.toFixed(2)}</p>
          <p><strong>Total Cashouts:</strong> ${summary.cashout.toFixed(2)}</p>
        </div>

        {loading ? (
          <p className="mt-md text-center">Loading...</p>
        ) : usernames.length === 0 ? (
          <p className="mt-md text-center">No matching records.</p>
        ) : (
          <div className="mt-md">
            {usernames.map((username, i) => {
              const { all, fb, name, totalDeposit, totalCashout, net } = groupData(username);
              const fbUser = extractFB(fb);
              const fbImg = fbUser ? `https://graph.facebook.com/${fbUser}/picture?height=100` : null;

              return (
                <div key={i} className="card mt-md" style={{ border: '1px solid #eee' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    {fbImg && <img src={fbImg} alt="fb" width={60} height={60} style={{ borderRadius: '50%' }} />}
                    <div>
                      <strong>{username}</strong>
                      <div style={{ fontSize: '0.9rem', color: '#444' }}>{name}</div>
                      <div style={{ fontSize: '0.85rem', color: '#888' }}>{fb}</div>
                      <div>
                        <span style={{ color: '#2ecc71' }}>Deposit: ${totalDeposit.toFixed(2)}</span> | 
                        <span style={{ color: '#e74c3c' }}> Cashout: ${totalCashout.toFixed(2)}</span> | 
                        <strong style={{ color: net >= 0 ? 'green' : 'red' }}>
                          {net >= 0 ? `Profit: $${net.toFixed(2)}` : `Loss: $${Math.abs(net).toFixed(2)}`}
                        </strong>
                      </div>
                    </div>
                  </div>

                  <table className="table mt-sm">
                    <thead>
                      <tr>
                        <th>Type</th>
                        <th>Amount</th>
                        <th>Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {all.map((entry, idx) => (
                        <tr key={idx}>
                          <td style={{ color: entry.type === 'deposit' ? 'green' : '#c0392b' }}>{entry.type}</td>
                          <td>${entry.amount}</td>
                          <td>{new Date(entry.time || entry.created).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
