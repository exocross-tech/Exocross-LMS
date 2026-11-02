const Joi = require("joi");

const createSchema = Joi.object({
  name: Joi.string().trim().required().messages({
    "string.empty": "User name is required.",
    "any.required": "User name is required.",
  }),
  email: Joi.string().email().trim().allow('', null).optional().messages({
    'string.email': 'Please enter a valid email address',
  }),
  phone: Joi.string().trim().pattern(/^[0-9]{10}$/).required().messages({
    "string.empty": "Phone is required.",
    "any.required": "Phone is required.",
    'string.pattern.base': 'Phone number must be 10 digits'
  }),
  user_type: Joi.string().valid('individual', 'organization').trim().required().messages({
    "string.empty": "User Type is required.",
    "any.required": "User Type is required.",
    'string.valid': 'User Type must be either "individual" or "organization"',
    'any.only': 'User Type must be either individual or organization',
  }),
  roles: Joi.array().items(Joi.string()).min(1).required().messages({
    "any.required": "Roles are required.",
    'array.base': 'Roles must be provided as an array',
    'array.min': 'At least one role must be assigned',
  }),
  organization: Joi.string()
    .trim()
    .when('user_type', {
      is: 'organization',
      then: Joi.string().required().messages({
        'string.empty': 'Organization is required',
        'any.required': 'Organization is required'
      }),
      otherwise: Joi.string().allow('', null)
  }),
  other_info: Joi.string()
    .trim()
    .allow('', null)
    .messages({
      'string.base': 'Other info must be a text value'
    })
});

const updateSchema = Joi.object({
  name: Joi.string().trim().required().messages({
    "string.empty": "User name is required.",
    "any.required": "User name is required.",
  }),
  email: Joi.string().email().trim().allow('', null).optional().messages({
    'string.email': 'Please enter a valid email address',
  }),
  phone: Joi.string().trim().pattern(/^[0-9]{10}$/).required().messages({
    "string.empty": "Phone is required.",
    "any.required": "Phone is required.",
    'string.pattern.base': 'Phone number must be 10 digits'
  }),
  user_type: Joi.string().valid('individual', 'organization').trim().required().messages({
    "string.empty": "User Type is required.",
    "any.required": "User Type is required.",
    'string.valid': 'User Type must be either "individual" or "organization"',
    'any.only': 'User Type must be either individual or organization',
  }),
  roles: Joi.array().items(Joi.string()).min(1).required().messages({
    "any.required": "Roles are required.",
    'array.base': 'Roles must be provided as an array',
    'array.min': 'At least one role must be assigned',
  }),
  organization: Joi.string()
    .trim()
    .when('user_type', {
      is: 'organization',
      then: Joi.string().required().messages({
        'string.empty': 'Organization is required',
        'any.required': 'Organization is required'
      }),
      otherwise: Joi.string().allow('', null)
    }),
  other_info: Joi.string()
    .trim()
    .allow('', null)
    .messages({
      'string.base': 'Other info must be a text value'
    })
});

const filterSchema = Joi.object({
  organization: Joi.string().trim().required().messages({
    'string.empty': 'Organization is required',
    'any.required': 'Organization is required'
  }),
  slug: Joi.string().valid('learner', 'facilitator').trim().required().messages({
    'string.empty': 'Slug is required',
    'any.required': 'Slug is required',
    'any.only': 'Slug must be either learner or facilitator'
  }),
  search: Joi.string()
    .trim()
    .allow('', null)
    .messages({
      'string.base': 'Search must be a text value'
    }),
  page: Joi.number()
    .integer()
    .min(1)
    .optional()
    .messages({
        'number.base': 'Page must be a number',
        'number.integer': 'Page must be an integer',
        'number.min': 'Page must be at least 1'
    }),
  limit: Joi.number()
    .integer()
    .min(1)
    .optional()
    .messages({
        'number.base': 'Page must be a number',
        'number.integer': 'Page must be an integer',
        'number.min': 'Page must be at least 1'
    })
});

module.exports = {
  createSchema,
  updateSchema,
  filterSchema
};
