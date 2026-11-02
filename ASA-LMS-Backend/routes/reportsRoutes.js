const express = require('express');
const router = express.Router();
const reportsController = require('../controllers/Reports/reportsController');

router.post('/userListBySchool', reportsController.userListBySchool);
router.post('/studentEngagement', reportsController.studentEngagement);
router.post('/teacherEngagement', reportsController.teacherEngagement);
router.post('/contentUsage', reportsController.contentUsage);
router.post('/ebookUsage', reportsController.ebookUsage);
router.post('/cbtUsage', reportsController.cbtUsage);
router.post('/teachingGuideUsage', reportsController.teachingGuideUsage);
router.post('/classWiseLmsUsage', reportsController.classWiseLmsUsage);
router.post('/lowEngagementStudents', reportsController.lowEngagementStudents);
router.post('/loginHistoryReport', reportsController.loginHistoryReport);
router.post('/contentAccessLog', reportsController.contentAccessLog);
router.post('/schoolAdoptionReport', reportsController.schoolAdoptionReport);
router.post('/classAdoptionReport', reportsController.classAdoptionReport);
router.post('/contentUsageReport', reportsController.contentUsageSummary);
router.post('/studentLearningDepth', reportsController.studentLearningDepthReport);
router.post('/engagementTrends', reportsController.engagementTrends);
router.post('/loginFrequencyReport', reportsController.loginFrequencyReport);
router.post('/schoolPerformanceReport', reportsController.schoolPerformanceReport);
router.post('/licenseUtilizationReport', reportsController.licenseUtilizationReport);

module.exports = router;
