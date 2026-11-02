const { createGoogleMeet } = require("../utils/googleMeet");

const createMeet = async (req, res) => {
    try {
        const meeting = await createGoogleMeet();

        return res.json({
            status: 1,
            message: "Google Meet created successfully",
            data: meeting,
        });
    } catch (err) {
        console.error("createMeet error:", err);

        return res.status(500).json({
            status: 0,
            message: err.message,
            error: err.response?.data || null,
        });
    }
};

module.exports = {
    createMeet,
};