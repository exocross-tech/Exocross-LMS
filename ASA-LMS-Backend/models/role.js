const mongoose = require('mongoose');
const { Schema } = mongoose;

const roleSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true
    },
    slug: {
      type: String,
      required: true,
      trim: true,
      unique: true
    },
    priority: {
      type: Number,
      required: true,
      default: 999
    },
    privileges: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Privilege'
      }
    ],
    is_edit: {
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

roleSchema.pre(/^find/, function(next) {
  this.where({ deleted_at: null });
  next();
});

const Role = mongoose.model('Role', roleSchema);
module.exports = Role;
