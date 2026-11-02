const mongoose = require('mongoose');
const { Schema } = mongoose;

const userSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      trim: true,
      default: null,
      set: v => v === '' ? null : v
    },
    password: {
      type: String,
      default: null
    },
    phone: {
      type: String,
      equired: true,
      trim: true
    },
    user_type: {
      type: String,
      enum: ['individual', 'organization'],
      required: true
    },
    roles: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Role'
      }
    ],
    primary_role: {
      type: Schema.Types.ObjectId,
      ref: 'Role'
    },
    organization: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      default: null,
      set: v => v === '' ? null : v
    },
    other_info: {
      type: String,
      trim: true,
      default: null
    },
    otp: {
      type: String,
      trim: true,
      default: null
    },
    otp_expiry: {
      type: Date,
      default: null,
      set: v => v === '' ? null : v
    },
    is_verified: {
      type: Boolean,
      default: false
    },
    created_at: {
      type: Date,
      default: Date.now
    },
    updated_at: {
      type: Date,
      default: Date.now
    },
    deleted_at: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    versionKey: false
  }
);

userSchema.pre(/^find/, function(next) {
  this.where({ deleted_at: null });
  next();
});

const User = mongoose.model('User', userSchema);
module.exports = User;
