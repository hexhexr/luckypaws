// components/AdminSidebar.js
import Link from 'next/link';

export default function AdminSidebar() {
  return (
    <div>
      <nav>
        <ul>
          <li><Link href="/admin/AgentManagement">Add Agent</Link></li>
          <li><Link href="/admin/AgentList">View Agents</Link></li>
          {/* other links */}
        </ul>
      </nav>
    </div>
  );
}
