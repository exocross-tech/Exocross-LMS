const { google } = require("googleapis");
const fs = require("fs");
const { getGoogleAuth, TOKEN_PATH } = require("./googleAuth");

const createGoogleMeet = async () => {
    try {
        if (!fs.existsSync(TOKEN_PATH)) {
            throw new Error("token.json not found. Please authorize Google first.");
        }

        const auth = await getGoogleAuth();

        const meet = google.meet({
            version: "v2",
            auth,
        });

        const response = await meet.spaces.create({
            requestBody: {},
        });

        const meeting = response.data;

        return {
            meetId: meeting.name,
            meetCode: meeting.meetingCode,
            meetLink: meeting.meetingUri,
            meetingId: meeting.name,
            meetingCode: meeting.meetingCode,
        };
    } catch (error) {
        const errorDetails = error.response?.data || error.message;
        console.error(
            "Google Meet creation error:",
            errorDetails
        );

        if (
            error.response?.data?.error === "invalid_grant" ||
            error.message?.includes("invalid_grant")
        ) {
            throw new Error(
                "Google authorization token has expired or been revoked (invalid_grant). Please re-authorize Google via /api/google/authorize."
            );
        }

        throw error;
    }
};

module.exports = {
    createGoogleMeet,
};