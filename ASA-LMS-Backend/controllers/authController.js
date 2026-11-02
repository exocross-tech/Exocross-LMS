const User = require('../models/user');
const Role = require('../models/role');
const mongoose = require('mongoose');

const { loginSchema, signupSchema, verifyOtpSchema, createPasswordSchema, switchRoleSchema } = require('../validators/authValidator');
const { sendSuccess, sendError } = require('../utils/responseHandler');
const { generateToken } = require('../config/token');
const { comparePassword } = require('../utils/passwordUtils');
const { addToBlacklist } = require('../utils/tokenBlacklist');
const { sidebarData, generateOTP, getRedirectUrl, sendOtp } = require('../services/commonService');
const { hashPassword } = require('../utils/passwordUtils');

const login = async (req, res) => {
    const { error } = loginSchema.validate(req.body);
    if (error) {
        return sendError(res, error.details[0].message, 400);
    }
    const { phone, password, path } = req.body;

    const user = await User.findOne({ phone })
        .select('-otp -created_at -updated_at -deleted_at')
        .populate('roles', 'name slug')
        .populate('primary_role', 'name slug')
        .lean();

    if (!user) {
      return sendError(res, 'Invalid phone number or password', 400);
    }

    if(!user.is_verified){
        return sendError(res, 'Please sign up and create a password', 400);
    }

    const isMatch = await comparePassword(password, user.password);
    if (!isMatch) {
      return sendError(res, 'Invalid phone number or password', 400);
    }

    user.login_type = path;
    user.current_role = user.primary_role;
    delete user.password; 

    const token = generateToken(user);
    user.token = token;
    const role = await Role.findOne({ _id: user.current_role._id })
        .select('name slug')
        .populate({
            path: 'privileges',
            select: 'name slug',
            options: { sort: { _id: 1 } }
        })
        .lean();
    user.redirect_url = getRedirectUrl(role.slug, role.privileges[0].slug);

    sendSuccess(res, 'Login successfully', 200, user);
}

const switchRole = async (req, res) => {
    const { error } = switchRoleSchema.validate(req.body);
    if (error) {
        return sendError(res, error.details[0].message, 400);
    }

    const currentToken = req.headers.authorization?.split(' ')[1];
    if (!currentToken) {
        return sendError(res, 'No token provided', 401);
    }

    const { role } = req.body;
    const userData = req.user;
    const user = await User.findOne({ _id: userData._id })
        .select('-otp -created_at -updated_at -deleted_at')
        .populate('roles', 'name slug')
        .populate('primary_role', 'name slug')
        .lean();

    const hasRole = user.roles.find(r => r._id.toString() === role);
    if (!hasRole) {
        return sendError(res, 'Invalid role', 400);
    }

    user.login_type = userData.login_type;
    user.current_role = hasRole;
    delete user.password; 

    await addToBlacklist(currentToken);
    const token = generateToken(user);
    user.token = token;
    const currentRole = await Role.findOne({ _id: user.current_role._id })
        .select('name slug')
        .populate({
            path: 'privileges',
            select: 'name slug',
            options: { sort: { _id: 1 } }
        })
        .lean();
    user.redirect_url = getRedirectUrl(currentRole.slug, currentRole.privileges[0].slug);

    sendSuccess(res, 'Role switched successfully', 200, user);
}

const signup = async (req, res) => {
    const { error } = signupSchema.validate(req.body);
    if (error) {
        return sendError(res, error.details[0].message, 400);
    }

    const { phone } = req.body;

    const user = await User.findOne({ phone })
        .select('-created_at -updated_at -deleted_at')
        .lean();

    if (!user) {
      return sendError(res, 'Phone number not found. Please contact the admin.', 400);
    }

    if(user.is_verified){
        return sendError(res, 'Already signed up. Please login', 400);
    }

    const otp = generateOTP();
    await sendOtp(phone, otp, 'signup', user._id);
    await User.updateOne({ _id: user._id }, {otp, otp_expiry: new Date(Date.now() + 10 * 60 * 1000)});

    sendSuccess(res, 'OTP has been sent successfully', 200, {phone});
}

const resendOtp = async (req, res) => {
    const { error } = signupSchema.validate(req.body);
    if (error) {
        return sendError(res, error.details[0].message, 400);
    }
    const { phone } = req.body;

    const user = await User.findOne({ phone })
        .select('-created_at -updated_at -deleted_at')
        .lean();

    if (!user) {
      return sendError(res, 'Phone number not found. Please contact the admin.', 400);
    }
    const otp = generateOTP();
    await sendOtp(phone, otp, 'resend', user._id);
    await User.updateOne({ _id: user._id }, {otp, otp_expiry: new Date(Date.now() + 10 * 60 * 1000)});

    sendSuccess(res, 'OTP has been sent successfully', 200, {phone});
}

const forgotPassword = async (req, res) => {
    const { error } = signupSchema.validate(req.body);
    if (error) {
        return sendError(res, error.details[0].message, 400);
    }

    const { phone } = req.body;

    const user = await User.findOne({ phone })
        .select('-created_at -updated_at -deleted_at')
        .lean();

    if (!user) {
      return sendError(res, 'Phone number not found. Please contact the admin.', 400);
    }

    if(!user.is_verified){
        return sendError(res, 'Please sign up and create a password', 400);
    }

    const otp = generateOTP();
    await sendOtp(phone, otp, 'forgot', user._id);
    await User.updateOne({ _id: user._id }, {otp, otp_expiry: new Date(Date.now() + 10 * 60 * 1000)});

    sendSuccess(res, 'OTP has been sent successfully', 200, {phone});
}

const getOtp = async (req, res) => {
    const { error } = signupSchema.validate(req.body);
    if (error) {
        return sendError(res, error.details[0].message, 400);
    }

    const { phone } = req.body;

    const user = await User.findOne({ phone })
        .select('-created_at -updated_at -deleted_at')
        .lean();

    sendSuccess(res, 'Fetch OTP successfully', 200, { phone, otp: user.otp });
}

const verifyOtp = async (req, res) => {
    const { error } = verifyOtpSchema.validate(req.body);
    if (error) {
        return sendError(res, error.details[0].message, 400);
    }

    const { phone, otp } = req.body;

    const user = await User.findOne({ phone })
        .select('-created_at -updated_at -deleted_at')
        .lean();

    if(!user.otp_expiry || user.otp_expiry < new Date()){
        await User.updateOne({ _id: user._id }, {otp: null, otp_expiry: null});
        return sendError(res, 'OTP expired', 400);
    }

    if(user.otp !== otp){
        return sendError(res, 'Incorrect Verification Code!', 400);
    }

    await User.updateOne({ _id: user._id }, {otp: null, otp_expiry: null});
    sendSuccess(res, 'OTP verified successfully', 200, {phone});
}

const createPassword = async (req, res) => {
    const { error } = createPasswordSchema.validate(req.body);
    if (error) {
        return sendError(res, error.details[0].message, 400);
    }

    const { phone, password } = req.body;

    const user = await User.findOne({ phone })
        .select('-created_at -updated_at -deleted_at')
        .lean();

    const hashedPassword = await hashPassword(password);
    await User.updateOne({ _id: user._id }, {password: hashedPassword, is_verified: true});
    sendSuccess(res, 'Password updated successfully', 200);
}

const logout = async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
        return sendError(res, 'No token provided.', 401);
    }

    await addToBlacklist(token); 
    sendSuccess(res, 'Logout successful', 200);
};

const sidebar = async (req, res) => {
    const user = req.user;
    const currentRoleId = user?.current_role?._id;
    if (!currentRoleId) {
        return sendError(res, 'Something went wrong', 400);
    }
    const role = await Role.findById(currentRoleId)
        .populate({
            path: 'privileges',
            select: 'name slug',
            options: { sort: { _id: 1 } }
        })
        .lean();
    
    const sidebarContent = await sidebarData(role);
    sendSuccess(res, 'Fetch Sidebar successful', 200, sidebarContent);
}

const truncateDatabase = async (req, res) => {
    const collections = Object.keys(mongoose.connection.collections);
    const excludedCollections = ['roles', 'privileges'];
    for (const collectionName of collections) {
        if (!excludedCollections.includes(collectionName)) {
            const collection = mongoose.connection.collections[collectionName];
            await collection.deleteMany();
        }
    }
    sendSuccess(res, 'Database truncated successfully', 200);
}

module.exports = { 
    login, 
    logout, 
    sidebar,
    signup,
    getOtp,
    verifyOtp,
    createPassword,
    forgotPassword,
    switchRole,
    resendOtp,
    truncateDatabase
};