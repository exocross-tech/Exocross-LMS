const jwt = require('jsonwebtoken');

const generateToken = (user) => {
    const payload = user;
    const secret = process.env.JWT_SECRET;
    // const options = { expiresIn: '8h' };
  
    // return jwt.sign(payload, secret, options);
    return jwt.sign(payload, secret);
};

module.exports = { generateToken };