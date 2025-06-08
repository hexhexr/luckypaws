// pages/admin/deposits.js

import { useState, useEffect, useCallback } from "react";
import axios from "axios";

export default function AdminDeposits() {
  const [deposits, setDeposits] = useState([]);
  const [search, setSearch] = useState("");
  const [agentFilter, setAgentFilter] = useState("all");
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);

  const fetchDeposits = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get("/api/admin/deposits");
      setDeposits(res.data);
    } catch (err) {
      console.error("Failed to fetch deposits:", err);
      setError("Failed to load deposits. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAgents = useCallback(async () => {
    try {
      const res = await axios.get("/api/admin/agents");
      setAgents(res.data);
    } catch (err) {
      console.error("Failed to fetch agents:", err);
      // Not setting a global error for agents fetch as deposits are primary
    }
  }, []);

  useEffect(() => {
    fetchDeposits();
    fetchAgents();

    const interval = setInterval(fetchDeposits, 10000); // Auto-refresh every 10s
    return () => clearInterval(interval);
  }, [fetchDeposits, fetchAgents]);

  const handleVerify = async (id) => {
    if (!confirm("Mark this deposit as verified?")) return;
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      await axios.post(`/api/admin/deposits/${id}/verify`);
      setMessage("Deposit verified successfully!");
      fetchDeposits(); // Refresh the list
    } catch (err) {
      console.error("Failed to verify deposit:", err);
      setError("Failed to verify deposit. Please try again.");
    } finally {
      setLoading(false);
      setTimeout(() => setMessage(null), 3000); // Clear message after 3 seconds
    }
  };

  const filtered = deposits
    .filter((d) => {
      const searchMatch = search
        ? d.username.toLowerCase().includes(search.toLowerCase()) ||
          d.customerId.toLowerCase().includes(search.toLowerCase()) // Assuming customerId exists or adapt to actual field
        : true;
      const agentMatch = agentFilter === "all" || d.agentName === agentFilter; // Assuming agentName exists
      return searchMatch && agentMatch;
    });

  return (
    <div className="ml-72 p-4">
      <h1 className="text-2xl font-bold mb-4">Customer Deposits</h1>

      <div className="flex flex-col md:flex-row gap-2 mb-4">
        <input
          type="text"
          className="p-2 border rounded w-full md:w-1/3"
          placeholder="Search by username or customer ID"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="p-2 border rounded w-full md:w-1/4"
          value={agentFilter}
          onChange={(e) => setAgentFilter(e.target.value)}
        >
          <option value="all">All Agents</option>
          {agents.map((agent) => (
            <option key={agent.id} value={agent.username}>
              {agent.username}
            </option>
          ))}
        </select>
      </div>

      {loading && <p className="text-blue-600">Loading deposits...</p>}
      {error && <p className="text-red-600">{error}</p>}
      {message && <p className="text-green-600">{message}</p>}

      <div className="bg-white shadow rounded overflow-auto max-h-[600px]">
        <table className="min-w-full text-sm text-left">
          <thead className="bg-gray-100 text-gray-700">
            <tr>
              <th className="px-4 py-2">Username</th>
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
                      disabled={loading}
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