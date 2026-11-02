const User = require('../models/user');
const jwt = require('jsonwebtoken');
const { isBlacklisted, addToBlacklist } = require('../utils/tokenBlacklist');
const { sendError } = require('../utils/responseHandler');

const authMiddleware = async (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
        return sendError(res, 'Access denied. No token provided.', 403);
    }

    if (isBlacklisted(token)) {
        return sendError(res, 'Unauthorized. Token has been invalidated.', 403);
    }

    try {
        const decoded = jwt.verify(token.replace('Bearer ', ''), process.env.JWT_SECRET);
        
        const user = await User.findById(decoded._id).select('-password');
        if(!user || user.deleted_at){
            await addToBlacklist(token); 
            return sendError(res, 'Invalid or expired token', 403);
        }
        const decodedRoles = decoded.roles.map(role => role._id.toString());
        const userRoles = user.roles.map(role => role.toString());
        const areSameRoles =
        decodedRoles.length === userRoles.length &&
        decodedRoles.every(roleId => userRoles.includes(roleId)) &&
        userRoles.every(roleId => decodedRoles.includes(roleId));
        
        if(!areSameRoles){
            await addToBlacklist(token); 
            return sendError(res, 'Access denied. Unauthorized role.', 403);
        }

        req.user = decoded;
        next();
    } catch (err) {
        return sendError(res, 'Invalid or expired token', 403);
    }
};

module.exports = authMiddleware;

