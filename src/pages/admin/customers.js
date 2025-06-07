// pages/admin/customers.js

import { useState, useEffect } from "react";
import axios from "axios";

export default function AdminCustomers() {
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState("");
  const [filtered, setFiltered] = useState([]);
  const [dateRange, setDateRange] = useState({ start: "", end: "" });

  useEffect(() => {
    fetchCustomers();
  }, []);

  useEffect(() => {
    filterCustomers();
  }, [search, customers, dateRange]);

  const fetchCustomers = async () => {
    const res = await axios.get("/api/admin/customers");
    setCustomers(res.data);
  };

  const filterCustomers = () => {
    const lowerSearch = search.toLowerCase();
    const filteredData = customers.filter((c) => {
      const matchesSearch =
        c.username.toLowerCase().includes(lowerSearch) ||
        c.facebookName.toLowerCase().includes(lowerSearch);
      const inDateRange =
        !dateRange.start ||
        !dateRange.end ||
        (new Date(c.lastActivity) >= new Date(dateRange.start) &&
          new Date(c.lastActivity) <= new Date(dateRange.end));
      return matchesSearch && inDateRange;
    });
    setFiltered(filteredData);
  };

  return (
    <div className="ml-72 p-4">
      <h1 className="text-2xl font-bold mb-4">Paying Customers</h1>

      <div className="flex flex-col md:flex-row gap-2 mb-4">
        <input
          type="text"
          placeholder="Search by username or Facebook name"
          className="w-full p-2 border rounded"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <input
          type="date"
          className="p-2 border rounded"
          value={dateRange.start}
          onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
        />
        <input
          type="date"
          className="p-2 border rounded"
          value={dateRange.end}
          onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
        />
      </div>

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
                  <a href={c.facebookUrl} target="_blank" className="text-blue-600 underline">
                    View Profile
                  </a>
                </td>
                <td className="px-4 py-2 text-green-600">${c.totalDeposit}</td>
                <td className="px-4 py-2 text-red-600">${c.totalCashout}</td>
                <td className="px-4 py-2 text-blue-600">${c.profit}</td>
                <td className="px-4 py-2">${300 - c.todaysCashout}</td>
                <td className="px-4 py-2">{new Date(c.lastActivity).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
