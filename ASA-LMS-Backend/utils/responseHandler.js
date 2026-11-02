// Success Response
const sendSuccess = (res, message, statusCode = 200, data = null) => {
    res.status(statusCode).json({
      status: true,
      message,
      data
    });
};
  
// Error Response
const sendError = (res, message, statusCode = 500, errors = null) => {
  res.status(statusCode).json({
    status: false,
    message,
    errors
  });
};
  
module.exports = { sendSuccess, sendError };