// pages/admin/agent-management.js
import { useState, useEffect } from "react";
import { useRouter } from 'next/router';
import { auth as firebaseAuth } from '../../lib/firebaseClient';
import axios from 'axios';

export default function AgentManagement() {
  const router = useRouter();
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newAgent, setNewAgent] = useState({
    username: '',
    email: '',
    password: '',
    name: '',
    status: 'active'
  });
  const [editingAgent, setEditingAgent] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    const unsubscribe = firebaseAuth.onAuthStateChanged(user => {
      if (!user) {
        router.replace('/admin');
      } else {
        fetchAgents();
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [router]);

  const fetchAgents = async () => {
    try {
      setLoading(true);
      const res = await axios.get("/api/admin/agents");
      setAgents(res.data);
    } catch (err) {
      setError(`Failed to load agents: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAgent = async () => {
    try {
      setLoading(true);
      const res = await axios.post("/api/admin/agents/create", newAgent);
      if (res.data.success) {
        setNewAgent({
          username: '',
          email: '',
          password: '',
          name: '',
          status: 'active'
        });
        await fetchAgents();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create agent');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateAgent = async (id, updates) => {
    try {
      setLoading(true);
      await axios.put(`/api/admin/agents/${id}`, updates);
      await fetchAgents();
      setEditingAgent(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update agent');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (id, newStatus) => {
    try {
      setLoading(true);
      await axios.patch(`/api/admin/agents/${id}/status`, { status: newStatus });
      await fetchAgents();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update status');
    } finally {
      setLoading(false);
    }
  };

  const filteredAgents = agents.filter(agent => {
    const matchesSearch = agent.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         agent.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || agent.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return <div className="ml-72 p-4">Loading...</div>;
  }

  return (
    <div className="ml-72 p-4">
      <h1 className="text-2xl font-bold mb-6">Agent Management</h1>
      
      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded shadow">
          <h3 className="text-gray-500">Total Agents</h3>
          <p className="text-2xl font-bold">{agents.length}</p>
        </div>
        <div className="bg-white p-4 rounded shadow">
          <h3 className="text-gray-500">Active</h3>
          <p className="text-2xl font-bold text-green-600">
            {agents.filter(a => a.status === 'active').length}
          </p>
        </div>
        <div className="bg-white p-4 rounded shadow">
          <h3 className="text-gray-500">Inactive</h3>
          <p className="text-2xl font-bold text-yellow-600">
            {agents.filter(a => a.status === 'inactive').length}
          </p>
        </div>
        <div className="bg-white p-4 rounded shadow">
          <h3 className="text-gray-500">Suspended</h3>
          <p className="text-2xl font-bold text-red-600">
            {agents.filter(a => a.status === 'suspended').length}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded shadow mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <input
            type="text"
            placeholder="Search agents..."
            className="p-2 border rounded flex-grow"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <select
            className="p-2 border rounded"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="suspended">Suspended</option>
          </select>
        </div>
      </div>

      {/* Add/Edit Agent Form */}
      <div className="bg-white p-4 rounded shadow mb-6">
        <h2 className="text-xl font-semibold mb-4">
          {editingAgent ? 'Edit Agent' : 'Add New Agent'}
        </h2>
        {error && <div className="text-red-600 mb-4">{error}</div>}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input
            type="text"
            placeholder="Username"
            className="p-2 border rounded"
            value={editingAgent?.username || newAgent.username}
            onChange={(e) => 
              editingAgent 
                ? setEditingAgent({...editingAgent, username: e.target.value})
                : setNewAgent({...newAgent, username: e.target.value})
            }
          />
          <input
            type="email"
            placeholder="Email"
            className="p-2 border rounded"
            value={editingAgent?.email || newAgent.email}
            onChange={(e) => 
              editingAgent 
                ? setEditingAgent({...editingAgent, email: e.target.value})
                : setNewAgent({...newAgent, email: e.target.value})
            }
          />
          <input
            type="text"
            placeholder="Full Name"
            className="p-2 border rounded"
            value={editingAgent?.name || newAgent.name}
            onChange={(e) => 
              editingAgent 
                ? setEditingAgent({...editingAgent, name: e.target.value})
                : setNewAgent({...newAgent, name: e.target.value})
            }
          />
          {!editingAgent && (
            <input
              type="password"
              placeholder="Password"
              className="p-2 border rounded"
              value={newAgent.password}
              onChange={(e) => setNewAgent({...newAgent, password: e.target.value})}
            />
          )}
          <select
            className="p-2 border rounded"
            value={editingAgent?.status || newAgent.status}
            onChange={(e) => 
              editingAgent 
                ? setEditingAgent({...editingAgent, status: e.target.value})
                : setNewAgent({...newAgent, status: e.target.value})
            }
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="suspended">Suspended</option>
          </select>
        </div>
        <div className="mt-4 flex gap-2">
          {editingAgent ? (
            <>
              <button
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                onClick={() => handleUpdateAgent(editingAgent.id, editingAgent)}
              >
                Update Agent
              </button>
              <button
                className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700"
                onClick={() => setEditingAgent(null)}
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
              onClick={handleCreateAgent}
            >
              Create Agent
            </button>
          )}
        </div>
      </div>

      {/* Agents Table */}
      <div className="bg-white shadow rounded overflow-auto">
        <table className="min-w-full">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-4 py-2">Username</th>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Email</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Created</th>
              <th className="px-4 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredAgents.map(agent => (
              <tr key={agent.id} className="border-b hover:bg-gray-50">
                <td className="px-4 py-2">{agent.username}</td>
                <td className="px-4 py-2">{agent.name}</td>
                <td className="px-4 py-2">{agent.email}</td>
                <td className="px-4 py-2">
                  <span className={`px-2 py-1 rounded-full text-xs ${
                    agent.status === 'active' ? 'bg-green-100 text-green-800' :
                    agent.status === 'inactive' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {agent.status}
                  </span>
                </td>
                <td className="px-4 py-2">
                  {new Date(agent.createdAt).toLocaleDateString()}
                </td>
                <td className="px-4 py-2 space-x-2">
                  <button
                    onClick={() => setEditingAgent(agent)}
                    className="text-blue-600 hover:text-blue-800"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleStatusChange(
                      agent.id, 
                      agent.status === 'active' ? 'inactive' : 'active'
                    )}
                    className="text-yellow-600 hover:text-yellow-800"
                  >
                    {agent.status === 'active' ? 'Deactivate' : 'Activate'}
                  </button>
                  <button
                    onClick={() => handleStatusChange(
                      agent.id, 
                      agent.status === 'suspended' ? 'active' : 'suspended'
                    )}
                    className="text-red-600 hover:text-red-800"
                  >
                    {agent.status === 'suspended' ? 'Unsuspend' : 'Suspend'}
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