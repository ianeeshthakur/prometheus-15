import React, { useState, useMemo, useEffect } from 'react';
import './DataTable.css';

/**
 * Utility to safely get nested property values (e.g. "location.district" or "name")
 */
function getRowValue(row, key) {
  if (!row || !key) return '';
  if (typeof key === 'function') return key(row);
  if (key.includes('.')) {
    return key.split('.').reduce((acc, part) => (acc ? acc[part] : undefined), row);
  }
  return row[key];
}

/**
 * DataTable Component
 * Reusable light-theme government CCTV / GIS table with search, dropdown filters,
 * pagination, smooth hover transitions, and gentle fade-in on filter updates.
 *
 * @param {Array<{key: string, label: string, render?: Function, sortable?: boolean, align?: string, width?: string}>} columns - Column configs
 * @param {Array<Object>} [rows=[]] - Data rows
 * @param {Array<Object>} [data] - Alias for rows
 * @param {string|Function} [rowKey='id'] - Key extractor for rows
 * @param {string} [title] - Optional table title
 * @param {string} [subtitle] - Optional table subtitle
 * @param {boolean} [searchable=true] - Whether to show search input
 * @param {string} [searchPlaceholder='Search records...'] - Search box placeholder
 * @param {Array<string>} [searchKeys] - Specific keys to search in (defaults to all row values)
 * @param {Array<{key: string, label?: string, options?: Array<{value: any, label: string}|string>, placeholder?: string}>} [filters=[]] - Dropdown filters
 * @param {boolean} [pagination=true] - Whether to enable pagination
 * @param {number} [pageSize=10] - Initial rows per page
 * @param {Array<number>} [pageSizeOptions=[5, 10, 25, 50]] - Page size options
 * @param {Function} [onRowClick] - Row click callback
 * @param {string} [emptyMessage='No records found.'] - Message displayed when no rows match
 * @param {React.ReactNode} [actions] - Action buttons in toolbar right
 * @param {string} [className=''] - Custom container CSS class
 */
function DataTable({
  columns = [],
  rows,
  data,
  rowKey = 'id',
  title,
  subtitle,
  searchable = true,
  searchPlaceholder = 'Search records...',
  searchKeys,
  filters = [],
  pagination = true,
  pageSize: initialPageSize = 10,
  pageSizeOptions = [5, 10, 25, 50],
  onRowClick,
  emptyMessage = 'No records found matching your criteria.',
  actions,
  className = '',
}) {
  const rawRows = rows || data || [];

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilters, setActiveFilters] = useState({});
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);

  // Transition version token: increments on search/filter/page changes to re-trigger gentle 180ms row fade-in
  const [filterVersion, setFilterVersion] = useState(0);

  // Reset pagination & trigger gentle fade-in on filter/search change
  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1);
    setFilterVersion((v) => v + 1);
  };

  const handleClearSearch = () => {
    setSearchTerm('');
    setCurrentPage(1);
    setFilterVersion((v) => v + 1);
  };

  const handleFilterChange = (filterKey, value) => {
    setActiveFilters((prev) => ({
      ...prev,
      [filterKey]: value,
    }));
    setCurrentPage(1);
    setFilterVersion((v) => v + 1);
  };

  const handleSort = (columnKey, sortable) => {
    if (!sortable) return;
    setSortConfig((prev) => {
      if (prev.key === columnKey) {
        if (prev.direction === 'asc') return { key: columnKey, direction: 'desc' };
        return { key: null, direction: 'asc' };
      }
      return { key: columnKey, direction: 'asc' };
    });
    setFilterVersion((v) => v + 1);
  };

  // Derive dropdown options dynamically if not provided
  const derivedFilterConfigs = useMemo(() => {
    return filters.map((f) => {
      if (f.options && Array.isArray(f.options) && f.options.length > 0) {
        return f;
      }
      // Auto-extract unique values from raw data
      const uniqueVals = new Set();
      rawRows.forEach((row) => {
        const val = getRowValue(row, f.key);
        if (val !== undefined && val !== null && String(val).trim() !== '') {
          uniqueVals.add(String(val));
        }
      });
      const generatedOptions = [
        { value: 'ALL', label: f.placeholder || `All ${f.label || f.key}` },
        ...Array.from(uniqueVals).sort().map((v) => ({ value: v, label: v })),
      ];
      return { ...f, options: generatedOptions };
    });
  }, [filters, rawRows]);

  // Filter & Search Rows
  const filteredRows = useMemo(() => {
    let result = [...rawRows];

    // 1. Search Query
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      result = result.filter((row) => {
        if (searchKeys && Array.isArray(searchKeys) && searchKeys.length > 0) {
          return searchKeys.some((k) => {
            const val = getRowValue(row, k);
            return val !== undefined && val !== null && String(val).toLowerCase().includes(q);
          });
        }
        // Search across all columns or row values
        return columns.some((col) => {
          const val = getRowValue(row, col.key);
          return val !== undefined && val !== null && String(val).toLowerCase().includes(q);
        });
      });
    }

    // 2. Dropdown Filters
    Object.entries(activeFilters).forEach(([key, filterVal]) => {
      if (!filterVal || filterVal === 'ALL') return;
      result = result.filter((row) => {
        const rowVal = getRowValue(row, key);
        return String(rowVal).toLowerCase() === String(filterVal).toLowerCase();
      });
    });

    // 3. Sorting
    if (sortConfig.key) {
      result.sort((a, b) => {
        const aVal = getRowValue(a, sortConfig.key);
        const bVal = getRowValue(b, sortConfig.key);

        if (aVal === bVal) return 0;
        if (aVal === null || aVal === undefined) return 1;
        if (bVal === null || bVal === undefined) return -1;

        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
        }

        const comp = String(aVal).localeCompare(String(bVal), undefined, { numeric: true });
        return sortConfig.direction === 'asc' ? comp : -comp;
      });
    }

    return result;
  }, [rawRows, searchTerm, searchKeys, columns, activeFilters, sortConfig]);

  // Pagination calculations
  const totalRecords = filteredRows.length;
  const totalPages = pagination ? Math.max(1, Math.ceil(totalRecords / pageSize)) : 1;

  // Ensure currentPage doesn't exceed totalPages
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);

  const paginatedRows = useMemo(() => {
    if (!pagination) return filteredRows;
    const startIdx = (currentPage - 1) * pageSize;
    return filteredRows.slice(startIdx, startIdx + pageSize);
  }, [filteredRows, pagination, currentPage, pageSize]);

  const startIndex = totalRecords === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endIndex = Math.min(currentPage * pageSize, totalRecords);

  // Generate pagination page numbers with smart ellipsis
  const pageNumbers = useMemo(() => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    if (currentPage <= 4) {
      return [1, 2, 3, 4, 5, '...', totalPages];
    }
    if (currentPage >= totalPages - 3) {
      return [1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    }
    return [1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages];
  }, [totalPages, currentPage]);

  const getRowKey = (row, index) => {
    if (typeof rowKey === 'function') return rowKey(row, index);
    return row[rowKey] !== undefined ? row[rowKey] : index;
  };

  return (
    <div className={`data-table-container ${className}`}>
      {/* Table Toolbar: Title, Search & Filters */}
      {(title || searchable || derivedFilterConfigs.length > 0 || actions) && (
        <div className="data-table-toolbar">
          <div className="data-table-toolbar-left">
            {title && (
              <div className="data-table-title-group">
                <h3 className="data-table-title">{title}</h3>
                {subtitle && <p className="data-table-subtitle">{subtitle}</p>}
              </div>
            )}

            {searchable && (
              <div className="data-table-search-wrapper">
                <svg
                  className="data-table-search-icon"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  type="text"
                  className="data-table-search-input"
                  placeholder={searchPlaceholder}
                  value={searchTerm}
                  onChange={handleSearchChange}
                />
                {searchTerm && (
                  <button
                    type="button"
                    className="data-table-search-clear"
                    onClick={handleClearSearch}
                    title="Clear search"
                    aria-label="Clear search"
                  >
                    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="data-table-toolbar-right">
            {derivedFilterConfigs.map((f) => (
              <div key={f.key} className="data-table-filter-group">
                {f.label && <span className="data-table-filter-label">{f.label}:</span>}
                <select
                  className="data-table-filter-select"
                  value={activeFilters[f.key] || 'ALL'}
                  onChange={(e) => handleFilterChange(f.key, e.target.value)}
                >
                  {f.options.map((opt) => {
                    const val = typeof opt === 'object' ? opt.value : opt;
                    const label = typeof opt === 'object' ? opt.label : opt;
                    return (
                      <option key={val} value={val}>
                        {label}
                      </option>
                    );
                  })}
                </select>
              </div>
            ))}

            {actions}
          </div>
        </div>
      )}

      {/* Table Main Content */}
      <div className="data-table-wrapper">
        <table className="data-table">
          <thead className="data-table-head">
            <tr>
              {columns.map((col) => {
                const isSorted = sortConfig.key === col.key;
                const sortDir = isSorted ? sortConfig.direction : null;
                return (
                  <th
                    key={col.key}
                    className={`data-table-th ${col.sortable ? 'sortable' : ''} ${
                      isSorted ? `sorted-${sortDir}` : ''
                    }`}
                    style={{
                      width: col.width || 'auto',
                      textAlign: col.align || 'left',
                    }}
                    onClick={() => handleSort(col.key, col.sortable)}
                  >
                    <div className="data-table-th-content">
                      <span>{col.label}</span>
                      {col.sortable && (
                        <svg
                          className="data-table-sort-icon"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          {sortDir === 'asc' ? (
                            <path d="M18 15l-6-6-6 6" />
                          ) : sortDir === 'desc' ? (
                            <path d="M6 9l6 6 6-6" />
                          ) : (
                            <>
                              <path d="M7 14l5 5 5-5" />
                              <path d="M7 10l5-5 5 5" />
                            </>
                          )}
                        </svg>
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody key={filterVersion} className="data-table-tbody">
            {paginatedRows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="data-table-empty">
                  <svg
                    className="data-table-empty-icon"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    <line x1="8" y1="11" x2="14" y2="11" />
                  </svg>
                  <p className="data-table-empty-text">{emptyMessage}</p>
                </td>
              </tr>
            ) : (
              paginatedRows.map((row, index) => {
                const rowKeyVal = getRowKey(row, index);
                return (
                  <tr
                    key={rowKeyVal}
                    className={`data-table-row ${onRowClick ? 'is-clickable' : ''}`}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                  >
                    {columns.map((col) => {
                      const rawValue = getRowValue(row, col.key);
                      const rendered = col.render ? col.render(rawValue, row) : rawValue;
                      return (
                        <td
                          key={col.key}
                          className="data-table-td"
                          style={{ textAlign: col.align || 'left' }}
                        >
                          {rendered !== undefined && rendered !== null ? rendered : '—'}
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer Strip */}
      {pagination && totalRecords > 0 && (
        <div className="data-table-pagination">
          <div className="data-table-pagination-info">
            Showing <strong>{startIndex}</strong> to <strong>{endIndex}</strong> of{' '}
            <strong>{totalRecords}</strong> records
          </div>

          <div className="data-table-pagination-controls">
            {/* Page Size Picker */}
            <div className="data-table-page-size-picker">
              <span>Show</span>
              <select
                className="data-table-page-size-select"
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                  setFilterVersion((v) => v + 1);
                }}
              >
                {pageSizeOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
              <span>per page</span>
            </div>

            {/* Page Nav Buttons */}
            {totalPages > 1 && (
              <div className="data-table-page-nav">
                <button
                  type="button"
                  className="data-table-page-btn"
                  disabled={currentPage === 1}
                  onClick={() => {
                    setCurrentPage((p) => Math.max(1, p - 1));
                    setFilterVersion((v) => v + 1);
                  }}
                  title="Previous Page"
                  aria-label="Previous Page"
                >
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="15 18 9 12 15 6" />
                  </svg>
                </button>

                {pageNumbers.map((p, idx) => {
                  if (p === '...') {
                    return (
                      <span key={`ellipsis-${idx}`} className="data-table-page-ellipsis">
                        …
                      </span>
                    );
                  }
                  return (
                    <button
                      key={p}
                      type="button"
                      className={`data-table-page-btn ${currentPage === p ? 'active' : ''}`}
                      onClick={() => {
                        setCurrentPage(p);
                        setFilterVersion((v) => v + 1);
                      }}
                    >
                      {p}
                    </button>
                  );
                })}

                <button
                  type="button"
                  className="data-table-page-btn"
                  disabled={currentPage === totalPages}
                  onClick={() => {
                    setCurrentPage((p) => Math.min(totalPages, p + 1));
                    setFilterVersion((v) => v + 1);
                  }}
                  title="Next Page"
                  aria-label="Next Page"
                >
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default DataTable;
