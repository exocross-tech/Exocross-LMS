import React, { useState, useEffect, useCallback, useRef } from "react";
import { useForm } from "react-hook-form";
import { toast } from "react-toastify";
import "./BatchCreation.css";
import { batchesApi } from "../../services/apiService";
import ClientSideTable from "../../components/ClientSideTable/ClientSideTable";
import InputField from "../../components/InputField/InputField";
import BtnSubmit from "../../components/Btn-Submit/Btn-Submit";
import BtnClear from "../../components/Btn-Clear/Btn-Clear";
import BtnAdd from "../../components/Btn-Add/BtnAdd";
import Swal from "sweetalert2";
import { X } from "lucide-react";
import { batchesTableHeading } from "../../services/tableHeading";

const BatchCreation = () => {
    const [tableList, setTableList] = useState([]);
    const [loading, setLoading] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingBatch, setEditingBatch] = useState(null);
    const [btnLoading, setBtnLoading] = useState(false);
    const isFetched = useRef(false);
    const submitButtonRef = useRef(null);
    const keysToSearch = ["BATCH_CODE"];

    const {
        register,
        setFocus,
        reset,
        handleSubmit,
        setValue,
        formState: { errors },
    } = useForm({
        defaultValues: {
            batchCode: "",
            startDate: "",
            endDate: "",
        },
    });

    const getTableList = useCallback(async () => {
        setLoading(true);
        try {
            const res = await batchesApi.getBatches();
            if (res?.data?.status == 1) {
                setTableList(res?.data?.data || []);
            } else {
                setTableList([]);
                toast.error(res?.data?.message || "Failed to fetch batches list");
            }
        } catch (err) {
            toast.error("An error occurred while fetching batches list");
            setTableList([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!isFetched.current) {
            isFetched.current = true;
            getTableList();
        }
    }, [getTableList]);

    const handleEnterFocus = (e, nextFieldName) => {
        if (e.key === "Enter") {
            e.preventDefault();
            setFocus(nextFieldName);
        }
    };

    const handleKeyDown = (event, nextRef) => {
        nextRef = submitButtonRef;
        if (event.key === "Enter") {
            event.preventDefault();
            if (nextRef && nextRef.current) {
                nextRef.current.focus();
            }
        }
    };

    const clearForm = () => {
        reset({
            batchCode: "",
            startDate: "",
            endDate: "",
        });
    };

    const handleOpenModal = () => {
        setEditingBatch(null);
        clearForm();
        setIsModalOpen(true);
        setTimeout(() => {
            setFocus("batchCode");
        }, 100);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingBatch(null);
        clearForm();
    };

    const formatDateForInput = (dateStr) => {
        if (!dateStr) return "";
        const clean = String(dateStr).split("T")[0].trim();
        const parts = clean.split(/[-/]/);
        if (parts.length === 3) {
            const [p1, p2, p3] = parts;
            if (p1.length === 4) {
                return `${p1}-${p2.padStart(2, "0")}-${p3.padStart(2, "0")}`;
            } else if (p3.length === 4) {
                return `${p3}-${p2.padStart(2, "0")}-${p1.padStart(2, "0")}`;
            }
        }
        return clean;
    };

    const handleEdit = (item) => {
        if (Number(item.IS_ACTIVE) !== 1 && item.IS_ACTIVE !== true) {
            toast.warn("Please active then edit");
            return;
        }
        setEditingBatch(item);
        const startDate = formatDateForInput(item.START_DATE);
        const endDate = formatDateForInput(item.END_DATE);
        reset({
            batchCode: item.BATCH_CODE || "",
            startDate: startDate,
            endDate: endDate,
        });
        setIsModalOpen(true);
        setTimeout(() => {
            setFocus("batchCode");
        }, 100);
    };

    const formSubmit = async (data) => {
        let obj = {
            BATCH_CODE: data.batchCode,
            START_DATE: data.startDate,
            END_DATE: data.endDate,
            USER_ID: 1,
        };
        if (editingBatch) obj.ID = editingBatch.ID;
        setBtnLoading(true);
        try {
            let res = editingBatch
                ? await batchesApi.updateBatch(obj)
                : await batchesApi.addBatch(obj);
            if (res?.data?.status == 1) {
                toast.success(
                    res?.data?.message ||
                    `Batch ${editingBatch ? "updated" : "added"} successfully`,
                );
                if (editingBatch) {
                    setTableList((prevList) =>
                        prevList.map((item) =>
                            item.ID === editingBatch.ID ? { ...item, ...obj } : item,
                        ),
                    );
                } else {
                    getTableList();
                }
                handleCloseModal();
            } else {
                toast.error(res?.data?.message || "Failed to save batch");
            }
        } catch (err) {
            toast.error(err.message || "An error occurred while saving batch");
        } finally {
            setBtnLoading(false);
        }
    };
const handleStatusChange = async (id, newStatus) => {
    try {
        const batch = tableList.find(
            (item) => String(item.ID) === String(id)
        );

        if (!batch) {
            toast.error("Batch not found");
            return;
        }

        const isActivating = Number(newStatus) === 1;

        // =====================================================
        // ACTIVATE
        // =====================================================

        if (isActivating) {
            const result = await Swal.fire({
                title: "Activate Batch?",
                text: `Do you want to activate ${batch.BATCH_CODE}?`,
                icon: "question",
                showCancelButton: true,
                confirmButtonColor: "#2563eb",
                cancelButtonColor: "#64748b",
                confirmButtonText: "Yes, activate",
                cancelButtonText: "Cancel",
                background: "#0f172a",
                color: "#e2e8f0",
            });

            if (!result.isConfirmed) {
                return;
            }

            const res = await batchesApi.updateBatchStatus({
                ID: id,
                IS_ACTIVE: 1,
            });

            if (res?.data?.status === 1) {
                toast.success(
                    res?.data?.message ||
                    "Batch activated successfully"
                );

                await getTableList();
            } else {
                toast.error(
                    res?.data?.message ||
                    "Failed to activate batch"
                );
            }

            return;
        }

        // =====================================================
        // FIRST DEACTIVATION CHECK
        // =====================================================

        const checkRes = await batchesApi.updateBatchStatus({
            ID: id,
            IS_ACTIVE: 0,
            force: false,
        });

        // =====================================================
        // EMPTY BATCH
        // =====================================================

        if (checkRes?.data?.status === 1) {
            const result = await Swal.fire({
                title: "Inactive Batch?",
                text: `Do you want to inactive ${batch.BATCH_CODE}?`,
                icon: "warning",
                showCancelButton: true,
                confirmButtonColor: "#ef4444",
                cancelButtonColor: "#64748b",
                confirmButtonText: "Yes, inactive",
                cancelButtonText: "Cancel",
                background: "#0f172a",
                color: "#e2e8f0",
            });

            if (!result.isConfirmed) {
                return;
            }

            // =================================================
            // CONFIRM EMPTY BATCH DEACTIVATION
            // =================================================

            const res = await batchesApi.updateBatchStatus({
                ID: id,
                IS_ACTIVE: 0,
                force: true,
            });

            if (res?.data?.status === 1) {
                toast.success(
                    res?.data?.message ||
                    "Batch deactivated successfully"
                );

                await getTableList();
            } else {
                toast.error(
                    res?.data?.message ||
                    "Failed to deactivate batch"
                );
            }

            return;
        }

        // =====================================================
        // DATA EXISTS - ASK USER
        // =====================================================

        if (checkRes?.data?.status === 2) {
            const details = checkRes.data.data;

            const result = await Swal.fire({
                title: "Deactivate Batch?",
                html: `
                    <div style="text-align:left">
                        <p>
                            <strong>${details.batchCode}</strong>
                        </p>

                        <p>
                            This batch already has:
                        </p>

                        <ul>
                            <li>
                                Students:
                                <strong>${details.studentCount}</strong>
                            </li>

                            <li>
                                Tutors:
                                <strong>${details.tutorCount}</strong>
                            </li>

                            <li>
                                Scheduled Classes:
                                <strong>${details.scheduleCount}</strong>
                            </li>
                        </ul>

                        <p style="color:#f87171; font-weight:600;">
                            If you deactivate this batch,
                            all students, tutors and scheduled classes
                            will be removed from this batch.
                        </p>

                        <p>
                            Do you want to continue?
                        </p>
                    </div>
                `,
                icon: "warning",
                showCancelButton: true,
                confirmButtonColor: "#ef4444",
                cancelButtonColor: "#64748b",
                confirmButtonText: "Yes, deactivate",
                cancelButtonText: "Cancel",
                background: "#0f172a",
                color: "#e2e8f0",
            });

            if (!result.isConfirmed) {
                return;
            }

            // =================================================
            // USER CONFIRMED
            // =================================================

            const deleteRes = await batchesApi.updateBatchStatus({
                ID: id,
                IS_ACTIVE: 0,
                force: true,
            });

            if (deleteRes?.data?.status === 1) {
                toast.success(
                    deleteRes?.data?.message ||
                    "Batch deactivated successfully"
                );

                await getTableList();
            } else {
                toast.error(
                    deleteRes?.data?.message ||
                    "Failed to deactivate batch"
                );
            }

            return;
        }

        toast.error(
            checkRes?.data?.message ||
            "Failed to update batch status"
        );

    } catch (error) {
        console.error(
            "Batch status change error:",
            error
        );

        toast.error(
            error?.response?.data?.message ||
            error?.message ||
            "An error occurred while updating batch status"
        );
    }
};

    const handleDelete = async (id) => {
        try {
            const res = await batchesApi.deleteBatch(id);
            if (res?.data?.status === 1) {
                toast.success(res?.data?.message || "Batch deleted successfully");
                getTableList();
            } else {
                toast.error(res?.data?.message || "Failed to delete batch");
            }
        } catch (err) {
            console.error("Delete batch error:", err);
            toast.error(err?.response?.data?.message || err?.message || "Failed to delete batch");
        }
    };

    return (
        <div className="bc-container">
            <div className="bc-header-section">
                <div className="bc-breadcrumb">OPERATIONS</div>

                <div className="bc-title-row">
                    <div className="bc-title-left">
                        <h1 className="bc-title">Batch Creation</h1>
                        <p className="bc-subtitle">Create and manage student batches.</p>
                    </div>
                    <BtnAdd name="Add Batches" onClick={handleOpenModal} />
                </div>
            </div>

            <ClientSideTable
                title=""
                columns={batchesTableHeading}
                data={tableList}
                loading={loading}
                actions={true}
                onEdit={handleEdit}
                handleDelete={handleDelete}
                onChangeStatus={handleStatusChange}
                keysToSearch={keysToSearch}
            />

            {isModalOpen && (
                <div className="modal-overlay">
                    <div className="modal-content batch-creation-modal-md">
                        <div className="modal-header">
                            <h2>{editingBatch ? "Edit Batch" : "Add New Batch"}</h2>
                            <button
                                type="button"
                                className="batch-modal-close-btn"
                                onClick={handleCloseModal}
                                aria-label="Close modal"
                            >
                                <X size={20} color="#ffffff" />
                            </button>
                        </div>
                        <div className="batch-form-grid">
                            <div className="form-group">
                                <InputField
                                    name="batchCode"
                                    label="Batch Code"
                                    required={true}
                                    type="text"
                                    register={register}
                                    errors={errors}
                                    handleEnterFocus={handleEnterFocus}
                                    nextFieldName="startDate"
                                    addClass="upperCase"
                                />
                            </div>
                            <div className="form-group">
                                <InputField
                                    name="startDate"
                                    label="Start Date"
                                    required={true}
                                    type="date"
                                    register={register}
                                    errors={errors}
                                    handleEnterFocus={handleEnterFocus}
                                    nextFieldName="endDate"
                                    addClass=""
                                />
                            </div>
                            <div className="form-group">
                                <InputField
                                    name="endDate"
                                    label="End Date"
                                    required={true}
                                    type="date"
                                    register={register}
                                    errors={errors}
                                    handleEnterFocus={handleKeyDown}
                                    nextFieldName=""
                                    addClass=""
                                />
                            </div>
                            <div className="modal-actions full-width">
                                <BtnClear formReset={clearForm} />

                                <BtnSubmit
                                    onClick={handleSubmit(formSubmit)}
                                    btnLoading={btnLoading}
                                    ref={submitButtonRef}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BatchCreation;
