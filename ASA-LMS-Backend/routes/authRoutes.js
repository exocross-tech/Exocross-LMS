const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const authMiddleware = require('../middleware/authMiddleware');
const { 
    login, 
    signup,
    getOtp,
    verifyOtp,
    createPassword,
    forgotPassword,
    logout, 
    sidebar,
    switchRole,
    resendOtp,
    truncateDatabase
} = require('../controllers/authController');

const router = express.Router();

const openRoutes = [
    { method: 'post', path: '/login', handler: login },
    { method: 'post', path: '/signup', handler: signup },
    { method: 'post', path: '/resend-otp', handler: resendOtp },
    { method: 'post', path: '/get-otp', handler: getOtp },
    { method: 'post', path: '/verify-otp', handler: verifyOtp },
    { method: 'post', path: '/create-password', handler: createPassword },
    { method: 'post', path: '/forgot-password', handler: forgotPassword },
    { method: 'get', path: '/truncate-database', handler: truncateDatabase }
];

const protectedRoutes = [
    { method: 'get', path: '/logout', handler: logout },
    { method: 'get', path: '/side-bar', handler: sidebar },
    { method: 'post', path: '/switch-role', handler: switchRole }
];

openRoutes.forEach(route => {
    router[route.method](route.path, asyncHandler(route.handler));
});

protectedRoutes.forEach(route => {
    router[route.method](route.path, authMiddleware, asyncHandler(route.handler));
});

module.exports = router;