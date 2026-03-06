# 🔗 LinkChat — Real-Time Group Chat & Resource Sharing Chrome Extension

A Chrome Extension for real-time team chat and link/resource sharing, powered by Node.js, Socket.IO, and MongoDB Atlas.

---

## 📁 Project Structure

```
linkchat/
├── server/
│   ├── models/
│   │   ├── User.js
│   │   ├── Group.js
│   │   ├── Message.js
│   │   └── Link.js
│   ├── routes/
│   │   ├── auth.js
│   │   ├── groups.js
│   │   ├── messages.js
│   │   └── links.js
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── groupController.js
│   │   ├── messageController.js
│   │   └── linkController.js
│   ├── middleware/
│   │   └── auth.js
│   ├── sockets/
│   │   └── chat.js
│   ├── .env.example
│   ├── package.json
│   └── server.js
└── extension/
    ├── icons/
    │   ├── icon16.png
    │   ├── icon48.png
    │   └── icon128.png
    ├── vendor/
    │   └── socket.io.min.js  ← YOU MUST DOWNLOAD THIS (see step 3)
    ├── manifest.json
    ├── popup.html
    ├── popup.js
    ├── styles.css
    └── background.js
```

---

## 🚀 Step 1 — Set Up MongoDB Atlas

1. Go to [https://mongodb.com/atlas](https://mongodb.com/atlas) and create a free account.
2. Create a **new Cluster** (free M0 tier is fine).
3. Under **Database Access**, create a user with a username and password.
4. Under **Network Access**, add your IP address (or `0.0.0.0/0` for all IPs during development).
5. Click **Connect** → **Connect your application** → Copy the connection string.
   It looks like:
   ```
   mongodb+srv://USERNAME:PASSWORD@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
6. Add your database name to the URI:
   ```
   mongodb+srv://USERNAME:PASSWORD@cluster0.xxxxx.mongodb.net/linkchat?retryWrites=true&w=majority
   ```

---

## ⚙️ Step 2 — Configure & Run the Backend Server

```bash
# Navigate to server directory
cd linkchat/server

# Install dependencies
npm install

# Create your .env file from the example
cp .env.example .env
```

Edit `.env` and fill in your values:
```env
PORT=5000
MONGODB_URI=mongodb+srv://USERNAME:PASSWORD@cluster0.xxxxx.mongodb.net/linkchat?retryWrites=true&w=majority
JWT_SECRET=pick_a_long_random_secret_string_here
```

Start the server:
```bash
# Development (with auto-reload)
npm run dev

# Production
npm start
```

You should see:
```
✅ Connected to MongoDB Atlas
🚀 Server running on port 5000
```

---

## 🧩 Step 3 — Download Socket.IO Client for the Extension

The Chrome Extension needs the Socket.IO browser client. Run this from the project root:

```bash
curl -o linkchat/extension/vendor/socket.io.min.js \
  https://cdn.socket.io/4.6.2/socket.io.min.js
```

Or manually download from:
[https://cdn.socket.io/4.6.2/socket.io.min.js](https://cdn.socket.io/4.6.2/socket.io.min.js)
and save it to `extension/vendor/socket.io.min.js`.

---

## 🔌 Step 4 — Load the Chrome Extension

1. Open Google Chrome and go to: `chrome://extensions/`
2. Enable **Developer mode** (toggle in the top-right corner).
3. Click **"Load unpacked"**.
4. Navigate to and select the `linkchat/extension/` folder.
5. The **LinkChat** extension icon will appear in your Chrome toolbar.
6. Click it to open the popup!

---

## 📡 API Endpoints Reference

### Auth
| Method | Endpoint | Body | Auth |
|--------|----------|------|------|
| POST | `/api/auth/register` | `{ username, email, password }` | ❌ |
| POST | `/api/auth/login` | `{ email, password }` | ❌ |

### Groups
| Method | Endpoint | Body | Auth |
|--------|----------|------|------|
| POST | `/api/groups/create` | `{ name }` | ✅ |
| POST | `/api/groups/join` | `{ inviteCode }` | ✅ |
| GET | `/api/groups/user` | — | ✅ |

### Messages
| Method | Endpoint | Auth |
|--------|----------|------|
| GET | `/api/messages/:groupId` | ✅ |

### Links
| Method | Endpoint | Body | Auth |
|--------|----------|------|------|
| POST | `/api/links/add` | `{ groupId, title, url, description?, tags? }` | ✅ |
| GET | `/api/links/:groupId` | — | ✅ |
| POST | `/api/links/upvote` | `{ linkId }` | ✅ |

---

## 🔒 Security Features

- Passwords hashed with **bcryptjs** (10 salt rounds)
- **JWT tokens** expire after 7 days
- All protected routes require `Authorization: Bearer <token>` header
- Socket.IO connections authenticated via JWT
- Group membership verified on every message send and link add
- Basic input validation on all endpoints

---

## 🌐 Deploying to Production

To deploy the backend to a server (e.g., Railway, Render, Fly.io):

1. Set environment variables (`PORT`, `MONGODB_URI`, `JWT_SECRET`)
2. Update the extension's `API` and `SOCKET_URL` constants in `popup.js` to point to your live server URL:
   ```js
   const API = "https://your-deployed-server.com/api";
   const SOCKET_URL = "https://your-deployed-server.com";
   ```
3. Reload the extension in Chrome.

---

## 📝 Notes

- The extension popup is **420×540px** and designed for Chrome.
- Messages are stored in MongoDB and loaded on group selection (last 100 messages).
- Socket.IO rooms are used per group (`groupId`) for real-time broadcasting.
- Upvoting a link you already voted on will toggle the vote off.
