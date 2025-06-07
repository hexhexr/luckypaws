// pages/admin/cashouts.js

import { useState, useEffect } from "react";
import axios from "axios";

export default function AdminCashouts() {
  const [cashouts, setCashouts] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    fetchCashouts();
  }, []);

  const fetchCashouts = async () => {
    const res = await axios.get("/api/admin/cashouts");
    setCashouts(res.data);
  };

  const filteredCashouts = cashouts.filter((c) => {
    const searchMatch =
      c.username.toLowerCase().includes(search.toLowerCase()) ||
      c.facebookName.toLowerCase().includes(search.toLowerCase());
    const statusMatch = statusFilter === "all" || c.status === statusFilter;
    return searchMatch && statusMatch;
  });

  return (
    <div className="ml-72 p-4">
      <h1 className="text-2xl font-bold mb-4">Customer Cashouts</h1>

      <div className="flex flex-col md:flex-row gap-2 mb-4">
        <input
          type="text"
          className="p-2 border rounded w-full md:w-1/3"
          placeholder="Search by username or Facebook name"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="p-2 border rounded"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="sent">Sent</option>
          <option value="failed">Failed</option>
        </select>
      </div>

      <div className="bg-white shadow rounded overflow-auto max-h-[600px]">
        <table className="min-w-full text-sm text-left">
          <thead className="bg-gray-100 text-gray-700">
            <tr>
              <th className="px-4 py-2">Username</th>
              <th className="px-4 py-2">Facebook Name</th>
              <th className="px-4 py-2">Amount</th>
              <th className="px-4 py-2">Lightning Invoice</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Date</th>
              <th className="px-4 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredCashouts.map((c, i) => (
              <tr key={i} className="border-b">
                <td className="px-4 py-2">{c.username}</td>
                <td className="px-4 py-2">{c.facebookName}</td>
                <td className="px-4 py-2 text-red-600">${c.amount}</td>
                <td className="px-4 py-2 max-w-[160px] truncate">{c.invoice}</td>
                <td className="px-4 py-2">
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${
                      c.status === "sent"
                        ? "bg-green-100 text-green-700"
                        : c.status === "failed"
                        ? "bg-red-100 text-red-700"
                        : "bg-yellow-100 text-yellow-700"
                    }`}
                  >
                    {c.status}
                  </span>
                </td>
                <td className="px-4 py-2">{new Date(c.createdAt).toLocaleDateString()}</td>
                <td className="px-4 py-2 space-x-2">
                  <button
                    onClick={() => markAsSent(c.id)}
                    className="text-green-600 underline"
                  >
                    Mark Sent
                  </button>
                  <button
                    onClick={() => markAsFailed(c.id)}
                    className="text-red-600 underline"
                  >
                    Mark Failed
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  async function markAsSent(id) {
    await axios.post("/api/admin/cashouts/send", { id });
    fetchCashouts();
  }

  async function markAsFailed(id) {
    await axios.post("/api/admin/cashouts/mark-failed", { id });
    fetchCashouts();
  }
}
