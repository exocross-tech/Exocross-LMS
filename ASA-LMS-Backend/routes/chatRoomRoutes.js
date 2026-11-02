const express = require("express");
const router = express.Router();
const { getChatRoom, getChatRoomBatches, sendMessage } = require('../controllers/chatRoomController');

router.get("/rooms/:roomId", getChatRoom);
router.get("/getChatRoomBatches", getChatRoomBatches);
router.post("/messages", sendMessage);
router.post("/rooms/:roomId/messages", sendMessage);
router.post("/send-message", sendMessage);

module.exports = router;


