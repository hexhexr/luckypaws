// pages/admin/deposits.js

import { useState, useEffect } from "react";
import axios from "axios";

export default function AdminDeposits() {
  const [deposits, setDeposits] = useState([]);
  const [search, setSearch] = useState("");
  const [agentFilter, setAgentFilter] = useState("");
  const [agents, setAgents] = useState([]);

  useEffect(() => {
    fetchDeposits();
    fetchAgents();

    const interval = setInterval(fetchDeposits, 10000); // Auto-refresh every 10s
    return () => clearInterval(interval);
  }, []);

  const fetchDeposits = async () => {
    const res = await axios.get("/api/admin/deposits");
    setDeposits(res.data);
  };

  const fetchAgents = async () => {
    const res = await axios.get("/api/admin/agents");
    setAgents(res.data);
  };

  const handleVerify = async (id) => {
    if (!confirm("Mark this deposit as verified?")) return;
    await axios.post(`/api/admin/deposits/${id}/verify`);
    fetchDeposits();
  };

  const filtered = deposits
    .filter((d) =>
      search
        ? d.username.toLowerCase().includes(search.toLowerCase()) ||
          d.customerId.toLowerCase().includes(search.toLowerCase())
        : true
    )
    .filter((d) => (agentFilter ? d.agentId === agentFilter : true))
    .slice(0, 10);

  return (
    <div className="ml-72 p-4">
      <h1 className="text-2xl font-bold mb-4">Live Customer Deposits</h1>

      <div className="flex flex-col md:flex-row gap-2 mb-4">
        <input
          type="text"
          placeholder="Search by username or ID"
          className="p-2 border rounded"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="p-2 border rounded"
          value={agentFilter}
          onChange={(e) => setAgentFilter(e.target.value)}
        >
          <option value="">All Agents</option>
          {agents.map((a) => (
            <option key={a.id} value={a.id}>
              {a.username}
            </option>
          ))}
        </select>
      </div>

      <div className="bg-white shadow rounded overflow-auto max-h-[600px]">
        <table className="min-w-full text-sm text-left">
          <thead className="bg-gray-100 text-gray-700">
            <tr>
              <th className="px-4 py-2">Customer</th>
              <th className="px-4 py-2">Agent</th>
              <th className="px-4 py-2">Amount</th>
              <th className="px-4 py-2">Date</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((d, i) => (
              <tr
                key={i}
                className={`border-b ${
                  !d.verified ? "bg-yellow-50" : "bg-white"
                }`}
              >
                <td className="px-4 py-2">{d.username}</td>
                <td className="px-4 py-2">{d.agentName}</td>
                <td className="px-4 py-2 text-green-600">${d.amount}</td>
                <td className="px-4 py-2">
                  {new Date(d.createdAt).toLocaleString()}
                </td>
                <td className="px-4 py-2">
                  {d.verified ? (
                    <span className="text-green-600">Verified</span>
                  ) : (
                    <span className="text-red-600">Pending</span>
                  )}
                </td>
                <td className="px-4 py-2">
                  {!d.verified && (
                    <button
                      className="text-blue-600 underline"
                      onClick={() => handleVerify(d.id)}
                    >
                      Verify
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
