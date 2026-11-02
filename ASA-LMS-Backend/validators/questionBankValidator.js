const Joi = require("joi");

const ALLOWED_MODULE_CODES = ["M1", "M2", "M3", "M4", "M5", "M6", "M7", "M8"];

const createSchema = Joi.object({
  MODULE_NAME: Joi.string().allow(null, "").optional(),
  BOOK_ID: Joi.number().allow(null).optional(),
  CHAPTER: Joi.string().allow(null, "").optional(),
  QUESTION_TYPE: Joi.string().allow(null, "").optional(),
  MARK: Joi.number().allow(null).optional(),
  DIFFICULTY_LEVEL: Joi.string()
    .trim()
    .valid(...ALLOWED_MODULE_CODES)
    .required()
    .messages({
      "any.only": "Module must be one of: M1, M2, M3, M4, M5, M6, M7, M8",
      "any.required": "Module is required",
    }),
  QUESTION: Joi.string().allow(null, "").optional(),
  IS_CASE_SENSITIVE: Joi.boolean().allow(null).optional(),
  FILLBLANK_ANSWER: Joi.string().allow(null, "").optional(),
  OPTION_A: Joi.string().allow(null, "").optional(),
  OPTION_B: Joi.string().allow(null, "").optional(),
  OPTION_C: Joi.string().allow(null, "").optional(),
  OPTION_D: Joi.string().allow(null, "").optional(),
  LEFT_ITEMS: Joi.any().optional(),
  RIGHT_ITEMS: Joi.any().optional(),
  CORRECT_MATCHES: Joi.any().optional(),
  SEQUENCE_ANSWER: Joi.any().optional(),
  ESSAY_ANSWER: Joi.string().allow(null, "").optional(),
  CORRECT_ANSWER: Joi.string().allow(null, "").optional(),
  MULTIPLE_RESPONSE_OPTIONS: Joi.any().optional(),
  MULTIPLE_RESPONSE_ANSWER: Joi.any().optional(),
  LABELLING_ANSWER: Joi.string().allow(null, "").optional(),
  USER_ID: Joi.number().allow(null).optional(),
}).unknown(true);

const updateSchema = Joi.object({
  ID: Joi.number().optional(),
  MODULE_NAME: Joi.string().allow(null, "").optional(),
  BOOK_ID: Joi.number().allow(null).optional(),
  CHAPTER: Joi.string().allow(null, "").optional(),
  QUESTION_TYPE: Joi.string().allow(null, "").optional(),
  MARK: Joi.number().allow(null).optional(),
  DIFFICULTY_LEVEL: Joi.string()
    .trim()
    .valid(...ALLOWED_MODULE_CODES)
    .optional()
    .messages({
      "any.only": "Module must be one of: M1, M2, M3, M4, M5, M6, M7, M8",
    }),
  QUESTION: Joi.string().allow(null, "").optional(),
  IS_CASE_SENSITIVE: Joi.boolean().allow(null).optional(),
  FILLBLANK_ANSWER: Joi.string().allow(null, "").optional(),
  OPTION_A: Joi.string().allow(null, "").optional(),
  OPTION_B: Joi.string().allow(null, "").optional(),
  OPTION_C: Joi.string().allow(null, "").optional(),
  OPTION_D: Joi.string().allow(null, "").optional(),
  LEFT_ITEMS: Joi.any().optional(),
  RIGHT_ITEMS: Joi.any().optional(),
  CORRECT_MATCHES: Joi.any().optional(),
  SEQUENCE_ANSWER: Joi.any().optional(),
  ESSAY_ANSWER: Joi.string().allow(null, "").optional(),
  CORRECT_ANSWER: Joi.string().allow(null, "").optional(),
  MULTIPLE_RESPONSE_OPTIONS: Joi.any().optional(),
  MULTIPLE_RESPONSE_ANSWER: Joi.any().optional(),
  LABELLING_ANSWER: Joi.string().allow(null, "").optional(),
  USER_ID: Joi.number().allow(null).optional(),
}).unknown(true);

module.exports = {
  ALLOWED_MODULE_CODES,
  createSchema,
  updateSchema,
};
