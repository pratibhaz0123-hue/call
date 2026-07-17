/**
 * server.js
 * Real-time Chat + Voice/Video Call server — CODE-BASED PAIRING
 * Stack: Node.js, Express, Socket.IO, WebRTC (signaling only)
 *
 * Every visitor is issued two random codes on connect:
 *   - a Chat Code  (share it so someone can text you)
 *   - a Call Code  (share it so someone can voice/video call you)
 *
 * Another user types your code into their app to reach you directly —
 * there's no public room / online-users list, it's 1:1 pairing by code.
 *
 * Run with:  node server.js
 * Then open: http://localhost:3000  (in two+ browser tabs/devices to test)
 */

const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }, // relax CORS for local/dev testing; lock this down in production
});

const PORT = process.env.PORT || 3000;

// ---------------------------------------------------------------------------
// REST: serve the frontend
// ---------------------------------------------------------------------------
app.use(express.static(__dirname));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.get("/health", (req, res) => {
  res.json({ status: "ok", connections: io.engine.clientsCount });
});

// ---------------------------------------------------------------------------
// In-memory state
// ---------------------------------------------------------------------------
const chatCodeToSocket = new Map(); // chatCode -> socketId
const callCodeToSocket = new Map(); // callCode -> socketId
const allActiveCodes = new Set();   // both pools combined, just to avoid confusing lookalikes

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I to avoid confusion

function generateCode(length = 6) {
  let code;
  do {
    code = "";
    for (let i = 0; i < length; i++) {
      code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
    }
  } while (allActiveCodes.has(code));
  allActiveCodes.add(code);
  return code;
}

function releaseCode(code) {
  allActiveCodes.delete(code);
}

// ---------------------------------------------------------------------------
// Socket.IO: pairing, chat, and WebRTC signaling
// ---------------------------------------------------------------------------
io.on("connection", (socket) => {
  // Issue this connection its own chat code + call code
  const chatCode = generateCode();
  const callCode = generateCode();

  chatCodeToSocket.set(chatCode, socket.id);
  callCodeToSocket.set(callCode, socket.id);

  socket.data.chatCode = chatCode;
  socket.data.callCode = callCode;
  socket.data.chatRoom = null; // room id once paired with a chat partner

  socket.emit("your-codes", { chatCode, callCode });
  console.log(`[connect] ${socket.id} issued chat=${chatCode} call=${callCode}`);

  // -------------------------------------------------------------------
  // Chat pairing: enter someone's Chat Code to open a private chat
  // -------------------------------------------------------------------
  socket.on("connect-chat", (rawCode) => {
    const code = (rawCode || "").trim().toUpperCase();
    const targetId = chatCodeToSocket.get(code);
    const targetSocket = targetId && io.sockets.sockets.get(targetId);

    if (!targetSocket) {
      socket.emit("chat-error", { message: "No one found with that chat code." });
      return;
    }
    if (targetSocket.id === socket.id) {
      socket.emit("chat-error", { message: "That's your own code." });
      return;
    }

    const roomId = [socket.id, targetSocket.id].sort().join(":");

    socket.join(roomId);
    targetSocket.join(roomId);
    socket.data.chatRoom = roomId;
    targetSocket.data.chatRoom = roomId;

    socket.emit("chat-connected", { roomId, partnerCode: targetSocket.data.chatCode });
    targetSocket.emit("chat-connected", { roomId, partnerCode: socket.data.chatCode });

    io.to(roomId).emit("system-message", "Chat connected — say hello!");
    console.log(`[chat-pair] ${socket.data.chatCode} <-> ${targetSocket.data.chatCode}`);
  });

  socket.on("chat message", (text) => {
    if (!text || typeof text !== "string" || !socket.data.chatRoom) return;
    io.to(socket.data.chatRoom).emit("chat message", {
      from: socket.data.chatCode,
      text: text.slice(0, 2000),
      timestamp: Date.now(),
    });
  });

  socket.on("typing", (isTyping) => {
    if (!socket.data.chatRoom) return;
    socket.to(socket.data.chatRoom).emit("typing", {
      from: socket.data.chatCode,
      isTyping: !!isTyping,
    });
  });

  socket.on("leave-chat", () => {
    if (socket.data.chatRoom) {
      socket.to(socket.data.chatRoom).emit("system-message", "The other person left the chat.");
      socket.leave(socket.data.chatRoom);
      socket.data.chatRoom = null;
    }
  });

  // -------------------------------------------------------------------
  // WebRTC signaling for voice/video calls — target resolved by Call Code
  //   Caller -> "call-user"     -> Callee gets "incoming-call"
  //   Callee -> "answer-call"   -> Caller gets "call-answered"
  //   Both   -> "ice-candidate" -> exchanged as they're discovered
  //   Either -> "end-call"      -> other side gets "call-ended"
  // -------------------------------------------------------------------
  socket.on("call-user", ({ code, offer, callType }) => {
    const cleanCode = (code || "").trim().toUpperCase();
    const targetId = callCodeToSocket.get(cleanCode);

    if (!targetId || !io.sockets.sockets.get(targetId)) {
      socket.emit("call-error", { message: "No one found with that call code." });
      return;
    }
    if (targetId === socket.id) {
      socket.emit("call-error", { message: "That's your own code." });
      return;
    }

    socket.data.callPeer = targetId;

    io.to(targetId).emit("incoming-call", {
      from: socket.id,
      fromCode: socket.data.callCode,
      offer,
      callType: callType === "video" ? "video" : "voice",
    });
  });

  socket.on("answer-call", ({ to, answer }) => {
    socket.data.callPeer = to;
    io.to(to).emit("call-answered", { from: socket.id, answer });
  });

  socket.on("reject-call", ({ to }) => {
    io.to(to).emit("call-rejected", { from: socket.id });
  });

  socket.on("ice-candidate", ({ to, candidate }) => {
    if (!candidate) return;
    io.to(to).emit("ice-candidate", { from: socket.id, candidate });
  });

  socket.on("end-call", ({ to }) => {
    if (to) io.to(to).emit("call-ended", { from: socket.id });
    socket.data.callPeer = null;
  });

  // -------------------------------------------------------------------
  // Disconnect cleanup
  // -------------------------------------------------------------------
  socket.on("disconnect", () => {
    if (socket.data.chatRoom) {
      socket.to(socket.data.chatRoom).emit("system-message", "The other person disconnected.");
    }
    if (socket.data.callPeer) {
      io.to(socket.data.callPeer).emit("call-ended", { from: socket.id });
    }

    chatCodeToSocket.delete(socket.data.chatCode);
    callCodeToSocket.delete(socket.data.callCode);
    releaseCode(socket.data.chatCode);
    releaseCode(socket.data.callCode);

    console.log(`[disconnect] ${socket.id} (chat=${socket.data.chatCode}, call=${socket.data.callCode})`);
  });
});

// ---------------------------------------------------------------------------
server.listen(PORT, () => {
  console.log(`Chat & Call server running at http://localhost:${PORT}`);
});
