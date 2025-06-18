// src/components/DataTable.js
import React, { useState, useMemo, useCallback } from 'react';

// Sortable Table Header Component
const SortableTableHeader = ({ column, sortConfig, onSort }) => {
    const isCurrent = column.accessor === sortConfig.key;
    const sortIcon = isCurrent ? (sortConfig.direction === 'asc' ? '▲' : '▼') : '↕';

    return (
        <th onClick={() => column.sortable && onSort(column.accessor)} style={{ cursor: column.sortable ? 'pointer' : 'default' }}>
            {column.header} {column.sortable && <span style={{ marginLeft: '5px' }}>{sortIcon}</span>}
        </th>
    );
};

const DataTable = ({ columns, data, defaultSortField }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [sortConfig, setSortConfig] = useState({ key: defaultSortField, direction: 'desc' });
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);

    const handleSort = useCallback((key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
        setCurrentPage(1);
    }, [sortConfig]);

    const filteredData = useMemo(() => {
        if (!searchTerm) return data;
        const lowerCaseSearchTerm = searchTerm.toLowerCase();
        return data.filter(item =>
            columns.some(column => {
                const value = item[column.accessor];
                return value?.toString().toLowerCase().includes(lowerCaseSearchTerm);
            })
        );
    }, [data, searchTerm, columns]);

    const sortedData = useMemo(() => {
        const sorted = [...filteredData];
        if (sortConfig.key) {
            sorted.sort((a, b) => {
                const valA = a[sortConfig.key];
                const valB = b[sortConfig.key];

                if (valA === null || valA === undefined) return 1;
                if (valB === null || valB === undefined) return -1;

                if (valA < valB) {
                    return sortConfig.direction === 'asc' ? -1 : 1;
                }
                if (valA > valB) {
                    return sortConfig.direction === 'asc' ? 1 : -1;
                }
                return 0;
            });
        }
        return sorted;
    }, [filteredData, sortConfig]);

    const totalPages = Math.ceil(sortedData.length / itemsPerPage);
    const paginatedData = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        return sortedData.slice(startIndex, startIndex + itemsPerPage);
    }, [sortedData, currentPage, itemsPerPage]);

    return (
        <div>
            <div className="card filter-controls mb-lg">
                <div className="filter-group">
                    <label htmlFor="tableSearch">Search:</label>
                    <input
                        id="tableSearch"
                        type="text"
                        className="input"
                        placeholder="Search across all fields..."
                        value={searchTerm}
                        onChange={(e) => {
                            setSearchTerm(e.target.value);
                            setCurrentPage(1);
                        }}
                    />
                </div>
                <div className="filter-group">
                    <label htmlFor="itemsPerPage">Items per page:</label>
                    <select
                        id="itemsPerPage"
                        className="input"
                        value={itemsPerPage}
                        onChange={(e) => {
                            setItemsPerPage(Number(e.target.value));
                            setCurrentPage(1);
                        }}
                    >
                        <option value={5}>5</option>
                        <option value={10}>10</option>
                        <option value={20}>20</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                    </select>
                </div>
            </div>

            <div className="card table-card">
                {paginatedData.length === 0 ? (
                    <p className="text-center p-md">No data available for the current selection.</p>
                ) : (
                    <div className="table-responsive">
                        <table>
                            <thead>
                                <tr>
                                    {columns.map(col => (
                                        <SortableTableHeader
                                            key={col.accessor}
                                            column={col}
                                            sortConfig={sortConfig}
                                            onSort={handleSort}
                                        />
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {paginatedData.map((row, rowIndex) => (
                                    <tr key={rowIndex}>
                                        {columns.map(col => (
                                            <td key={col.accessor}>
                                                {col.cell ? col.cell(row) : row[col.accessor]}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {totalPages > 1 && (
                <div className="pagination-controls mt-lg text-center">
                    <button
                        className="btn btn-secondary mr-md"
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                    >
                        ← Previous
                    </button>
                    <span>Page {currentPage} of {totalPages}</span>
                    <button
                        className="btn btn-secondary ml-md"
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                    >
                        Next →
                    </button>
                </div>
            )}
        </div>
    );
};

export default DataTable;