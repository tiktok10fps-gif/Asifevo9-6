const socket = io();

let username = "";
let currentGroup = null;
let typingTimer = null;

const loginModal = document.getElementById("loginModal");
const groupModal = document.getElementById("groupModal");

const usernameInput =
  document.getElementById("usernameInput");

const groupNameInput =
  document.getElementById("groupNameInput");

const loginBtn =
  document.getElementById("loginBtn");

const createGroupBtn =
  document.getElementById("createGroup");

const cancelGroupBtn =
  document.getElementById("cancelGroup");

const newGroupBtn =
  document.getElementById("newGroupBtn");

const groupList =
  document.getElementById("groupList");

const messages =
  document.getElementById("messages");

const messageInput =
  document.getElementById("messageInput");

const sendBtn =
  document.getElementById("sendBtn");

const groupName =
  document.getElementById("groupName");

const groupAvatar =
  document.getElementById("groupAvatar");

const onlineText =
  document.getElementById("onlineText");

const profileName =
  document.getElementById("profileName");

const profileAvatar =
  document.getElementById("profileAvatar");

const typing =
  document.getElementById("typing");

const membersPanel =
  document.getElementById("membersPanel");

const membersList =
  document.getElementById("membersList");

const membersBtn =
  document.getElementById("membersBtn");

const closeMembers =
  document.getElementById("closeMembers");


/* LOGIN */

const savedName =
  localStorage.getItem("chat_username");

if (savedName) {

  username = savedName;

  setupProfile();

  loginModal.classList.add("hidden");

} else {

  loginModal.classList.remove("hidden");

}

loginBtn.addEventListener("click", login);

usernameInput.addEventListener("keydown", e => {

  if (e.key === "Enter") {
    login();
  }

});

function login() {

  const name =
    usernameInput.value.trim();

  if (!name) {

    alert("Please enter your name.");

    return;
  }

  username = name.slice(0, 30);

  localStorage.setItem(
    "chat_username",
    username
  );

  setupProfile();

  loginModal.classList.add("hidden");
}

function setupProfile() {

  profileName.textContent = username;

  profileAvatar.textContent =
    username.charAt(0).toUpperCase();
}


/* GROUPS */

socket.emit("get-groups");

socket.on("groups", groups => {

  groupList.innerHTML = "";

  groups.forEach(group => {

    const button =
      document.createElement("button");

    button.className = "group-item";

    if (
      currentGroup &&
      currentGroup.id === group.id
    ) {
      button.classList.add("active");
    }

    const avatar =
      document.createElement("div");

    avatar.className =
      "group-mini-avatar";

    avatar.textContent =
      group.name.charAt(0).toUpperCase();

    const details =
      document.createElement("div");

    details.className =
      "group-details";

    const title =
      document.createElement("strong");

    title.textContent = group.name;

    const info =
      document.createElement("small");

    info.textContent =
      `${group.online} online`;

    details.appendChild(title);
    details.appendChild(info);

    button.appendChild(avatar);
    button.appendChild(details);

    button.addEventListener("click", () => {

      joinGroup(group.id);

    });

    groupList.appendChild(button);

  });

});


function joinGroup(id) {

  if (!username) {

    loginModal.classList.remove("hidden");

    return;
  }

  socket.emit("join-group", {
    groupId: id,
    username
  });

}


/* JOINED */

socket.on("joined-group", data => {

  currentGroup = data.group;

  groupName.textContent =
    data.group.name;

  groupAvatar.textContent =
    data.group.name
      .charAt(0)
      .toUpperCase();

  renderMessages(data.messages);

  messageInput.focus();

  socket.emit("get-groups");

});


/* MESSAGES */

function renderMessages(list) {

  messages.innerHTML = "";

  list.forEach(message => {

    renderMessage(message);

  });

  scrollBottom();
}


function renderMessage(message) {

  const wrapper =
    document.createElement("div");

  const isMe =
    message.userId === socket.id;

  wrapper.className =
    "message" +
    (isMe ? " me" : "") +
    (message.type === "bot"
      ? " bot"
      : "");

  const content =
    document.createElement("div");

  content.className =
    "message-content";

  const name =
    document.createElement("div");

  name.className =
    "message-name";

  name.textContent =
    message.type === "bot"
      ? "🤖 GroupBot"
      : message.username;

  const bubble =
    document.createElement("div");

  bubble.className = "bubble";

  bubble.textContent =
    message.text;

  const time =
    document.createElement("div");

  time.className = "time";

  time.textContent =
    formatTime(message.time);

  content.appendChild(name);
  content.appendChild(bubble);
  content.appendChild(time);

  wrapper.appendChild(content);

  messages.appendChild(wrapper);

  scrollBottom();
}


function formatTime(date) {

  return new Date(date)
    .toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit"
    });

}


function scrollBottom() {

  messages.scrollTop =
    messages.scrollHeight;

}


/* SEND */

function sendMessage() {

  const text =
    messageInput.value.trim();

  if (!text || !currentGroup) return;

  socket.emit("send-message", {
    text
  });

  messageInput.value = "";

  socket.emit("typing", false);

}


sendBtn.addEventListener(
  "click",
  sendMessage
);


messageInput.addEventListener(
  "keydown",
  e => {

    if (e.key === "Enter") {

      e.preventDefault();

      sendMessage();

    }

  }
);


/* TYPING */

messageInput.addEventListener(
  "input",
  () => {

    socket.emit(
      "typing",
      messageInput.value.length > 0
    );

    clearTimeout(typingTimer);

    typingTimer =
      setTimeout(() => {

        socket.emit(
          "typing",
          false
        );

      }, 1200);

  }
);


socket.on("typing", data => {

  if (data.value) {

    typing.textContent =
      `${data.username} is typing...`;

  } else {

    typing.textContent = "";

  }

});


socket.on("bot-typing", active => {

  typing.textContent =
    active
      ? "🤖 GroupBot is thinking..."
      : "";

});


socket.on("new-message", message => {

  renderMessage(message);

});


/* SYSTEM MESSAGE */

socket.on("system-message", data => {

  const div =
    document.createElement("div");

  div.className = "system";

  div.textContent = data.text;

  messages.appendChild(div);

  scrollBottom();

});


/* USERS */

socket.on("users", users => {

  onlineText.textContent =
    `${users.length} online`;

  membersList.innerHTML = "";

  users.forEach(user => {

    const div =
      document.createElement("div");

    div.className = "member";

    const avatar =
      document.createElement("div");

    avatar.className =
      "member-avatar";

    avatar.textContent =
      user.name
        .charAt(0)
        .toUpperCase();

    const name =
      document.createElement("span");

    name.textContent =
      user.name +
      (
        user.id === socket.id
          ? " (You)"
          : ""
      );

    div.appendChild(avatar);
    div.appendChild(name);

    membersList.appendChild(div);

  });

});


/* CREATE GROUP */

newGroupBtn.addEventListener(
  "click",
  () => {

    groupModal.classList.remove(
      "hidden"
    );

    groupNameInput.focus();

  }
);


cancelGroupBtn.addEventListener(
  "click",
  () => {

    groupModal.classList.add(
      "hidden"
    );

  }
);


createGroupBtn.addEventListener(
  "click",
  () => {

    const name =
      groupNameInput.value.trim();

    if (!name) {

      alert("Enter a group name.");

      return;
    }

    socket.emit(
      "create-group",
      { name }
    );

    groupNameInput.value = "";

    groupModal.classList.add(
      "hidden"
    );

  }
);


socket.on("group-created", group => {

  joinGroup(group.id);

});


/* MEMBERS */

membersBtn.addEventListener(
  "click",
  () => {

    membersPanel.classList.remove(
      "hidden"
    );

  }
);


closeMembers.addEventListener(
  "click",
  () => {

    membersPanel.classList.add(
      "hidden"
    );

  }
);


/* ERRORS */

socket.on("error-message", message => {

  alert(message);

});
