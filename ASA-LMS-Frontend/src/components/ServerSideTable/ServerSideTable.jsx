import React, { useState, useEffect } from "react";
import { RiDeleteBin6Fill, RiEdit2Fill } from "react-icons/ri";
import { IoPrint } from "react-icons/io5";
import DeleteConfirmation from "../DeleteConfirmation/DeleteConfirmation";
import { toast } from "react-toastify";
import axios from "axios";
import { FaRegEye } from "react-icons/fa";

const ServerSideTable = React.memo(
  ({
    columns,
    apiUrl,
    actions,
    onPrint,
    onEdit,
    onDelete,
    onView,
    onChangeStatus,
    deleteUrl,
    onDataFetched,
    customFilter,
    reload,
    bulkDelete,
  }) => {
    const [data, setData] = useState([]);
    const [totalRecords, setTotalRecords] = useState(0);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState("");
    const [selectedIds, setSelectedIds] = useState([]);

    const apiClient = axios.create({
      baseURL: import.meta.env.VITE_API_BASE_URL,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${import.meta.env.VITE_API_KEY}`,
      },
    });

    useEffect(() => {
      fetchData();
    }, [page, pageSize, apiUrl, search, JSON.stringify(customFilter), reload]);

    const fetchData = async () => {
      setLoading(true);
      try {
        const response = await apiClient.post(apiUrl, {
          page,
          limit: pageSize,
          search,
          ...(customFilter || {}),
        });

        const fetchedData = response.data.data || [];
        setData(fetchedData);
        //setData(response.data.data || []);
        setTotalRecords(response.data.total || 0);
        if (onDataFetched) {
          onDataFetched(fetchedData);
        }
      } catch (error) {
        console.error("Error fetching data", error);
      } finally {
        setLoading(false);
      }
    };

    const handleDelete = async (id) => {
      try {
        const res = await apiClient.delete(`${deleteUrl}?id=${id}&userId=1`);
        if (res?.data?.status === 1) {
          toast.success(res?.data?.message);
          fetchData();
        } else {
          toast.error(res?.data?.message);
        }
      } catch (error) {
        console.error("Error deleting record", error);
        toast.error(error.message);
      }
    };

    const handleBulkDelete = async () => {
      if (selectedIds.length === 0) {
        toast.warning("Please select at least one record");
        return;
      }

      try {
        const res = await apiClient.post(bulkDelete, {
          ids: selectedIds,
          userId: 1,
        });

        if (res?.data?.status === 1) {
          toast.success(res.data.message || "Deleted successfully");
          setSelectedIds([]);
          fetchData();
        } else {
          toast.error(res?.data?.message);
        }
      } catch (error) {
        toast.error(error.message);
      }
    };

    return (
      <div className="table-responsive">
        {selectedIds.length > 0 && (
          <button
            className="btn btn-danger btn-sm mb-2"
            onClick={handleBulkDelete}
          >
            Delete Selected ({selectedIds.length})
          </button>
        )}
        <table className="table table-nowrap">
          <thead className="app-table-head">
            <tr>
              {/* <th>
                <input
                  type="checkbox"
                  checked={
                    data.length > 0 && selectedIds.length === data.length
                  }
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedIds(data.map((row) => row.ID));
                    } else {
                      setSelectedIds([]);
                    }
                  }}
                />
              </th> */}
              {columns.map((col, index) => (
                <>
                  <th key={index} className={col.className || ""}>
                    {col.header}
                  </th>
                </>
              ))}
              {actions && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan={columns.length + (actions ? 1 : 0)}
                  className="text-center py-4"
                >
                  <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Loading...</span>
                  </div>
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + (actions ? 1 : 0)}
                  className="text-center"
                >
                  No records found
                </td>
              </tr>
            ) : (
              data.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {/* <td>
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(row.ID)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedIds((prev) => [...prev, row.ID]);
                        } else {
                          setSelectedIds((prev) =>
                            prev.filter((id) => id !== row.ID)
                          );
                        }
                      }}
                    />
                  </td> */}
                  {columns.map((col, colIndex) => (
                    <>
                      <td key={colIndex} className={col.className || ""}>
                        {row[col.accessor] || "-"}
                      </td>
                    </>
                  ))}
                  {actions &&
                    (row?.ACTION ? (
                      <td>
                        <div className="d-flex gap-3">
                          {onChangeStatus && (
                            <div className="form-check form-switch">
                              <input
                                className="form-check-input text-success"
                                type="checkbox"
                                role="switch"
                                checked={row.IS_ACTIVE}
                                onChange={(ev) =>
                                  onChangeStatus(row.ID, ev.target.checked)
                                }
                              />
                            </div>
                          )}

                          {onPrint && (
                            <IoPrint
                              size={22}
                              className="text-warning cursor-pointer"
                              onClick={() => onPrint(row)}
                            />
                          )}

                          {onView && (
                            <FaRegEye
                              size={22}
                              className="text-danger cursor-pointer"
                              onClick={() => onView(row)}
                            />
                          )}

                          {onEdit && (
                            <RiEdit2Fill
                              size={22}
                              className="text-primary cursor-pointer"
                              onClick={() => onEdit(row)}
                            />
                          )}

                          {onDelete && (
                            <DeleteConfirmation
                              title="Are you sure want to delete?"
                              text="Once deleted cannot be recovered again!"
                              confirmButtonText="Delete"
                              cancelButtonText="Cancel"
                              confirmButtonClassName="confirm-btn"
                              cancelButtonClassName="cancle-btn"
                              onConfirm={() => handleDelete(row.ID)}
                              trigger={
                                <RiDeleteBin6Fill
                                  size={22}
                                  className="text-danger pointer"
                                  style={{ cursor: "pointer" }}
                                />
                              }
                            />
                          )}
                        </div>
                      </td>
                    ) : (
                      <td>-</td>
                    ))}
                </tr>
              ))
            )}
          </tbody>
        </table>

        <div className="d-flex justify-content-between align-items-center mt-2">
          <div>
            Page {page} of {Math.ceil(totalRecords / pageSize) || 1}
          </div>
          <div>
            <button
              className="btn btn-sm btn-primary me-2"
              disabled={page === 1}
              onClick={() => setPage((prev) => prev - 1)}
            >
              Prev
            </button>
            <button
              className="btn btn-sm btn-primary"
              disabled={page * pageSize >= totalRecords}
              onClick={() => setPage((prev) => prev + 1)}
            >
              Next
            </button>
          </div>
          <div>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              className="form-select form-select-sm"
            >
              {[10, 25, 50, 100].map((size) => (
                <option key={size} value={size}>
                  {size} / page
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    );
  }
);

export default ServerSideTable;
