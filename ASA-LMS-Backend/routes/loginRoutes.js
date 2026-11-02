const express = require('express');
const router = express.Router();
const lmsLoginController = require('../controllers/loginController');

// LMS Login
router.post('/login', lmsLoginController.login);
router.post('/log-activity', lmsLoginController.logActivity);

module.exports = router;
