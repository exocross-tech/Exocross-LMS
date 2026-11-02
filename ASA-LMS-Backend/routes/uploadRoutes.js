const express = require('express');
const router = express.Router();
const uploadController = require('../controllers/Masters/upload');
const uploadChunk = require('../middleware/chunkUpload');

router.post('/start', uploadController.startUpload);
router.post(
    '/chunk',
    uploadChunk.single("chunk"),
    uploadController.uploadChunk
);
router.get("/resume/:sessionId", uploadController.resumeUpload);
router.post("/complete", uploadController.completeUpload);
router.post('/cancel', uploadController.cancelUpload);

module.exports = router;
