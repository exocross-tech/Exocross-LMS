import React, { useState, useEffect } from "react";
import { RiDeleteBin6Fill, RiEdit2Fill } from "react-icons/ri";
import DeleteConfirmation from "../DeleteConfirmation/DeleteConfirmation";
import "./ClientSideTable.css";
import { default as ReactPaginate } from "react-paginate";
import { filterByKeys } from "../../Utils/filterUtils";
import { FaFilePdf, FaBookOpen } from "react-icons/fa"; 
import { FaRegEye } from "react-icons/fa6";
import { BsFiletypeJson } from "react-icons/bs";
import { Tooltip } from "react-tooltip";
import "react-tooltip/dist/react-tooltip.css";

const ClientSideTable = React.memo(
  ({
    title = "Batch List",
    columns = [],
    data = [],
    loading = false,
    colSpan = columns?.length,
    onEdit,
    handleDelete,
    onChangeStatus,
    keysToSearch,
    download,
    downloadApp,
    onView,
    actions,
    onRowClick,
    onContent,
    pagination = true,
  }) => {
    const [search, setSearch] = useState("");
    const [currentPage, setCurrentPage] = useState(0);
    const itemsPerPage = 10;
    const filteredData = filterByKeys(data, search, keysToSearch);

    // Apply Pagination After Filtering (if enabled)
    const pageCount = pagination ? Math.ceil(filteredData.length / itemsPerPage) : 1;
    const paginatedData = pagination
      ? filteredData.slice(
          currentPage * itemsPerPage,
          (currentPage + 1) * itemsPerPage,
        )
      : filteredData;

    const handlePageClick = ({ selected }) => {
      setCurrentPage(selected);
    };

    useEffect(() => {
      setCurrentPage(0);
    }, [search]);

    const showingStart =
      filteredData.length === 0
        ? 0
        : pagination
        ? currentPage * itemsPerPage + 1
        : 1;
    const showingEnd = pagination
      ? Math.min((currentPage + 1) * itemsPerPage, filteredData.length)
      : filteredData.length;
    const totalCount = filteredData.length;

    return (
      <div className="lms-table-container">
        <div className="lms-table-card">
          {/* Table Top Header */}
          <div className="lms-table-top-header">
            {title ? <h3 className="lms-table-title">{title}</h3> : <div></div>}
            <div className="lms-table-search-area">
              <div className="lms-search-box">
                <input
                  type="text"
                  className="lms-search-input"
                  placeholder="Search..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Table Content */}
          <div className="lms-table-wrapper">
            <table className="lms-table">
              <thead>
                <tr>
                  <th>ID</th>
                  {columns?.map((col, i) => (
                    <th key={i}>{col.header}</th>
                  ))}
                  {actions && <th className="text-center">Action</th>}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan={colSpan + (actions ? 1 : 0) + 1}
                      className="lms-empty-cell"
                    >
                      <div className="lms-spinner"></div>
                    </td>
                  </tr>
                ) : filteredData.length === 0 ? (
                  <tr>
                    <td
                      colSpan={colSpan + (actions ? 1 : 0) + 1}
                      className="lms-empty-cell"
                    >
                      <span>No results found.</span>
                    </td>
                  </tr>
                ) : (
                  paginatedData.map((item, rowIndex) => (
                    <tr
                      key={rowIndex}
                      onClick={() => onRowClick && onRowClick(item)}
                    >
                      <td>
                        {pagination
                          ? currentPage * itemsPerPage + rowIndex + 1
                          : rowIndex + 1}
                      </td>
                      {columns.map((col, colIndex) => {
                        const value = item[col.accessor];
                        return (
                          <td key={colIndex} className={col.className}>
                            {" "}
                            {col.accessor === "PUBLISH" ? (
                              value === 1 ? (
                                "Published"
                              ) : (
                                "-"
                              )
                            ) : col.accessor === "STATUS" ? (
                              <span
                                className={
                                  value === "Access"
                                    ? "lms-status-badge success"
                                    : "lms-status-badge danger"
                                }
                              >
                                {" "}
                                {value || "-"}{" "}
                              </span>
                            ) : typeof value === "object" && value !== null ? (
                              value.label || value.name || JSON.stringify(value)
                            ) : (
                              value || "-"
                            )}{" "}
                          </td>
                        );
                      })}

                      {actions && (
                        <td className="text-center">
                          <div className="lms-action-group">
                            {onView && (
                              <button
                                type="button"
                                className="lms-action-btn view"
                                data-tooltip-id="action-tooltip"
                                data-tooltip-content="View"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onView(item);
                                }}
                              >
                                <FaEye size={16} />
                              </button>
                            )}
                            {download && (
                              <>
                                <button
                                  type="button"
                                  className="lms-action-btn pdf"
                                  data-tooltip-id="action-tooltip"
                                  data-tooltip-content="Download PDF"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    download(item);
                                  }}
                                >
                                  <FaFilePdf size={16} />
                                </button>
                                <button
                                  type="button"
                                  className="lms-action-btn app"
                                  data-tooltip-id="action-tooltip"
                                  data-tooltip-content="Download App File"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    downloadApp(item);
                                  }}
                                >
                                  <BsFiletypeJson size={16} />
                                </button>
                              </>
                            )}
                            {onEdit && (
                              <button
                                type="button"
                                className="lms-action-btn edit"
                                data-tooltip-id="action-tooltip"
                                data-tooltip-content="Edit"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onEdit(item);
                                }}
                              >
                                <RiEdit2Fill size={16} />
                              </button>
                            )}
                            {handleDelete && (
                              <div onClick={(e) => e.stopPropagation()}>
                                <DeleteConfirmation
                                  title="Are you sure want to delete?"
                                  text="Once deleted cannot be recovered again!"
                                  confirmButtonText="Delete"
                                  cancelButtonText="Cancel"
                                  confirmButtonClassName="confirm-btn"
                                  cancelButtonClassName="cancle-btn"
                                  onConfirm={() => handleDelete(item.ID)}
                                  tooltipId="action-tooltip"
                                  tooltipContent="Delete"
                                  trigger={
                                    <button
                                      type="button"
                                      className="lms-action-btn delete"
                                    >
                                      <RiDeleteBin6Fill size={16} />
                                    </button>
                                  }
                                />
                              </div>
                            )}
                            {onChangeStatus && (
                              <label
                                className="lms-toggle-switch"
                                data-tooltip-id="action-tooltip"
                                data-tooltip-content={
                                  Number(item.IS_ACTIVE) === 1
                                    ? "Deactivate"
                                    : "Activate"
                                }
                                onClick={(e) => e.stopPropagation()}
                              >
                                <input
                                  type="checkbox"
                                  checked={Number(item.IS_ACTIVE) === 1}
                                  onChange={(e) => {
                                    e.stopPropagation();

                                    const newStatus = e.target.checked ? 1 : 0;

                                    onChangeStatus(item.ID, newStatus);
                                  }}
                                />

                                <span className="lms-slider"></span>
                              </label>
                            )}
                            {onContent && (
                              <button
                                type="button"
                                className="lms-action-btn content"
                                data-tooltip-id="action-tooltip"
                                data-tooltip-content="Book Content"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onContent(item);
                                }}
                              >
                                <FaBookOpen size={16} />
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Table Footer */}
          <div className="lms-table-footer">
            <div className="lms-table-title-area">
              <div className="lms-table-count">
                {pagination
                  ? `Showing ${showingStart} to ${showingEnd} of ${totalCount} entries`
                  : `Showing all ${totalCount} entries`}
              </div>
            </div>

            {pagination && pageCount > 1 && (
              <div className="lms-pagination-wrapper">
                <ReactPaginate.default
                  previousLabel={"<"}
                  nextLabel={">"}
                  breakLabel={"..."}
                  pageCount={pageCount}
                  marginPagesDisplayed={1}
                  pageRangeDisplayed={2}
                  onPageChange={handlePageClick}
                  containerClassName={"lms-pagination"}
                  pageClassName={"lms-page-item"}
                  pageLinkClassName={"lms-page-link"}
                  previousClassName={"lms-page-item prev"}
                  nextClassName={"lms-page-item next"}
                  previousLinkClassName={"lms-page-link"}
                  nextLinkClassName={"lms-page-link"}
                  breakClassName={"lms-page-item break"}
                  breakLinkClassName={"lms-page-link"}
                  activeClassName={"active"}
                  disabledClassName={"disabled"}
                />
              </div>
            )}
          </div>
        </div>
        <Tooltip id="action-tooltip" />
      </div>
    );
  },
);

export default ClientSideTable;
