// pages/admin/customers.js

import { useState, useEffect, useCallback } from "react";
import axios from "axios";

export default function AdminCustomers() {
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState("");
  const [filtered, setFiltered] = useState([]);
  const [dateRange, setDateRange] = useState({ start: "", end: "" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [cashoutLimit, setCashoutLimit] = useState(300); // Default cashout limit

  useEffect(() => {
    fetchCustomers();
    // In a real application, you might fetch this limit from a configuration API
    // fetchConfig().then(config => setCashoutLimit(config.dailyCashoutLimit));
  }, []);

  useEffect(() => {
    filterCustomers();
  }, [search, customers, dateRange]);

  const fetchCustomers = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get("/api/admin/customers");
      setCustomers(res.data);
    } catch (err) {
      console.error("Failed to fetch customers:", err);
      setError("Failed to load customers. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const filterCustomers = useCallback(() => {
    const lowerSearch = search.toLowerCase();
    const filteredData = customers.filter((c) => {
      const matchesSearch =
        c.username.toLowerCase().includes(lowerSearch) ||
        c.facebookName.toLowerCase().includes(lowerSearch);

      const customerLastActivity = c.lastActivity ? new Date(c.lastActivity) : null;
      const startDate = dateRange.start ? new Date(dateRange.start) : null;
      const endDate = dateRange.end ? new Date(dateRange.end) : null;

      const inDateRange =
        !startDate ||
        !endDate ||
        (customerLastActivity && customerLastActivity >= startDate && customerLastActivity <= endDate);
      
      return matchesSearch && inDateRange;
    });
    setFiltered(filteredData);
  }, [search, customers, dateRange]);

  return (
    <div className="ml-72 p-4">
      <h1 className="text-2xl font-bold mb-4">Customer Management</h1>

      <div className="flex flex-col md:flex-row gap-2 mb-4">
        <input
          type="text"
          className="p-2 border rounded w-full md:w-1/3"
          placeholder="Search by username or Facebook name"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <input
          type="date"
          className="p-2 border rounded w-full md:w-1/4"
          value={dateRange.start}
          onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
          title="Start Date for Last Activity"
        />
        <input
          type="date"
          className="p-2 border rounded w-full md:w-1/4"
          value={dateRange.end}
          onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
          title="End Date for Last Activity"
        />
      </div>

      {loading && <p className="text-blue-600">Loading customers...</p>}
      {error && <p className="text-red-600">{error}</p>}

      <div className="bg-white shadow rounded overflow-auto max-h-[600px]">
        <table className="min-w-full text-sm text-left">
          <thead className="bg-gray-100 text-gray-700">
            <tr>
              <th className="px-4 py-2">Username</th>
              <th className="px-4 py-2">Facebook Name</th>
              <th className="px-4 py-2">Facebook URL</th>
              <th className="px-4 py-2">Total Deposit</th>
              <th className="px-4 py-2">Total Cashout</th>
              <th className="px-4 py-2">Profit</th>
              <th className="px-4 py-2">Limit Left</th>
              <th className="px-4 py-2">Last Activity</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c, i) => (
              <tr key={i} className="border-b">
                <td className="px-4 py-2">{c.username}</td>
                <td className="px-4 py-2">{c.facebookName}</td>
                <td className="px-4 py-2">
                  {c.facebookUrl ? (
                    <a href={c.facebookUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">
                      View Profile
                    </a>
                  ) : (
                    "N/A"
                  )}
                </td>
                <td className="px-4 py-2 text-green-600">${c.totalDeposit || 0}</td>
                <td className="px-4 py-2 text-red-600">${c.totalCashout || 0}</td>
                <td className="px-4 py-2 text-blue-600">${c.profit || 0}</td>
                <td className="px-4 py-2">${Math.max(0, cashoutLimit - (c.totalCashout || 0))}</td>
                <td className="px-4 py-2">
                  {c.lastActivity ? new Date(c.lastActivity).toLocaleDateString() : "N/A"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}