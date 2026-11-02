const mongoose = require('mongoose');
const { Schema } = mongoose;

const groupSchema = new Schema({
    name: {
        type: String,
        required: true
    },
    type: {
        type: String,
        enum: ['lesson', 'content']
    },
    active: {
        type: Boolean,
        default: true
    },
    is_data: {
        type: Boolean,
        default: false
    },
    lesson_id: {
        type: Schema.Types.ObjectId,
        ref: 'Lesson',
        default: null,
        set: v => v === '' ? null : v
    },
    content_id: {
        type: Schema.Types.ObjectId,
        ref: 'Content',
        default: null,
        set: v => v === '' ? null : v
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
}, {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    versionKey: false
});

groupSchema.pre(/^find/, function(next) {
    this.where({ deleted_at: null });
    next();
});

const Group = mongoose.model('Group', groupSchema);
module.exports = Group;