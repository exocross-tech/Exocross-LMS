const fs = require("fs");
const path = require("path");
const { google } = require("googleapis");

const SCOPES = [
    "https://www.googleapis.com/auth/meetings.space.created",
];

const CREDENTIALS_PATH = path.join(
    process.cwd(),
    "credentials.json"
);

const TOKEN_PATH = path.join(
    process.cwd(),
    "token.json"
);

/**
 * Returns an authenticated Google OAuth2 Client.
 * Automatically checks and refreshes expired access tokens using the stored refresh_token.
 */
const getGoogleAuth = async () => {
    if (!fs.existsSync(CREDENTIALS_PATH)) {
        throw new Error("credentials.json not found in root directory");
    }

    const credentials = JSON.parse(
        fs.readFileSync(CREDENTIALS_PATH, "utf8")
    );

    const config = credentials.web || credentials.installed;
    if (!config) {
        throw new Error("Invalid credentials.json configuration format");
    }

    const { client_id, client_secret, redirect_uris } = config;
    const redirectUri = redirect_uris[0];

    const oauth2Client = new google.auth.OAuth2(
        client_id,
        client_secret,
        redirectUri
    );

    if (!fs.existsSync(TOKEN_PATH)) {
        return oauth2Client;
    }

    let tokens;
    try {
        tokens = JSON.parse(fs.readFileSync(TOKEN_PATH, "utf8"));
    } catch (err) {
        console.error("Error reading token.json:", err.message);
        return oauth2Client;
    }

    oauth2Client.setCredentials(tokens);

    // Save tokens automatically whenever googleapis triggers an automatic refresh
    oauth2Client.on("tokens", (newTokens) => {
        try {
            let currentTokens = {};
            if (fs.existsSync(TOKEN_PATH)) {
                currentTokens = JSON.parse(fs.readFileSync(TOKEN_PATH, "utf8"));
            }

            const updatedTokens = {
                ...currentTokens,
                ...newTokens,
            };

            // Always preserve refresh_token if not present in newTokens
            if (!newTokens.refresh_token && currentTokens.refresh_token) {
                updatedTokens.refresh_token = currentTokens.refresh_token;
            }

            fs.writeFileSync(
                TOKEN_PATH,
                JSON.stringify(updatedTokens, null, 2)
            );
            console.log("Google OAuth tokens refreshed and saved to token.json");
        } catch (error) {
            console.error("Failed to save refreshed Google tokens:", error.message);
        }
    });

    // Proactively refresh access token if expired or about to expire (5 min buffer)
    const bufferMs = 5 * 60 * 1000;
    const isExpiring = tokens.expiry_date
        ? Date.now() >= (tokens.expiry_date - bufferMs)
        : true;

    if (isExpiring && tokens.refresh_token) {
        try {
            console.log("Access token is expired or expiring soon. Refreshing automatically...");
            const { credentials: refreshedTokens } = await oauth2Client.refreshAccessToken();

            const updatedTokens = {
                ...tokens,
                ...refreshedTokens,
            };

            if (!refreshedTokens.refresh_token && tokens.refresh_token) {
                updatedTokens.refresh_token = tokens.refresh_token;
            }

            fs.writeFileSync(
                TOKEN_PATH,
                JSON.stringify(updatedTokens, null, 2)
            );

            oauth2Client.setCredentials(updatedTokens);
            console.log("Google Access Token refreshed successfully.");
        } catch (refreshErr) {
            console.error("Failed to auto-refresh Google access token:", refreshErr.message);
            const isInvalidGrant =
                refreshErr.message?.includes("invalid_grant") ||
                refreshErr.response?.data?.error === "invalid_grant";

            if (isInvalidGrant) {
                throw new Error(
                    "Google authorization token has expired or been revoked (invalid_grant). Please re-authorize Google by visiting /api/google/authorize in your browser."
                );
            }
            throw refreshErr;
        }
    }

    return oauth2Client;
};

module.exports = {
    getGoogleAuth,
    SCOPES,
    TOKEN_PATH,
    CREDENTIALS_PATH,
};