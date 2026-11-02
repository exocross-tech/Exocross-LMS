const express = require("express");

const {
  getStudentAllocations,
  getStudentAllocationBatches,
  assignStudentsToBatch,
} = require("../controllers/studentAllocationController");


const router = express.Router();

router.get("/", getStudentAllocations);

router.get("/batches", getStudentAllocationBatches);

router.post("/assign", assignStudentsToBatch);

module.exports = router;