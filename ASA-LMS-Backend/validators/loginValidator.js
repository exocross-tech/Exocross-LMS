const Joi = require("joi");

const loginSchema = Joi.object({
  SCHOOL_ID: Joi.string().trim().required().messages({
    "number.empty": "School ID is required as a string.",
    "any.required": "School ID is required.",
  }),
  USER_TYPE: Joi.string().trim().required().messages({
    "string.empty": "User Type is required as a string.",
    "any.required": "User Type is required.",
  }),
  USER_NAME: Joi.when("USER_TYPE", {
    is: "teacher",
    then: Joi.string().trim().required().messages({
      "string.empty": "User Name is required as a string.",
      "any.required": "User Name is required.",
    }),
    otherwise: Joi.string().allow(null, "").optional(),
  }),
  PASSWORD: Joi.when("USER_TYPE", {
    is: "teacher",
    then: Joi.string().trim().required().messages({
      "string.empty": "Password is required as a string.",
      "any.required": "Password is required.",
    }),
    otherwise: Joi.string().allow(null, "").optional(),
  }),
  STUDENT_NAME: Joi.when("USER_TYPE", {
    is: "student",
    then: Joi.string().trim().required().messages({
      "string.empty": "Student Name is required.",
      "any.required": "Student Name is required.",
    }),
    otherwise: Joi.string().allow(null, "").optional(),
  }),
  CLASS: Joi.when("USER_TYPE", {
    is: "student",
    then: Joi.string().trim().required().messages({
      "string.empty": "Class is required.",
      "any.required": "Class is required.",
    }),
    otherwise: Joi.string().allow(null, "").optional(),
  }),
  REGISTER_NUMBER: Joi.when("USER_TYPE", {
    is: "student",
    then: Joi.string().trim().required().messages({
      "string.empty": "Register Number is required.",
      "any.required": "Register Number is required.",
    }),
    otherwise: Joi.string().allow(null, "").optional(),
  }),
});

// ─── LMS Login Validator ───────────────────────────────────────────────────
const lmsLoginSchema = Joi.object({
  USER_TYPE: Joi.string()
    .trim()
    .uppercase()
    .valid("TECHNO", "SCHOOL", "TEACHER", "STUDENT")
    .optional()
    .messages({
      "any.only": "USER_TYPE must be TECHNO, SCHOOL, TEACHER or STUDENT.",
    }),

  USERNAME: Joi.string().trim().allow("", null).optional(),
  USER_NAME: Joi.string().trim().allow("", null).optional(),
  PASSWORD: Joi.string().trim().allow("", null).optional(),
  STUDENT_NAME: Joi.string().trim().allow("", null).optional(),
  CLASS: Joi.string().trim().allow("", null).optional(),
  REGISTER_NUMBER: Joi.string().trim().allow("", null).optional(),
}).unknown(true);

module.exports = {
  loginSchema,
  lmsLoginSchema,
};
