/* =============================================
   LinkChat Extension — popup.js  (patched)
   ============================================= */

const API = "https://linkchat-qcp5.onrender.com/api";
const SOCKET_URL = "https://linkchat-qcp5.onrender.com";

let socket = null;
let currentUser = null;
let currentToken = null;
let currentGroup = null;
let groups = [];

// Tracks whether the socket has fully connected yet
let socketReady = false;
// Queue for messages sent before the socket is ready
let pendingMessages = [];

// ─── DOM HELPERS ─────────────────────────────
const $ = (id) => document.getElementById(id);
const show = (el) => el && el.classList.remove("hidden");
const hide = (el) => el && el.classList.add("hidden");

function showScreen(name) {
  document.querySelectorAll(".screen").forEach((s) => s.classList.remove("active"));
  const s = $(name + "-screen");
  if (s) s.classList.add("active");
}

function showError(id, msg) {
  const el = $(id);
  if (!el) return;
  el.textContent = msg;
  show(el);
  setTimeout(() => hide(el), 4000);
}

function formatTime(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// ─── STORAGE HELPERS ────────────────────────
function saveAuth(token, user) {
  chrome.storage.local.set({ lc_token: token, lc_user: JSON.stringify(user) });
}
function clearAuth() {
  chrome.storage.local.remove(["lc_token", "lc_user"]);
}
function loadAuth(cb) {
  chrome.storage.local.get(["lc_token", "lc_user"], (data) => {
    if (data.lc_token && data.lc_user) {
      try { cb(data.lc_token, JSON.parse(data.lc_user)); }
      catch { cb(null, null); }
    } else { cb(null, null); }
  });
}

// ─── API HELPERS ─────────────────────────────
async function api(path, method = "GET", body = null, token = null) {
  const opts = {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(API + path, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Request failed");
  return data;
}

// ─── SOCKET ──────────────────────────────────
function connectSocket(token) {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
  socketReady = false;
  pendingMessages = [];

  // FIX: Do NOT lock to websocket-only — Socket.IO needs polling for the
  // initial handshake, especially inside a Chrome extension sandbox.
  socket = io(SOCKET_URL, {
    auth: { token },
    transports: ["polling", "websocket"],
    reconnectionAttempts: 5,
    timeout: 10000,
  });

  socket.on("connect", () => {
    console.log("Socket connected:", socket.id);
    socketReady = true;
    // Drain any messages queued before connection was ready
    pendingMessages.forEach(({ groupId, message }) => {
      socket.emit("sendMessage", { groupId, message });
    });
    pendingMessages = [];
    // Re-join current group room after reconnect
    if (currentGroup) {
      socket.emit("joinGroup", { groupId: currentGroup._id, username: currentUser.username });
    }
  });

  socket.on("connect_error", (err) => {
    console.error("Socket connection error:", err.message);
    socketReady = false;
  });

  socket.on("disconnect", (reason) => {
    console.warn("Socket disconnected:", reason);
    socketReady = false;
  });

  socket.on("receiveMessage", (msg) => {
    // Only render if the message belongs to the currently open group
    if (currentGroup && String(msg.groupId) === String(currentGroup._id)) {
      appendMessage(msg);
      const container = $("messages-container");
      if (container) container.scrollTop = container.scrollHeight;
    }
  });

  socket.on("error", (err) => {
    console.error("Socket server error:", err.message);
  });
}

// ─── AUTH ─────────────────────────────────────
async function doLogin() {
  const email = $("login-email").value.trim();
  const password = $("login-password").value;
  if (!email || !password) return showError("login-error", "Please fill in all fields");

  try {
    const data = await api("/auth/login", "POST", { email, password });
    onAuthSuccess(data.token, { _id: data._id, username: data.username, email: data.email });
  } catch (e) {
    showError("login-error", e.message);
  }
}

async function doRegister() {
  const username = $("reg-username").value.trim();
  const email = $("reg-email").value.trim();
  const password = $("reg-password").value;
  if (!username || !email || !password) return showError("register-error", "Please fill in all fields");

  try {
    const data = await api("/auth/register", "POST", { username, email, password });
    onAuthSuccess(data.token, { _id: data._id, username: data.username, email: data.email });
  } catch (e) {
    showError("register-error", e.message);
  }
}

function onAuthSuccess(token, user) {
  currentToken = token;
  currentUser = user;
  saveAuth(token, user);
  initApp();
}

function doLogout() {
  if (socket) socket.disconnect();
  clearAuth();
  currentUser = null;
  currentToken = null;
  currentGroup = null;
  groups = [];
  showScreen("auth");
}

// ─── APP INIT ────────────────────────────────
async function initApp() {
  showScreen("app");
  $("current-user-label").textContent = "@" + currentUser.username;
  connectSocket(currentToken);
  await loadGroups();

  // FIX: Restore the last open group so chat reappears on popup reopen
  loadLastGroup((lastGroupId) => {
    if (lastGroupId) {
      const match = groups.find((g) => g._id === lastGroupId);
      if (match) selectGroup(match._id);
    }
  });
}

// ─── GROUPS ──────────────────────────────────
async function loadGroups() {
  try {
    groups = await api("/groups/user", "GET", null, currentToken);
    renderGroups();
  } catch (e) {
    console.error("Failed to load groups:", e.message);
  }
}

function renderGroups() {
  const list = $("groups-list");
  if (!groups.length) {
    list.innerHTML = '<div class="empty-groups">No groups yet.<br/>Create or join one!</div>';
    return;
  }
  list.innerHTML = groups
    .map(
      (g) => `
    <div class="group-item${currentGroup?._id === g._id ? " active" : ""}"
         data-id="${g._id}" data-name="${escapeHtml(g.name)}" data-code="${g.inviteCode}">
      <div class="group-item-name">${escapeHtml(g.name)}</div>
      <div class="group-item-code">${g.inviteCode}</div>
    </div>`
    )
    .join("");

  list.querySelectorAll(".group-item").forEach((el) => {
    el.addEventListener("click", () => selectGroup(el.dataset.id));
  });
}

async function selectGroup(groupId) {
  const group = groups.find((g) => g._id === groupId);
  if (!group) return;

  // Leave previous socket room
  if (currentGroup && socket) {
    socket.emit("leaveGroup", { groupId: currentGroup._id });
  }

  currentGroup = group;
  saveLastGroup(group._id);  // FIX: persist so it's restored on next popup open

  // Update UI
  hide($("no-group-selected"));
  show($("group-content"));
  $("group-name-display").textContent = group.name;
  $("group-code-display").textContent = "Invite: " + group.inviteCode;

  // Mark active sidebar
  renderGroups();

  // Join socket room
  if (socket) {
    socket.emit("joinGroup", { groupId: group._id, username: currentUser.username });
  }

  // Load content
  await loadMessages(group._id);

  // Switch to chat tab
  switchTab("chat");
}

// ─── TABS ─────────────────────────────────────
function switchTab(name) {
  document.querySelectorAll(".tab").forEach((t) => {
    t.classList.toggle("active", t.dataset.tab === name);
  });
  document.querySelectorAll(".tab-panel").forEach((p) => {
    p.classList.toggle("active", p.id === "tab-" + name);
  });
  if (name === "resources" && currentGroup) loadLinks(currentGroup._id);
}

// ─── MESSAGES ────────────────────────────────
async function loadMessages(groupId) {
  const container = $("messages-container");
  container.innerHTML = '<div class="loading-msgs">Loading messages...</div>';
  try {
    const msgs = await api("/messages/" + groupId, "GET", null, currentToken);
    container.innerHTML = "";
    msgs.forEach((m) => appendMessage(m));
    container.scrollTop = container.scrollHeight;
  } catch (e) {
    container.innerHTML = '<div class="loading-msgs">Failed to load messages</div>';
  }
}

function appendMessage(msg) {
  const container = $("messages-container");
  if (!container) return;

  // Remove placeholder
  const placeholder = container.querySelector(".loading-msgs");
  if (placeholder) placeholder.remove();

  const isOwn = String(msg.senderId) === String(currentUser._id);
  const div = document.createElement("div");
  div.className = "msg" + (isOwn ? " own" : "");
  div.innerHTML = `
    <div class="msg-meta">
      ${!isOwn ? `<span class="msg-author">${escapeHtml(msg.senderName)}</span>` : ""}
      <span>${formatTime(msg.createdAt)}</span>
    </div>
    <div class="msg-bubble">${escapeHtml(msg.message)}</div>
  `;
  container.appendChild(div);
}

function sendMessage() {
  const input = $("message-input");
  const msg = input.value.trim();
  if (!msg || !currentGroup) return;

  // FIX: If socket isn't ready, queue and reconnect
  if (!socket || !socketReady) {
    if (currentToken) {
      if (!socket || socket.disconnected) connectSocket(currentToken);
      pendingMessages.push({ groupId: currentGroup._id, message: msg });
      input.value = "";
      console.warn("Socket not ready — message queued, reconnecting...");
    }
    return;
  }

  socket.emit("sendMessage", { groupId: currentGroup._id, message: msg });
  input.value = "";
}

// ─── LINKS ───────────────────────────────────
async function loadLinks(groupId) {
  const container = $("links-container");
  container.innerHTML = '<div class="loading-msgs">Loading resources...</div>';
  try {
    const links = await api("/links/" + groupId, "GET", null, currentToken);
    container.innerHTML = "";
    if (!links.length) {
      container.innerHTML = '<div class="loading-msgs">No resources yet. Add one above!</div>';
      return;
    }
    links.forEach((l) => container.appendChild(buildLinkCard(l)));
  } catch (e) {
    container.innerHTML = '<div class="loading-msgs">Failed to load resources</div>';
  }
}

function buildLinkCard(link) {
  const hasVoted = link.votedBy && link.votedBy.includes(currentUser._id);
  const div = document.createElement("div");
  div.className = "link-card";
  div.dataset.id = link._id;
  const tagsHtml = (link.tags || [])
    .map((t) => `<span class="link-tag">${escapeHtml(t)}</span>`)
    .join("");

  div.innerHTML = `
    <div class="link-vote">
      <button class="vote-btn${hasVoted ? " voted" : ""}" title="Upvote">▲</button>
      <span class="vote-count">${link.votes}</span>
    </div>
    <div class="link-info">
      <div class="link-title">${escapeHtml(link.title)}</div>
      <a class="link-url" href="${escapeHtml(link.url)}" target="_blank">${escapeHtml(link.url)}</a>
      ${link.description ? `<div class="link-desc">${escapeHtml(link.description)}</div>` : ""}
      <div class="link-meta">
        ${tagsHtml}
        <span class="link-by">by ${escapeHtml(link.addedByName)}</span>
      </div>
    </div>
  `;

  div.querySelector(".vote-btn").addEventListener("click", async () => {
    try {
      const updated = await api("/links/upvote", "POST", { linkId: link._id }, currentToken);
      link.votes = updated.votes;
      link.votedBy = updated.votedBy;
      const newCard = buildLinkCard(link);
      div.replaceWith(newCard);
    } catch (e) {
      console.error("Upvote failed:", e.message);
    }
  });

  return div;
}

async function addLink() {
  const title = $("link-title").value.trim();
  const url = $("link-url").value.trim();
  const description = $("link-desc").value.trim();
  const tagsRaw = $("link-tags").value.trim();
  const tags = tagsRaw ? tagsRaw.split(",").map((t) => t.trim()).filter(Boolean) : [];

  if (!title) return showError("link-error", "Title is required");
  if (!url) return showError("link-error", "URL is required");
  if (!currentGroup) return;

  try {
    await api("/links/add", "POST", {
      groupId: currentGroup._id, title, url, description, tags,
    }, currentToken);

    $("link-title").value = "";
    $("link-url").value = "";
    $("link-desc").value = "";
    $("link-tags").value = "";
    await loadLinks(currentGroup._id);
  } catch (e) {
    showError("link-error", e.message);
  }
}

// ─── MODALS ──────────────────────────────────
function openModal(title, bodyHtml, onConfirm) {
  $("modal-title").textContent = title;
  $("modal-body").innerHTML = bodyHtml;
  show($("modal-overlay"));

  const confirmBtn = $("modal-body").querySelector("#modal-confirm");
  if (confirmBtn) confirmBtn.addEventListener("click", onConfirm);
}

function closeModal() {
  hide($("modal-overlay"));
  $("modal-body").innerHTML = "";
}

function openCreateGroupModal() {
  openModal(
    "Create Group",
    `<input type="text" id="new-group-name" placeholder="Group name" maxlength="50"/>
     <div id="modal-g-error" class="modal-error hidden"></div>
     <button id="modal-confirm" class="btn btn-primary">Create</button>`,
    async () => {
      const name = $("new-group-name").value.trim();
      if (!name) {
        const err = $("modal-g-error");
        err.textContent = "Name is required";
        show(err);
        return;
      }
      try {
        const group = await api("/groups/create", "POST", { name }, currentToken);
        groups.unshift(group);
        renderGroups();
        closeModal();
        selectGroup(group._id);
      } catch (e) {
        const err = $("modal-g-error");
        err.textContent = e.message;
        show(err);
      }
    }
  );
  setTimeout(() => $("new-group-name")?.focus(), 50);
}

function openJoinGroupModal() {
  openModal(
    "Join Group",
    `<input type="text" id="join-code" placeholder="Enter invite code" style="text-transform:uppercase" maxlength="20"/>
     <div id="modal-j-error" class="modal-error hidden"></div>
     <button id="modal-confirm" class="btn btn-primary">Join</button>`,
    async () => {
      const code = $("join-code").value.trim();
      if (!code) {
        const err = $("modal-j-error");
        err.textContent = "Invite code is required";
        show(err);
        return;
      }
      try {
        const group = await api("/groups/join", "POST", { inviteCode: code }, currentToken);
        if (!groups.find((g) => g._id === group._id)) groups.unshift(group);
        renderGroups();
        closeModal();
        selectGroup(group._id);
      } catch (e) {
        const err = $("modal-j-error");
        err.textContent = e.message;
        show(err);
      }
    }
  );
  setTimeout(() => $("join-code")?.focus(), 50);
}

// ─── UTILS ───────────────────────────────────
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
// ─── LAST GROUP STORAGE ─────────────────────

function saveLastGroup(groupId) {
  chrome.storage.local.set({ lc_lastGroup: groupId });
}

function loadLastGroup(cb) {
  chrome.storage.local.get(["lc_lastGroup"], (data) => {
    cb(data.lc_lastGroup || null);
  });
}
// ─── EVENT LISTENERS ─────────────────────────
function bindEvents() {
  // Auth tabs
  document.querySelectorAll(".auth-tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".auth-tab").forEach((b) => b.classList.remove("active"));
      document.querySelectorAll(".auth-form").forEach((f) => f.classList.remove("active"));
      btn.classList.add("active");
      const form = $(btn.dataset.tab + "-form");
      if (form) form.classList.add("active");
    });
  });

  $("login-btn").addEventListener("click", doLogin);
  $("register-btn").addEventListener("click", doRegister);
  $("logout-btn").addEventListener("click", doLogout);

  $("login-password").addEventListener("keydown", (e) => { if (e.key === "Enter") doLogin(); });
  $("reg-password").addEventListener("keydown", (e) => { if (e.key === "Enter") doRegister(); });

  $("create-group-btn").addEventListener("click", openCreateGroupModal);
  $("join-group-btn").addEventListener("click", openJoinGroupModal);

  document.querySelectorAll(".tab").forEach((t) => {
    t.addEventListener("click", () => switchTab(t.dataset.tab));
  });

  $("send-btn").addEventListener("click", sendMessage);
  $("message-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  });

  $("add-link-btn").addEventListener("click", addLink);

  $("modal-close").addEventListener("click", closeModal);
  $("modal-overlay").addEventListener("click", (e) => {
    if (e.target === $("modal-overlay")) closeModal();
  });
}

// ─── BOOTSTRAP ──────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  bindEvents();
  loadAuth((token, user) => {
    if (token && user) {
      currentToken = token;
      currentUser = user;
      initApp();
    } else {
      showScreen("auth");
    }
  });
});
 src="vendor/socket.io.min.js"
src="popup.js"