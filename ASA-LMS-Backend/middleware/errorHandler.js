const { sendError } = require('../utils/responseHandler');

const notFound = (req, res, next) => {
    // ✅ ALLOW STATIC FILES (SCORM, images, assets)
    if (
        req.path.startsWith('/uploads') ||
        req.path.startsWith('/ckeditor-upload-images')
    ) {
        return next();
    }

    // ❌ API only
    sendError(res, 'API route not found', 404);
};

const errorHandler = (err, req, res, next) => {
    console.error(err);

    sendError(
        res,
        'Something went wrong, please try again later',
        err.status || 500,
        err.message
    );
};

module.exports = { notFound, errorHandler };