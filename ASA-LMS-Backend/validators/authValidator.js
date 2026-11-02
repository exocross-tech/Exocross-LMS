const Joi = require('joi');

const loginSchema = Joi.object({
    phone: Joi.string()
      .pattern(/^[0-9]{10}$/)
      .required()
      .messages({
        'string.pattern.base': 'Phone number must be exactly 10 digits and contain only numbers.',
        'any.required': 'Phone number is required.'
      }),
  
    password: Joi.string()
      .required()
      .messages({
        'any.required': 'Password is required.'
      }),
  
    path: Joi.string()
      .valid('assessment', 'e-learning')
      .required()
      .messages({
        'any.only': 'Path must be either assessment or e-learning.',
        'any.required': 'Path is required.'
      })
});

const signupSchema = Joi.object({
  phone: Joi.string()
    .pattern(/^[0-9]{10}$/)
    .required()
    .messages({
      'string.pattern.base': 'Phone number must be exactly 10 digits and contain only numbers.',
      'any.required': 'Phone number is required.'
    }),
});

const verifyOtpSchema = Joi.object({
  phone: Joi.string()
    .pattern(/^[0-9]{10}$/)
    .required()
    .messages({
      'string.pattern.base': 'Phone number must be exactly 10 digits and contain only numbers.',
      'any.required': 'Phone number is required.'
    }),

  otp: Joi.string()
    .pattern(/^[0-9]{4}$/)
    .required()
    .messages({
      'string.pattern.base': 'OTP must be exactly 4 digits and contain only numbers.',
      'any.required': 'OTP is required.'
    })
});

const createPasswordSchema = Joi.object({
  phone: Joi.string()
    .pattern(/^[0-9]{10}$/)
    .required()
    .messages({
      'string.pattern.base': 'Phone number must be exactly 10 digits and contain only numbers.',
      'any.required': 'Phone number is required.'
    }),

  password: Joi.string()
    .required()
    .messages({
      'any.required': 'Password is required.'
    }),

  confirm_password: Joi.string()
    .valid(Joi.ref('password'))
    .required()
    .messages({
      'any.only': 'Confirm password must match the password.',
      'any.required': 'Confirm password is required.'
    })
});

const switchRoleSchema = Joi.object({
  role: Joi.string()
    .required()
    .messages({
      'any.required': 'Role is required.'
    })
});

module.exports = { 
  loginSchema,
  signupSchema,
  verifyOtpSchema,
  createPasswordSchema,
  switchRoleSchema
};