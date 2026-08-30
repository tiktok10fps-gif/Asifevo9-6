const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 10000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

/*
  Demo storage
  NOTE:
  Render restart করলে এই data reset হবে.
*/
const groups = new Map();

/*
  Example group structure:

  {
    id: "general",
    name: "General",
    users: Map(),
    messages: []
  }
*/

function createGroup(id, name) {
  if (!groups.has(id)) {
    groups.set(id, {
      id,
      name,
      users: new Map(),
      messages: []
    });
  }

  return groups.get(id);
}

createGroup("general", "General");
createGroup("friends", "Friends");

function cleanText(text, max = 1000) {
  return String(text || "")
    .replace(/[<>]/g, "")
    .trim()
    .slice(0, max);
}

function getPublicGroups() {
  return [...groups.values()].map(group => ({
    id: group.id,
    name: group.name,
    online: group.users.size,
    messages: group.messages.length
  }));
}

function getGroupUsers(group) {
  return [...group.users.values()].map(user => ({
    id: user.id,
    name: user.name
  }));
}

function addMessage(group, message) {
  group.messages.push(message);

  // Keep only latest 100 messages
  if (group.messages.length > 100) {
    group.messages.shift();
  }
}

function makeMessage(user, text, type = "user") {
  return {
    id:
      Date.now().toString(36) +
      Math.random().toString(36).slice(2),

    userId: user.id,
    username: user.name,
    text,
    type,
    time: new Date().toISOString()
  };
}

/*
  Simple demo AI bot.

  This does NOT require an external AI API.
  Later you can replace getBotReply()
  with your preferred AI API.
*/

async function getBotReply(text) {
  const lower = text.toLowerCase();

  if (lower.includes("hello") || lower.includes("hi")) {
    return "Hey! 👋 আমি Group Bot। কীভাবে সাহায্য করতে পারি?";
  }

  if (lower.includes("help")) {
    return "আমি group chat-এর basic প্রশ্নের উত্তর দিতে পারি। আমাকে @bot mention করে প্রশ্ন করো। 🤖";
  }

  if (lower.includes("who are you")) {
    return "আমি এই group's AI assistant bot. 🤖";
  }

  if (lower.includes("time")) {
    return `Server time: ${new Date().toLocaleString()}`;
  }

  return `তোমার message পেয়েছি: "${text}" 🤖`;
}

io.on("connection", socket => {
  console.log("Connected:", socket.id);

  socket.on("get-groups", () => {
    socket.emit("groups", getPublicGroups());
  });

  socket.on("create-group", data => {
    const name = cleanText(data?.name, 40);

    if (!name) return;

    const id =
      name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "") +
      "-" +
      Math.random().toString(36).slice(2, 7);

    const group = createGroup(id, name);

    socket.emit("group-created", {
      id: group.id,
      name: group.name
    });

    io.emit("groups", getPublicGroups());
  });

  socket.on("join-group", data => {
    const groupId = cleanText(data?.groupId, 100);
    const username = cleanText(data?.username, 30) || "Guest";

    const group = groups.get(groupId);

    if (!group) {
      socket.emit("error-message", "Group not found.");
      return;
    }

    // Leave previous groups
    for (const room of socket.rooms) {
      if (room !== socket.id) {
        socket.leave(room);

        const oldGroup = groups.get(room);

        if (oldGroup) {
          oldGroup.users.delete(socket.id);
          io.to(room).emit("users", getGroupUsers(oldGroup));
          io.to(room).emit("system-message", {
            text: `${username} left the group.`
          });
        }
      }
    }

    socket.join(groupId);

    group.users.set(socket.id, {
      id: socket.id,
      name: username
    });

    socket.currentGroup = groupId;
    socket.username = username;

    socket.emit("joined-group", {
      group: {
        id: group.id,
        name: group.name
      },
      messages: group.messages
    });

    io.to(groupId).emit("users", getGroupUsers(group));

    io.emit("groups", getPublicGroups());

    socket.to(groupId).emit("system-message", {
      text: `${username} joined the group.`
    });
  });

  socket.on("send-message", async data => {
    const groupId = socket.currentGroup;
    const group = groups.get(groupId);

    if (!group) return;

    const text = cleanText(data?.text);

    if (!text) return;

    const user = group.users.get(socket.id);

    if (!user) return;

    const message = makeMessage(user, text);

    addMessage(group, message);

    io.to(groupId).emit("new-message", message);

    /*
      Bot activates when:
      @bot hello
      @ai hello
      bot, hello
    */

    const botTrigger =
      /^@bot\b/i.test(text) ||
      /^@ai\b/i.test(text) ||
      /^bot[, ]/i.test(text);

    if (botTrigger) {
      const botQuestion = text
        .replace(/^@bot\s*/i, "")
        .replace(/^@ai\s*/i, "")
        .replace(/^bot[, ]*/i, "")
        .trim();

      io.to(groupId).emit("bot-typing", true);

      try {
        const reply = await getBotReply(botQuestion || text);

        const botUser = {
          id: "BOT",
          name: "GroupBot 🤖"
        };

        const botMessage = makeMessage(
          botUser,
          reply,
          "bot"
        );

        addMessage(group, botMessage);

        io.to(groupId).emit("bot-typing", false);
        io.to(groupId).emit("new-message", botMessage);
      } catch (error) {
        console.error(error);

        io.to(groupId).emit("bot-typing", false);

        io.to(groupId).emit("new-message", {
          id: Date.now().toString(),
          username: "GroupBot 🤖",
          userId: "BOT",
          text: "Sorry, bot-এর response পাওয়া যায়নি।",
          type: "bot",
          time: new Date().toISOString()
        });
      }
    }
  });

  socket.on("typing", value => {
    const groupId = socket.currentGroup;

    if (!groupId) return;

    socket.to(groupId).emit("typing", {
      username: socket.username || "Someone",
      value: Boolean(value)
    });
  });

  socket.on("disconnect", () => {
    const groupId = socket.currentGroup;

    if (!groupId) return;

    const group = groups.get(groupId);

    if (!group) return;

    const username = socket.username || "Guest";

    group.users.delete(socket.id);

    io.to(groupId).emit("users", getGroupUsers(group));

    io.to(groupId).emit("system-message", {
      text: `${username} disconnected.`
    });

    io.emit("groups", getPublicGroups());

    console.log("Disconnected:", socket.id);
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    service: "Messenger Group Bot",
    time: new Date().toISOString()
  });
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
