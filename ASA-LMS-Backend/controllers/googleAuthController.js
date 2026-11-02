const fs = require("fs");
const { google } = require("googleapis");

const {
    getGoogleAuth,
    SCOPES,
    TOKEN_PATH,
} = require("../utils/googleAuth");

const authorizeGoogle = async (req, res) => {
    try {
        const auth = await getGoogleAuth();

        const authUrl = auth.generateAuthUrl({
            access_type: "offline",
            prompt: "consent",
            scope: SCOPES,
        });

        res.json({
            status: 1,
            authUrl,
        });

    } catch (err) {
        console.error(
            "Google authorization error:",
            err
        );

        res.status(500).json({
            status: 0,
            message: err.message,
        });
    }
};


const googleCallback = async (req, res) => {
    try {
        const { code } = req.query;

        if (!code) {
            return res.status(400).send(
                "Authorization code is missing"
            );
        }

        const auth = await getGoogleAuth();

        const { tokens } =
            await auth.getToken(code);

        let existingTokens = {};
        if (fs.existsSync(TOKEN_PATH)) {
            try {
                existingTokens = JSON.parse(
                    fs.readFileSync(TOKEN_PATH, "utf8")
                );
            } catch (e) {}
        }

        const updatedTokens = {
            ...existingTokens,
            ...tokens,
        };

        if (!tokens.refresh_token && existingTokens.refresh_token) {
            updatedTokens.refresh_token = existingTokens.refresh_token;
        }

        fs.writeFileSync(
            TOKEN_PATH,
            JSON.stringify(updatedTokens, null, 2)
        );

        res.send(`
      <html>
        <body>
          <h2>Google authorization successful!</h2>
          <p>You can close this window.</p>
        </body>
      </html>
    `);

    } catch (err) {
        console.error(
            "Google callback error:",
            err
        );

        res.status(500).send(
            `Google authorization failed: ${err.message}`
        );
    }
};

module.exports = {
    authorizeGoogle,
    googleCallback,
};