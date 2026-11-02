const express = require("express");
const router = express.Router();
const { getDashboardData } = require("../controllers/dashboardController");

// Get dashboard data counts
router.get("/getDashboardData", getDashboardData);
module.exports = router;

