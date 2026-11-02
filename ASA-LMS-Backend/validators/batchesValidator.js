const Joi = require("joi");

const createSchema = Joi.object({
  BATCH_CODE: Joi.string().trim().max(100).required().messages({
    "string.empty": "Batch Code is required.",
    "any.required": "Batch Code is required.",
  }),
  BATCH_NAME: Joi.string().trim().max(250).allow(null, "").optional(),
  START_DATE: Joi.date().allow(null, "").optional(),
  END_DATE: Joi.date().allow(null, "").optional(),
  IS_ACTIVE: Joi.boolean().optional(),
  CREATED_BY: Joi.number().allow(null).optional(),
  USER_ID: Joi.number().allow(null).optional(),
});

const updateSchema = Joi.object({
  ID: Joi.number().optional(),
  BATCH_CODE: Joi.string().trim().max(100).required().messages({
    "string.empty": "Batch Code is required.",
    "any.required": "Batch Code is required.",
  }),
  BATCH_NAME: Joi.string().trim().max(250).allow(null, "").optional(),
  START_DATE: Joi.date().allow(null, "").optional(),
  END_DATE: Joi.date().allow(null, "").optional(),
  IS_ACTIVE: Joi.boolean().optional(),
  UPDATED_BY: Joi.number().allow(null).optional(),
  USER_ID: Joi.number().allow(null).optional(),
});

module.exports = {
  createSchema,
  updateSchema,
};
