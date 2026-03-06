const express = require("express");
const router = express.Router();
const { addLink, getLinks, upvoteLink } = require("../controllers/linkController");
const { protect } = require("../middleware/auth");

router.post("/add", protect, addLink);
router.get("/:groupId", protect, getLinks);
router.post("/upvote", protect, upvoteLink);

module.exports = router;
