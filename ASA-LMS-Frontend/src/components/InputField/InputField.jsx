import React from "react";

const InputField = ({
  name,
  label,
  required,
  type,
  register,
  errors,
  handleEnterFocus,
  nextFieldName,
  addClass,
  customValidator,
  disabled,
  validation = {},
  inputProps = {},
  ...rest
}) => {
  const validationRules = {
    ...(required ? { required: `${label} is required` } : {}),
    ...validation,
  };

  if (customValidator === "email") {
    validationRules.pattern = {
      value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      message: "Enter a valid email address",
    };
  }

  return (
    <>
      <label className="form-label fw-medium mb-0">
        {label} {required && <span className="text-danger">*</span>}
      </label>

      <input
        type={type}
        onWheel={(e) => e.target.blur()}
        className={`form-control ${addClass || ""}`}
        placeholder={`Enter ${label}`}
        {...inputProps}
        {...(register ? register(name, validationRules) : {})}
        onKeyDown={(e) =>
          handleEnterFocus && handleEnterFocus(e, nextFieldName)
        }
        disabled={disabled}
        {...rest}
      />

      {errors && errors[name] && (
        <span className="text-danger">{errors[name]?.message}</span>
      )}
    </>
  );
};

export default InputField;