// Polyfill for libraries that expect 'global' or 'Buffer' (common in P2P/crypto libs)
if (typeof global === 'undefined') {
  window.global = window;
}

// Some P2P libraries require Buffer during handshake or encryption
import { Buffer } from 'buffer';
window.Buffer = Buffer;

import { joinRoom } from 'trystero/torrent';

const APP_ID = 'p2pmsg-v1';

// Catch unhandled promise rejections for UI feedback
window.addEventListener('unhandledrejection', event => {
  console.error('Unhandled rejection:', event.reason);
  const msg = event.reason?.message || event.reason || 'Unknown async error';
  if (typeof appendSystemMessage === 'function') {
    appendSystemMessage(`📡 Connection Error: ${msg}`);
  }
});

// State
let room;
let activeRoomId = '';
let myHandle = '';
let sendAction; // Trystero send function
let peers = {}; // peerId -> metadata (handle)

// DOM Elements - Helper to catch missing elements
const getEl = (id) => {
  const el = document.getElementById(id);
  if (!el) console.warn(`Element with id "${id}" not found.`);
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

// --- Initialization ---

// Generate random room ID on click
if (display.genBtn) {
  display.genBtn.addEventListener('click', (e) => {
    e.preventDefault();
    const randomId = 'room-' + Math.random().toString(36).substring(2, 9);
    if (inputs.roomId) {
      inputs.roomId.value = randomId;
      console.log('Dice clicked, generated:', randomId);
    }
  });
} else {
  console.error('Dice button (gen-room-btn) not found in DOM');
}

// Auto-fill from URL hash
window.addEventListener('DOMContentLoaded', () => {
  if (window.location.hash) {
    const params = new URLSearchParams(window.location.hash.substring(1));
    if (params.has('room')) inputs.roomId.value = params.get('room');
    if (params.has('pass')) inputs.password.value = params.get('pass');
    if (params.has('name')) inputs.username.value = params.get('name');
  }
});

// Join Room
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
    appendSystemMessage(`Signal strength: Looking for peers via trackers...`);
    if (password) {
      appendSystemMessage('🛡️ End-to-End Encryption active.');
    }
  } catch (err) {
    console.error(err);
    appendSystemMessage(`Initialization Error: ${err.message}`);
  }
});

// Global Error Handler for mobile debugging
window.onerror = function (msg, url, lineNo, columnNo, error) {
  appendSystemMessage(`System Error: ${msg} [Line: ${lineNo}]`);
  return false;
};

// Copy Room ID
display.copyBtn?.addEventListener('click', () => {
  const shareUrl = `${window.location.origin}${window.location.pathname}#room=${activeRoomId}&pass=${inputs.password.value}`;
  navigator.clipboard.writeText(shareUrl);

  const originalText = display.copyBtn.textContent;
  display.copyBtn.textContent = '🔗';
  setTimeout(() => {
    display.copyBtn.textContent = originalText;
  }, 2000);
});
display.leaveBtn.addEventListener('click', () => {
  window.location.reload();
});

// Send Message
forms.chat.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = inputs.message.value.trim();
  if (!text) return;

  // Send to others
  if (sendAction) {
    sendAction({ text, sender: myHandle, timestamp: Date.now() });
  }

  // Show locally
  appendMessage({ text, sender: myHandle, timestamp: Date.now() }, true);
  inputs.message.value = '';
});


// --- P2P Logic ---

function initP2P(roomName, password) {
  // Join the room using BitTorrent trackers
  // Trystero uses the password to derive a 256-bit AES key for E2EE
  const config = { appId: APP_ID };
  if (password) config.password = password;

  room = joinRoom(config, roomName);

  // Create data channel for chat
  const [sendMsg, getMsg] = room.makeAction('chat');
  sendAction = sendMsg;

  // Handle incoming actions
  getMsg((data, peerId) => {
    if (data.type === 'handshake') {
      peers[peerId] = data.sender;
      appendSystemMessage(`${data.sender} joined the frequency.`);
      // Reply with our identity
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

  // Handle peers
  room.onPeerJoin(peerId => {
    appendSystemMessage(`Target found. Waiting for handshake...`);
    // Broadcast our handle to the new peer
    sendAction({ type: 'handshake', sender: myHandle });
  });

  room.onPeerLeave(peerId => {
    const handle = peers[peerId] || 'A peer';
    delete peers[peerId];
    updatePeerCount();
    appendSystemMessage(`${handle} disconnected.`);
  });

  // Initial peer count
  updatePeerCount();
}

function updatePeerCount() {
  if (!room) return;
  // room.getPeers() returns an object or array depending on version, 
  // Trystero documentation says getPeers() returns object { peerId: peerInfo }
  // or simple IDs. Actually, try peers update.
  // Wait, Trystero doesn't maintain a "list" sync automatically unless we track it.
  // room.getPeers() returns object of peers.
  const count = Object.keys(room.getPeers()).length + 1; // +1 for self
  display.peerCount.textContent = `${count} Peer${count !== 1 ? 's' : ''}`;
}


// --- UI Functions ---

function enterChatView() {
  views.join.classList.add('hidden');
  views.chat.classList.remove('hidden');
  display.roomName.textContent = `#${activeRoomId}`;
}

function appendMessage(data, isOwn) {
  if (data.type === 'announce') {
    // Optional: could handle announcements
    return;
  }

  const div = document.createElement('div');
  div.className = `message-bubble ${isOwn ? 'message-own' : 'message-peer'}`;

  const time = new Date(data.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  div.innerHTML = `
    <span class="sender-name">${isOwn ? 'You' : data.sender}</span>
    ${escapeHtml(data.text)}
    <span class="message-meta">${time}</span>
  `;

  display.messages.appendChild(div);
  scrollToBottom();
}

function appendSystemMessage(text) {
  const div = document.createElement('div');
  div.className = 'system-message';
  div.textContent = text;
  display.messages.appendChild(div);
  scrollToBottom();
}

function scrollToBottom() {
  display.messages.scrollTop = display.messages.scrollHeight;
}

function escapeHtml(text) {
  // Simple escape to prevent injection
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, function (m) { return map[m]; });
}
