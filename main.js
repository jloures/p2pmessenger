// 1. POLYFILLS (MUST BE AT THE VERY TOP)
if (typeof global === 'undefined') {
  window.global = window;
}

import { Buffer } from 'https://esm.sh/buffer@6.0.3';
window.Buffer = Buffer;

import { joinRoom } from 'https://esm.sh/trystero@0.22.0/torrent';

// 2. CONFIG
const APP_ID = 'p2pmsg-v1';

// 3. STATE
let room;
let activeRoomId = '';
let myHandle = '';
let sendAction; // Trystero send function
let peers = {}; // peerId -> metadata (handle)

// 4. DOM ELEMENTS (ROBUST SELECTION)
const getEl = (id) => {
  const el = document.getElementById(id);
  if (!el) console.warn(`Critical UI Element not found: #${id}`);
  return el;
};

const views = {
  join: getEl('join-view'),
  chat: getEl('chat-view'),
};

const forms = {
  join: getEl('join-form'),
  chat: getEl('chat-form'),
};

const inputs = {
  username: getEl('username'),
  roomId: getEl('room-id'),
  password: getEl('room-password'),
  message: getEl('message-input'),
};

const display = {
  roomName: getEl('display-room-id'),
  peerCount: getEl('peer-count'),
  messages: getEl('messages-container'),
  genBtn: getEl('gen-room-btn'),
  leaveBtn: getEl('leave-btn'),
  copyBtn: getEl('copy-room-btn'),
};

// 5. GLOBAL ERROR TRACKING
window.addEventListener('unhandledrejection', event => {
  console.error('Unhandled rejection:', event.reason);
  const reason = event.reason?.message || event.reason || 'Unknown error';
  appendSystemMessage(`📡 Connection Error: ${reason}`);
});

window.onerror = function (msg, url, lineNo, columnNo, error) {
  appendSystemMessage(`System Error: ${msg} [Line: ${lineNo}]`);
  return false;
};

// 6. INITIALIZATION & UI EVENTS

// Update Version
function updateVersionAndHash() {
  const versionEl = document.getElementById('app-version');
  if (versionEl && typeof APP_VERSION !== 'undefined') {
    versionEl.textContent = APP_VERSION;
  }

  if (window.location.hash) {
    const params = new URLSearchParams(window.location.hash.substring(1));
    if (params.has('room') && inputs.roomId) inputs.roomId.value = params.get('room');
    if (params.has('pass') && inputs.password) inputs.password.value = params.get('pass');
    if (params.has('name') && inputs.username) inputs.username.value = params.get('name');
  }
}

// Run immediately and also on load to be safe
updateVersionAndHash();
window.addEventListener('load', updateVersionAndHash);
window.addEventListener('hashchange', updateVersionAndHash);

// Dice Button Fix
if (display.genBtn) {
  display.genBtn.addEventListener('click', (e) => {
    e.preventDefault();
    const randomId = 'room-' + Math.random().toString(36).substring(2, 9);
    if (inputs.roomId) {
      inputs.roomId.value = randomId;
      console.log('Dice clicked: generated ' + randomId);
    }
  });
}

// Join Room Submit
if (forms.join) {
  forms.join.addEventListener('submit', async (e) => {
    e.preventDefault();
    const handle = inputs.username.value.trim();
    const roomName = inputs.roomId.value.trim();
    const password = inputs.password.value.trim();

    if (!handle || !roomName) return;

    myHandle = handle;
    activeRoomId = roomName;

    try {
      enterChatView();
      appendSystemMessage(`Connecting to room: ${roomName}...`);
      initP2P(roomName, password);
      appendSystemMessage(`Looking for peers via trackers...`);
      if (password) {
        appendSystemMessage('🛡️ E2EE Encryption active.');
      }
    } catch (err) {
      console.error(err);
      appendSystemMessage(`Init Error: ${err.message}`);
    }
  });
}

// Copy Link
if (display.copyBtn) {
  display.copyBtn.addEventListener('click', () => {
    const passValue = inputs.password ? inputs.password.value : '';
    const shareUrl = `${window.location.origin}${window.location.pathname}#room=${activeRoomId}&pass=${passValue}`;
    navigator.clipboard.writeText(shareUrl);

    const originalText = display.copyBtn.textContent;
    display.copyBtn.textContent = '🔗';
    setTimeout(() => {
      display.copyBtn.textContent = originalText;
    }, 2000);
  });
}

if (display.leaveBtn) {
  display.leaveBtn.addEventListener('click', () => {
    window.location.reload();
  });
}

// Send Message
if (forms.chat) {
  forms.chat.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = inputs.message.value.trim();
    if (!text) return;

    if (sendAction) {
      sendAction({ text, sender: myHandle, timestamp: Date.now() });
    }

    appendMessage({ text, sender: myHandle, timestamp: Date.now() }, true);
    inputs.message.value = '';
  });
}


// 7. P2P LOGIC

function initP2P(roomName, password) {
  const config = { appId: APP_ID };
  if (password) config.password = password;

  room = joinRoom(config, roomName);

  const [sendMsg, getMsg] = room.makeAction('chat');
  sendAction = sendMsg;

  getMsg((data, peerId) => {
    if (data.type === 'handshake') {
      peers[peerId] = data.sender;
      appendSystemMessage(`${data.sender} joined.`);
      sendAction({ type: 'handshake-reply', sender: myHandle });
      updatePeerCount();
      return;
    }
    if (data.type === 'handshake-reply') {
      peers[peerId] = data.sender;
      appendSystemMessage(`Connected to ${data.sender}.`);
      updatePeerCount();
      return;
    }
    appendMessage(data, false);
  });

  room.onPeerJoin(peerId => {
    appendSystemMessage(`Peer found, shaking hands...`);
    if (sendAction) {
      sendAction({ type: 'handshake', sender: myHandle });
    }
  });

  room.onPeerLeave(peerId => {
    const handle = peers[peerId] || 'A peer';
    delete peers[peerId];
    updatePeerCount();
    appendSystemMessage(`${handle} left.`);
  });

  updatePeerCount();
}

function updatePeerCount() {
  if (!room) return;
  const count = Object.keys(room.getPeers()).length + 1;
  if (display.peerCount) {
    display.peerCount.textContent = `${count} Peer${count !== 1 ? 's' : ''}`;
  }
}

// 8. HELPERS

function enterChatView() {
  if (views.join) views.join.classList.add('hidden');
  if (views.chat) views.chat.classList.remove('hidden');
  if (display.roomName) display.roomName.textContent = `#${activeRoomId}`;
}

function appendMessage(data, isOwn) {
  if (!display.messages) return;

  const div = document.createElement('div');
  div.className = `message-bubble ${isOwn ? 'message-own' : 'message-peer'}`;
  const time = new Date(data.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  div.innerHTML = `
    <span class="sender-name">${isOwn ? 'You' : (data.sender || 'Peer')}</span>
    ${escapeHtml(data.text || '')}
    <span class="message-meta">${time}</span>
  `;

  display.messages.appendChild(div);
  scrollToBottom();
}

function appendSystemMessage(text) {
  if (!display.messages) return;
  const div = document.createElement('div');
  div.className = 'system-message';
  div.textContent = text;
  display.messages.appendChild(div);
  scrollToBottom();
}

function scrollToBottom() {
  if (display.messages) {
    display.messages.scrollTop = display.messages.scrollHeight;
  }
}

function escapeHtml(text) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return text.replace(/[&<>"']/g, function (m) { return map[m]; });
}
