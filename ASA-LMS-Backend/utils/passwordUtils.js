const bcrypt = require('bcrypt');

const hashPassword = async (plainPassword) => {
    const saltRounds = await bcrypt.genSalt(Number(process.env.BCRYPT_SALT_ROUNDS));
    return await bcrypt.hash(plainPassword, saltRounds);
};

const comparePassword = async (plainPassword, hashedPassword) => {
    return await bcrypt.compare(plainPassword, hashedPassword);
};

module.exports = { hashPassword, comparePassword };