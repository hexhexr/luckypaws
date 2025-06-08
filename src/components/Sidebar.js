
import Link from 'next/link';

export default function Sidebar() {
  return (
    <div className="sidebar">
      <h2 className="sidebar-header">Admin Dashboard</h2>
      <nav className="sidebar-nav">
        <ul>
          <li><Link href="/admin/dashboard">Dashboard</Link></li>
          <li><Link href="/admin/agents">Agents</Link></li>
          <li><Link href="/admin/customers">Customers</Link></li>
          <li><Link href="/admin/cashouts">Cashouts</Link></li>
          <li><Link href="/admin/deposits">Deposits</Link></li>
          <li><Link href="/admin/profit-loss">Profit Loss</Link></li>
          <li><Link href="/admin/games">Games</Link></li>
        </ul>
      </nav>
    </div>
  );
}
