const express = require("express");

const {
    authorizeGoogle,
    googleCallback,
} = require("../controllers/googleAuthController");

const router = express.Router();

router.get(
    ["/authorize", "/auth", "/"],
    authorizeGoogle
);

router.get(
    "/callback",
    googleCallback
);

module.exports = router;