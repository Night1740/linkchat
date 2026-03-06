const express = require("express");
const router = express.Router();
const { getMessages } = require("../controllers/messageController");
const { protect } = require("../middleware/auth");

router.get("/:groupId", protect, getMessages);

module.exports = router;
