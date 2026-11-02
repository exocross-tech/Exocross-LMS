const express = require('express');
const router = express.Router();

const {
  getBatches,
  getBatchDetails,
  addBatch,
  updateBatch,
  updateBatchStatus,
  deleteBatch,
} = require('../controllers/batchController');

router.get('/', getBatches);
router.get('/:id', getBatchDetails);
router.post('/', addBatch);
router.put('/:id', updateBatch); 
router.put('/:id/status', updateBatchStatus);
router.delete('/:id', deleteBatch);

module.exports = router;