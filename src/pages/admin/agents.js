// pages/admin/agents.js

import { useState, useEffect } from "react";
import axios from "axios";

export default function AdminAgents() {
  const [agents, setAgents] = useState([]);
  const [search, setSearch] = useState("");
  const [newAgent, setNewAgent] = useState({ username: "", password: "" });

  useEffect(() => {
    fetchAgents();
  }, []);

  const fetchAgents = async () => {
    const res = await axios.get("/api/admin/agents");
    setAgents(res.data);
  };

  const handleSearch = (e) => {
    setSearch(e.target.value);
  };

  const filteredAgents = agents.filter((a) =>
    a.username.toLowerCase().includes(search.toLowerCase())
  );

  const handleAddAgent = async () => {
    if (!newAgent.username || !newAgent.password) return alert("Missing fields");
    await axios.post("/api/admin/agents", newAgent);
    setNewAgent({ username: "", password: "" });
    fetchAgents();
  };

  const handleDelete = async (id) => {
    if (confirm("Are you sure you want to delete this agent?")) {
      await axios.delete(`/api/admin/agents/${id}`);
      fetchAgents();
    }
  };

  return (
    <div className="ml-72 p-4">
      <h1 className="text-2xl font-bold mb-4">Agent Management</h1>

      <div className="flex flex-col md:flex-row gap-2 mb-4">
        <input
          type="text"
          placeholder="Search agent"
          className="w-full md:w-1/3 p-2 border rounded"
          value={search}
          onChange={handleSearch}
        />

        <input
          type="text"
          placeholder="New agent username"
          className="w-full md:w-1/4 p-2 border rounded"
          value={newAgent.username}
          onChange={(e) =>
            setNewAgent({ ...newAgent, username: e.target.value })
          }
        />

        <input
          type="password"
          placeholder="New agent password"
          className="w-full md:w-1/4 p-2 border rounded"
          value={newAgent.password}
          onChange={(e) =>
            setNewAgent({ ...newAgent, password: e.target.value })
          }
        />

        <button
          className="bg-blue-600 text-white px-4 py-2 rounded"
          onClick={handleAddAgent}
        >
          Add Agent
        </button>
      </div>

      <div className="bg-white shadow rounded overflow-auto max-h-[600px]">
        <table className="min-w-full text-sm text-left">
          <thead className="bg-gray-100 text-gray-700">
            <tr>
              <th className="px-4 py-2">Username</th>
              <th className="px-4 py-2">Created</th>
              <th className="px-4 py-2">Total Customers</th>
              <th className="px-4 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredAgents.map((a, i) => (
              <tr key={i} className="border-b">
                <td className="px-4 py-2">{a.username}</td>
                <td className="px-4 py-2">
                  {new Date(a.createdAt).toLocaleDateString()}
                </td>
                <td className="px-4 py-2">{a.customerCount || 0}</td>
                <td className="px-4 py-2">
                  <button
                    onClick={() => handleDelete(a.id)}
                    className="text-red-600 underline"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
