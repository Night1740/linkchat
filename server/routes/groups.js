const express = require("express");
const router = express.Router();
const { createGroup, joinGroup, getUserGroups } = require("../controllers/groupController");
const { protect } = require("../middleware/auth");

router.post("/create", protect, createGroup);
router.post("/join", protect, joinGroup);
router.get("/user", protect, getUserGroups);

module.exports = router;
