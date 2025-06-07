// pages/admin/dashboard.js

import { useEffect, useState } from "react";
import Link from "next/link";
import axios from "axios";

export default function AdminDashboard() {
  const [summary, setSummary] = useState({ deposits: 0, cashouts: 0, profit: 0 });
  const [deposits, setDeposits] = useState([]);
  const [cashouts, setCashouts] = useState([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const res = await axios.get("/api/admin/dashboard-summary");
    setSummary(res.data.summary);
    setDeposits(res.data.recentDeposits);
    setCashouts(res.data.recentCashouts);
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <aside className="w-64 fixed top-0 left-0 h-full bg-white border-r shadow-md p-4">
        <h2 className="text-xl font-bold mb-4">Admin Panel</h2>
        <nav className="space-y-2">
          <Link href="/admin/dashboard" className="block p-2 hover:bg-gray-100 rounded">Dashboard</Link>
          <Link href="/admin/customers" className="block p-2 hover:bg-gray-100 rounded">Customers</Link>
          <Link href="/admin/deposit-verification" className="block p-2 hover:bg-gray-100 rounded">Verify Deposits</Link>
          <Link href="/admin/limits" className="block p-2 hover:bg-gray-100 rounded">Customer Limits</Link>
          <Link href="/admin/agent-log" className="block p-2 hover:bg-gray-100 rounded">Agent Activity</Link>
          <Link href="/admin/history" className="block p-2 hover:bg-gray-100 rounded">Deposit/Cashout History</Link>
        </nav>
      </aside>

      <main className="ml-72">
        <h1 className="text-2xl font-bold mb-6">Dashboard Summary</h1>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white p-4 rounded shadow">
            <h3 className="text-lg font-semibold">Total Deposits</h3>
            <p className="text-2xl text-green-600 font-bold">${summary.deposits}</p>
          </div>
          <div className="bg-white p-4 rounded shadow">
            <h3 className="text-lg font-semibold">Total Cashouts</h3>
            <p className="text-2xl text-red-600 font-bold">${summary.cashouts}</p>
          </div>
          <div className="bg-white p-4 rounded shadow">
            <h3 className="text-lg font-semibold">Profit</h3>
            <p className="text-2xl text-blue-600 font-bold">${summary.profit}</p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h2 className="text-xl font-semibold mb-2">Last 10 Deposits</h2>
            <div className="bg-white rounded shadow overflow-auto max-h-96">
              <table className="min-w-full text-sm text-left">
                <thead className="bg-gray-100 text-gray-700">
                  <tr>
                    <th className="px-4 py-2">Username</th>
                    <th className="px-4 py-2">Amount</th>
                    <th className="px-4 py-2">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {deposits.map((d, i) => (
                    <tr key={i} className="border-b">
                      <td className="px-4 py-2">{d.username}</td>
                      <td className="px-4 py-2 text-green-600">${d.amount}</td>
                      <td className="px-4 py-2">{new Date(d.time).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h2 className="text-xl font-semibold mb-2">Last 10 Cashouts</h2>
            <div className="bg-white rounded shadow overflow-auto max-h-96">
              <table className="min-w-full text-sm text-left">
                <thead className="bg-gray-100 text-gray-700">
                  <tr>
                    <th className="px-4 py-2">Username</th>
                    <th className="px-4 py-2">Amount</th>
                    <th className="px-4 py-2">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {cashouts.map((c, i) => (
                    <tr key={i} className="border-b">
                      <td className="px-4 py-2">{c.username}</td>
                      <td className="px-4 py-2 text-red-600">${c.amount}</td>
                      <td className="px-4 py-2">{new Date(c.time).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
