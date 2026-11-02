import React, { useState, useEffect, useRef } from "react";

const SelectBox = ({
  name,
  label,
  required,
  type,
  register,
  errors,
  handleEnterFocus,
  addClass,
  nextFieldName,
  selectBoxData,
  disabled,
  onChange,
  ...rest
}) => {
  return (
    <>
      <label className="form-label text-dark fw-medium mb-0">
        {label} {required && <span className="text-danger">*</span>}
      </label>
      <select
        className={`form-select ${addClass || ""}`}
        {...register(name, {
          required: required ? `${label} is required` : false,
        })}
        onKeyDown={(e) =>
          handleEnterFocus && handleEnterFocus(e, nextFieldName)
        }
        disabled={disabled} onChange={(ev) => {onChange(ev.target.value)}}
        {...rest}
      >
        <option value="" disabled>-- Select --</option>
        {selectBoxData.map((item, index) => (
          <option key={index} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>
      {errors[name] && (
        <span className="text-danger">{errors[name]?.message}</span>
      )}
    </>
  );
};
export default SelectBox;
