import React, { useState, useEffect, useMemo, useCallback } from "react";
import Select from "react-select";
import { toast } from "react-toastify";
import {
  Star,
  MessageSquare,
  Layers,
  Search,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  User,
  Quote,
  Sparkles,
  Award,
  Calendar,
  ThumbsUp,
  Filter,
} from "lucide-react";
import "./StudentsReviews.css";
import { sessionReviewApi } from "../../services/apiService";

const customSelectStyles = {
  control: (base, state) => ({
    ...base,
    minHeight: "44px",
    height: "44px",
    backgroundColor: "rgba(15, 23, 42, 0.78)",
    border: state.isFocused ? "1px solid #00e5ff" : "1px solid #334155",
    borderRadius: "10px",
    boxShadow: state.isFocused ? "0 0 0 2px rgba(0, 229, 255, 0.12)" : "none",
    cursor: "pointer",
    transition: "all 0.2s ease",
  }),
  singleValue: (base) => ({
    ...base,
    color: "#f8fafc",
    fontSize: "0.875rem",
    fontWeight: "500",
  }),
  placeholder: (base) => ({
    ...base,
    color: "#64748b",
    fontSize: "0.875rem",
  }),
  input: (base) => ({
    ...base,
    color: "#fff",
    fontSize: "0.875rem",
  }),
  indicatorSeparator: () => ({ display: "none" }),
  dropdownIndicator: (base, state) => ({
    ...base,
    color: state.isFocused ? "#00e5ff" : "#94a3b8",
    transition: "color 0.2s ease",
  }),
  menuPortal: (base) => ({
    ...base,
    zIndex: 999999,
  }),
  menu: (base) => ({
    ...base,
    backgroundColor: "#0f172a",
    border: "1px solid #334155",
    borderRadius: "10px",
    overflow: "hidden",
    zIndex: 999999,
    boxShadow: "0 10px 25px rgba(0, 0, 0, 0.6)",
  }),
  menuList: (base) => ({
    ...base,
    padding: "6px",
    backgroundColor: "#0f172a",
  }),
  option: (base, state) => ({
    ...base,
    backgroundColor: state.isSelected
      ? "rgba(0, 240, 255, 0.2)"
      : state.isFocused
      ? "rgba(0, 229, 255, 0.1)"
      : "transparent",
    color: state.isSelected ? "#00f0ff" : "#f8fafc",
    borderRadius: "6px",
    padding: "10px 14px",
    cursor: "pointer",
    fontSize: "0.85rem",
    fontWeight: state.isSelected ? "600" : "400",
    transition: "all 0.15s ease",
  }),
};

const RATING_OPTIONS = [
  { value: "ALL", label: "All Ratings" },
  { value: "5", label: "5 Stars (★★★★★)" },
  { value: "4", label: "4 Stars (★★★★☆)" },
  { value: "3", label: "3 Stars (★★★☆☆)" },
  { value: "2", label: "2 Stars (★★☆☆☆)" },
  { value: "1", label: "1 Star (★☆☆☆☆)" },
];

const StudentsReviews = () => {
  const [currentUser, setCurrentUser] = useState(null);
  const [batches, setBatches] = useState([]);
  const [batchesLoading, setBatchesLoading] = useState(false);
  const [selectedBatchOption, setSelectedBatchOption] = useState({
    value: "ALL",
    label: "All Batches",
  });
  const [selectedRatingOption, setSelectedRatingOption] = useState(
    RATING_OPTIONS[0]
  );

  const [reviews, setReviews] = useState([]);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Read logged in user
  useEffect(() => {
    try {
      const stored =
        sessionStorage.getItem("ASA_LMSUser") ||
        sessionStorage.getItem("user") ||
        localStorage.getItem("ASA_LMSUser") ||
        localStorage.getItem("user");

      if (stored) {
        const parsed = typeof stored === "string" ? JSON.parse(stored) : stored;
        setCurrentUser(parsed);
      }
    } catch (e) {
      console.error("Error reading current user in StudentsReviews:", e);
    }
  }, []);

  const currentUserId = useMemo(() => {
    return (
      currentUser?.USER_ID ||
      currentUser?.userId ||
      currentUser?.id ||
      null
    );
  }, [currentUser]);

  const userType = useMemo(() => {
    return String(
      currentUser?.USER_TYPE ||
      currentUser?.userType ||
      currentUser?.ROLE ||
      ""
    ).toUpperCase().trim();
  }, [currentUser]);

  const isTutor = userType === "TUTOR";

  // Fetch batches available to the role
  const fetchBatches = useCallback(async () => {
    if (!currentUserId) return;
    try {
      setBatchesLoading(true);
      const res = await sessionReviewApi.getBatches({ userId: currentUserId });
      if (res.data?.status === 1) {
        const batchList = res.data.data || [];
        setBatches(batchList);
      } else {
        toast.error(res.data?.message || "Failed to load batches");
      }
    } catch (err) {
      console.error("Error fetching review batches:", err);
      toast.error(err.response?.data?.message || "Failed to load batches");
    } finally {
      setBatchesLoading(false);
    }
  }, [currentUserId]);

  // Fetch student reviews
  const fetchReviews = useCallback(async () => {
    if (!currentUserId) return;
    try {
      setReviewsLoading(true);
      const params = {
        userId: currentUserId,
      };

      if (selectedBatchOption && selectedBatchOption.value !== "ALL") {
        params.batchId = selectedBatchOption.value;
      }

      if (selectedRatingOption && selectedRatingOption.value !== "ALL") {
        params.starRating = selectedRatingOption.value;
      }

      const res = await sessionReviewApi.getReviews(params);
      if (res.data?.status === 1) {
        setReviews(res.data.data || []);
      } else {
        toast.error(res.data?.message || "Failed to load reviews");
        setReviews([]);
      }
    } catch (err) {
      console.error("Error fetching student reviews:", err);
      toast.error(err.response?.data?.message || "Failed to load student reviews");
      setReviews([]);
    } finally {
      setReviewsLoading(false);
    }
  }, [currentUserId, selectedBatchOption, selectedRatingOption]);

  useEffect(() => {
    if (currentUserId) {
      fetchBatches();
    }
  }, [currentUserId, fetchBatches]);

  useEffect(() => {
    if (currentUserId) {
      fetchReviews();
      setCurrentPage(1);
    }
  }, [currentUserId, selectedBatchOption, selectedRatingOption, fetchReviews]);

  // Batch dropdown options
  const batchOptions = useMemo(() => {
    const allLabel = isTutor ? "All Assigned Batches" : "All Batches";
    const defaultOpt = { value: "ALL", label: allLabel };

    const opts = batches.map((b) => {
      const code = b.BATCH_CODE || `ID-${b.BATCH_ID}`;
      const name = b.BATCH_NAME && b.BATCH_NAME !== code ? ` - ${b.BATCH_NAME}` : "";
      const roleTag = b.TUTOR_ROLE && b.TUTOR_ROLE !== "ADMIN" ? ` [${b.TUTOR_ROLE}]` : "";
      return {
        value: b.BATCH_ID || b.ID,
        label: `${code}${name}${roleTag}`,
      };
    });

    return [defaultOpt, ...opts];
  }, [batches, isTutor]);

  // Filtered reviews by local search term
  const filteredReviews = useMemo(() => {
    if (!searchTerm.trim()) return reviews;
    const term = searchTerm.toLowerCase().trim();
    return reviews.filter((r) => {
      const name = (r.STUDENT_NAME || "").toLowerCase();
      const roll = (r.ROLL_NO || "").toLowerCase();
      const comment = (r.COMMENTS || "").toLowerCase();
      const batch = (r.BATCH_CODE || "").toLowerCase();
      const batchName = (r.BATCH_NAME || "").toLowerCase();
      return (
        name.includes(term) ||
        roll.includes(term) ||
        comment.includes(term) ||
        batch.includes(term) ||
        batchName.includes(term)
      );
    });
  }, [reviews, searchTerm]);

  // KPI Metrics Calculation
  const metrics = useMemo(() => {
    const total = reviews.length;
    if (total === 0) {
      return { total: 0, avgRating: "0.0", fiveStarCount: 0, recommendCount: 0 };
    }

    let sum = 0;
    let countWithRating = 0;
    let fiveStar = 0;
    let recommends = 0;

    reviews.forEach((r) => {
      if (r.OVERALL_RATING !== null && r.OVERALL_RATING !== undefined) {
        sum += Number(r.OVERALL_RATING);
        countWithRating++;
      }
      if (r.ROUNDED_STAR === 5) {
        fiveStar++;
      }
      if (r.RECOMMENDATION === "Yes") {
        recommends++;
      }
    });

    const avg = countWithRating > 0 ? (sum / countWithRating).toFixed(1) : "0.0";
    return {
      total,
      avgRating: avg,
      fiveStarCount: fiveStar,
      recommendCount: recommends,
    };
  }, [reviews]);

  // Pagination calculation
  const totalPages = Math.ceil(filteredReviews.length / itemsPerPage) || 1;
  const paginatedReviews = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredReviews.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredReviews, currentPage, itemsPerPage]);

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  // Helper to format date
  const formatDate = (dateStr) => {
    if (!dateStr) return "—";
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return String(dateStr);
      return d.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return String(dateStr);
    }
  };

  // Helper to get initials
  const getInitials = (name) => {
    if (!name) return "S";
    const parts = name.trim().split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  // Helper to render star icons
  const renderStars = (rating, rounded) => {
    if (rating === null || rating === undefined) {
      return <span className="no-rating">No rating</span>;
    }

    const starCount = rounded || Math.round(Number(rating));

    return (
      <div className="star-rating-display">
        <div className="stars-row" title={`${rating} out of 5 stars`}>
          {[1, 2, 3, 4, 5].map((i) => (
            <Star
              key={i}
              size={15}
              className={i <= starCount ? "star-icon filled" : "star-icon empty"}
            />
          ))}
        </div>
        <span className="star-score-badge">
          {Number(rating).toFixed(1)} / 5
        </span>
      </div>
    );
  };

  return (
    <div className="students-reviews-page">
      {/* ================= HEADER SECTION ================= */}
      <div className="sr-header-section">
        <div className="sr-breadcrumb">
          <Sparkles size={12} />
          <span>EVALUATION & PERFORMANCE</span>
        </div>
        <div className="sr-title-row">
          <div className="sr-title-left">
            <h1 className="sr-title">Students Reviews</h1>
            <p className="sr-subtitle">
              {isTutor
                ? "View student session feedback and ratings for your assigned batches."
                : "Manage and monitor student session reviews, ratings, and comments across all batches."}
            </p>
          </div>

          {/* ================= TOP FILTER CONTROLS ================= */}
          <div className="sr-header-controls">
            {/* Batch Select */}
            <div className="sr-filter-group">
              <label className="sr-filter-lbl">
                <Layers size={13} />
                <span>SELECT BATCH</span>
              </label>
              <div className="sr-select-wrap batch">
                <Select
                  value={selectedBatchOption}
                  onChange={(opt) => setSelectedBatchOption(opt)}
                  options={batchOptions}
                  styles={customSelectStyles}
                  isLoading={batchesLoading}
                  isSearchable
                  placeholder="Select Batch..."
                  menuPortalTarget={typeof document !== "undefined" ? document.body : null}
                />
              </div>
            </div>

            {/* Star Rating Select */}
            <div className="sr-filter-group">
              <label className="sr-filter-lbl">
                <Star size={13} />
                <span>SELECT STAR RATING</span>
              </label>
              <div className="sr-select-wrap rating">
                <Select
                  value={selectedRatingOption}
                  onChange={(opt) => setSelectedRatingOption(opt)}
                  options={RATING_OPTIONS}
                  styles={customSelectStyles}
                  isSearchable={false}
                  placeholder="Select Star..."
                  menuPortalTarget={typeof document !== "undefined" ? document.body : null}
                />
              </div>
            </div>

            {/* Refresh Button */}
            <button
              type="button"
              className="sr-btn-refresh"
              onClick={() => {
                fetchBatches();
                fetchReviews();
              }}
              title="Refresh Reviews"
              disabled={reviewsLoading}
            >
              <RefreshCw size={16} className={reviewsLoading ? "spinning" : ""} />
            </button>
          </div>
        </div>
      </div>

      {/* ================= KPI METRIC CARDS ================= */}
      <div className="sr-stats-grid">
        <div className="sr-stat-card">
          <div className="stat-card-icon blue">
            <MessageSquare size={20} />
          </div>
          <div className="stat-card-info">
            <span className="stat-lbl">TOTAL REVIEWS</span>
            <strong className="stat-val">{metrics.total}</strong>
          </div>
        </div>

        <div className="sr-stat-card">
          <div className="stat-card-icon amber">
            <Star size={20} />
          </div>
          <div className="stat-card-info">
            <span className="stat-lbl">AVERAGE RATING</span>
            <strong className="stat-val">
              {metrics.avgRating} <span className="stat-subval">/ 5</span>
            </strong>
          </div>
        </div>

        <div className="sr-stat-card">
          <div className="stat-card-icon green">
            <Award size={20} />
          </div>
          <div className="stat-card-info">
            <span className="stat-lbl">5-STAR RATINGS</span>
            <strong className="stat-val">{metrics.fiveStarCount}</strong>
          </div>
        </div>

        <div className="sr-stat-card">
          <div className="stat-card-icon cyan">
            <ThumbsUp size={20} />
          </div>
          <div className="stat-card-info">
            <span className="stat-lbl">RECOMMENDED BY</span>
            <strong className="stat-val">{metrics.recommendCount}</strong>
          </div>
        </div>
      </div>

      {/* ================= TABLE CARD ================= */}
      <div className="sr-table-card">
        {/* Table Search & Meta Header */}
        <div className="sr-table-toolbar">
          <div className="toolbar-search">
            <Search size={15} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search by student name, roll no, comment..."
            />
          </div>

          <div className="toolbar-count">
            Showing <strong>{filteredReviews.length}</strong> {filteredReviews.length === 1 ? "review" : "reviews"}
          </div>
        </div>

        {/* Table Content */}
        {reviewsLoading ? (
          <div className="sr-loading-state">
            <div className="sr-loader"></div>
            <span>Loading student reviews...</span>
          </div>
        ) : paginatedReviews.length === 0 ? (
          <div className="sr-empty-state">
            <div className="empty-icon-wrap">
              <Star size={36} />
            </div>
            <h3>No Reviews Found</h3>
            <p>
              {searchTerm || selectedBatchOption.value !== "ALL" || selectedRatingOption.value !== "ALL"
                ? "No student reviews match your active batch or star rating filter."
                : "No session reviews have been submitted by students yet."}
            </p>
          </div>
        ) : (
          <div className="sr-table-responsive">
            <table className="sr-table">
              <thead>
                <tr>
                  <th style={{ width: "90px" }}>ID</th>
                  <th style={{ minWidth: "200px" }}>STUDENT NAME</th>
                  <th style={{ minWidth: "150px" }}>BATCH</th>
                  <th style={{ minWidth: "160px" }}>OVERALL STAR</th>
                  <th style={{ minWidth: "260px" }}>COMMENTS</th>
                  <th style={{ width: "160px" }}>SUBMITTED ON</th>
                </tr>
              </thead>
              <tbody>
                {paginatedReviews.map((rev) => (
                  <tr key={rev.ID}>
                    {/* Review ID */}
                    <td>
                      <span className="sr-id-badge">#{rev.ID}</span>
                    </td>

                    {/* Student Name */}
                    <td>
                      <div className="sr-student-cell">
                        <div className="sr-avatar">
                          {getInitials(rev.STUDENT_NAME)}
                        </div>
                        <div className="sr-student-info">
                          <strong className="sr-student-name">
                            {rev.STUDENT_NAME || "Student"}
                          </strong>
                          {rev.ROLL_NO && (
                            <span className="sr-student-roll">
                              {rev.ROLL_NO}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Batch Code / Name */}
                    <td>
                      <div className="sr-batch-cell">
                        <span className="sr-batch-code">
                          {rev.BATCH_CODE || `Batch-${rev.BATCH_ID}`}
                        </span>
                        {rev.BATCH_NAME && rev.BATCH_NAME !== rev.BATCH_CODE && (
                          <span className="sr-batch-name">
                            {rev.BATCH_NAME}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Overall Star */}
                    <td>
                      {renderStars(rev.OVERALL_RATING, rev.ROUNDED_STAR)}
                    </td>

                    {/* Comments */}
                    <td>
                      {rev.COMMENTS ? (
                        <div className="sr-comment-bubble">
                          <Quote size={13} className="comment-quote-icon" />
                          <span className="sr-comment-text">{rev.COMMENTS}</span>
                        </div>
                      ) : (
                        <span className="sr-no-comment">No written comment provided</span>
                      )}
                    </td>

                    {/* Submitted Date */}
                    <td>
                      <span className="sr-date-cell">
                        <Calendar size={13} />
                        {formatDate(rev.CREATED_DATE)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ================= PAGINATION ================= */}
        {!reviewsLoading && filteredReviews.length > itemsPerPage && (
          <div className="sr-pagination">
            <span className="pagination-info">
              Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong>
            </span>

            <div className="pagination-actions">
              <button
                type="button"
                className="pagination-btn"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
              >
                <ChevronLeft size={16} />
                <span>Previous</span>
              </button>

              <div className="pagination-numbers">
                {Array.from({ length: totalPages }, (_, idx) => idx + 1).map((p) => {
                  // Only show current, first, last, and near pages for readability
                  if (
                    p === 1 ||
                    p === totalPages ||
                    (p >= currentPage - 1 && p <= currentPage + 1)
                  ) {
                    return (
                      <button
                        key={p}
                        type="button"
                        className={`page-num-btn ${p === currentPage ? "active" : ""}`}
                        onClick={() => handlePageChange(p)}
                      >
                        {p}
                      </button>
                    );
                  }
                  if (p === currentPage - 2 || p === currentPage + 2) {
                    return (
                      <span key={p} className="page-ellipsis">
                        ...
                      </span>
                    );
                  }
                  return null;
                })}
              </div>

              <button
                type="button"
                className="pagination-btn"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
              >
                <span>Next</span>
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentsReviews;
