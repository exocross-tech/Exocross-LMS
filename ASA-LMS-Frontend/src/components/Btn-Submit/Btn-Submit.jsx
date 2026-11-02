import React, { useState, useEffect } from "react";
import { FaCircleCheck } from "react-icons/fa6";
import { FaRegCheckCircle } from "react-icons/fa";

const BtnSubmit = React.forwardRef(({ onClick, btnLoading }, ref) => {
  return (
    <>
      <button
        className="btn btn-primary btn-load"
        onClick={onClick}
        disabled={btnLoading}
        ref={ref}
      >
        <span className="d-flex align-items-center justify-content-center">
          {btnLoading && (
            <span
              className="spinner-border flex-shrink-0 me-2"
              role="status"
              style={{ width: "1rem", height: "1rem" }}
            >
              <span className="visually-hidden">Loading...</span>
            </span>
          )}
          {!btnLoading && (
            <span className="me-2 d-inline-flex align-items-center">
              <FaRegCheckCircle size={18} />
            </span>
          )}
          <span>{btnLoading ? "Loading..." : "Submit"}</span>
        </span>
      </button>
    </>
  );
});

export default BtnSubmit;
