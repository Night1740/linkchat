const Link = require("../models/Link");
const Group = require("../models/Group");

const checkMembership = async (groupId, userId) => {
  const group = await Group.findById(groupId);
  if (!group) return { error: "Group not found", status: 404 };
  if (!group.members.map(String).includes(String(userId))) {
    return { error: "You are not a member of this group", status: 403 };
  }
  return { ok: true };
};

// POST /api/links/add
const addLink = async (req, res) => {
  try {
    const { groupId, title, url, description, tags } = req.body;
    if (!groupId || !title || !url) {
      return res.status(400).json({ message: "groupId, title, and url are required" });
    }

    const check = await checkMembership(groupId, req.user._id);
    if (check.error) return res.status(check.status).json({ message: check.error });

    const link = await Link.create({
      groupId,
      title,
      url,
      description: description || "",
      tags: tags || [],
      addedBy: req.user._id,
      addedByName: req.user.username,
    });

    res.status(201).json(link);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET /api/links/:groupId
const getLinks = async (req, res) => {
  try {
    const { groupId } = req.params;

    const check = await checkMembership(groupId, req.user._id);
    if (check.error) return res.status(check.status).json({ message: check.error });

    const links = await Link.find({ groupId }).sort({ votes: -1, createdAt: -1 });
    res.json(links);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// POST /api/links/upvote
const upvoteLink = async (req, res) => {
  try {
    const { linkId } = req.body;
    if (!linkId) return res.status(400).json({ message: "linkId is required" });

    const link = await Link.findById(linkId);
    if (!link) return res.status(404).json({ message: "Link not found" });

    const check = await checkMembership(link.groupId, req.user._id);
    if (check.error) return res.status(check.status).json({ message: check.error });

    const alreadyVoted = link.votedBy.map(String).includes(String(req.user._id));
    if (alreadyVoted) {
      // Toggle off
      link.votedBy = link.votedBy.filter((id) => String(id) !== String(req.user._id));
      link.votes = Math.max(0, link.votes - 1);
    } else {
      link.votedBy.push(req.user._id);
      link.votes += 1;
    }

    await link.save();
    res.json(link);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { addLink, getLinks, upvoteLink };
