// src/components/DataTable.js
import React, { useState, useMemo, useCallback } from 'react';

const SortableTableHeader = ({ column, sortConfig, onSort }) => {
    const isCurrent = column.accessor === sortConfig.key;
    const sortIcon = isCurrent ? (sortConfig.direction === 'asc' ? ' ▲' : ' ▼') : ' ↕';

    return (
        <th onClick={() => column.sortable && onSort(column.accessor)} style={{ cursor: column.sortable ? 'pointer' : 'default' }}>
            {column.header} 
            {column.sortable && <span style={{ opacity: isCurrent ? 1 : 0.4 }}>{sortIcon}</span>}
        </th>
    );
};

// Simplified to always render the sub-component if the function is provided
const DataTable = ({ columns, data, defaultSortField, filterControls, onRowClick, renderRowSubComponent }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [sortConfig, setSortConfig] = useState({ key: defaultSortField, direction: 'desc' });
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);

    const handleSort = useCallback((key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
        setSortConfig({ key, direction });
        setCurrentPage(1);
    }, [sortConfig]);

    const filteredData = useMemo(() => {
        if (!searchTerm) return data;
        const lowerCaseSearchTerm = searchTerm.toLowerCase();
        return data.filter(item =>
            columns.some(column => {
                const value = item[column.accessor];
                return value != null && value.toString().toLowerCase().includes(lowerCaseSearchTerm);
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
                if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
                if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }
        return sorted;
    }, [filteredData, sortConfig]);

    const totalPages = Math.ceil(sortedData.length / itemsPerPage);
    const paginatedData = useMemo(() => sortedData.slice((currentPage - 1) * itemsPerPage, (currentPage - 1) * itemsPerPage + itemsPerPage), [sortedData, currentPage, itemsPerPage]);

    return (
        <div>
            <div className="table-controls-header">
                {filterControls}
                <div className="search-pagination-controls">
                    <div className="filter-group">
                        <label htmlFor="tableSearch">Search:</label>
                        <input id="tableSearch" type="text" className="input input-small" placeholder="Filter results..." value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }} />
                    </div>
                    <div className="filter-group">
                        <label htmlFor="itemsPerPage">Per Page:</label>
                        <select id="itemsPerPage" className="select select-small" value={itemsPerPage} onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}>
                            <option value={10}>10</option>
                            <option value={20}>20</option>
                            <option value={50}>50</option>
                            <option value={100}>100</option>
                        </select>
                    </div>
                </div>
            </div>

            <div className="card table-card">
                <div className="table-responsive">
                    <table>
                        <thead>
                            <tr>{columns.map(col => <SortableTableHeader key={col.accessor} column={col} sortConfig={sortConfig} onSort={handleSort} />)}</tr>
                        </thead>
                        <tbody>
                            {paginatedData.map((row, rowIndex) => (
                                <React.Fragment key={rowIndex}>
                                    <tr onClick={() => onRowClick && onRowClick(row)}>
                                        {columns.map(col => (
                                            <td key={col.accessor}>
                                                {col.cell ? col.cell(row) : row[col.accessor]}
                                            </td>
                                        ))}
                                    </tr>
                                    {/* Always render the sub-component row if the function is provided */}
                                    {renderRowSubComponent && (
                                        <tr>
                                            {renderRowSubComponent({ row: { original: row } })}
                                        </tr>
                                    )}
                                </React.Fragment>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {totalPages > 1 && (
                <div className="pagination-controls text-center" style={{marginTop: 'var(--spacing-lg)'}}>
                    <button className="btn btn-secondary" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>← Previous</button>
                    <span style={{margin: '0 1rem'}}>Page {currentPage} of {totalPages}</span>
                    <button className="btn btn-secondary" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>Next →</button>
                </div>
            )}
        </div>
    );
};

export default DataTable;