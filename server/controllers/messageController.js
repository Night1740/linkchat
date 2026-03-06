const Message = require("../models/Message");
const Group = require("../models/Group");

// GET /api/messages/:groupId
const getMessages = async (req, res) => {
  try {
    const { groupId } = req.params;

    // Check group membership
    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ message: "Group not found" });

    if (!group.members.includes(req.user._id)) {
      return res.status(403).json({ message: "You are not a member of this group" });
    }

    // FIX: Get last 200 messages, sorted oldest-first for display
    const messages = await Message.find({ groupId })
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();

    // Reverse so oldest appears at top of chat window
    messages.reverse();

    res.json(messages);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getMessages };