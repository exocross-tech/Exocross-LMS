const express = require("express");
const router = express.Router();

const {
    createMeet,
} = require("../controllers/googleMeetController");

router.post("/create", createMeet);

module.exports = router;