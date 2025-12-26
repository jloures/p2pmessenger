import { Buffer } from 'https://esm.sh/buffer@6.0.3';
window.Buffer = Buffer;

import { P2PMessenger } from './p2p.js';
import * as utils from './utils.js';

// 2. CONFIG
const APP_ID = 'p2pmsg-v1';

// 3. STATE
const messenger = new P2PMessenger(APP_ID);
let myHandle = '';
let activeRoomId = '';

// Expose for testing/debugging
window.messenger = messenger;
window.utils = utils;

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

function updateVersionAndHash() {
  const versionEl = document.getElementById('app-version');
  if (versionEl && typeof APP_VERSION !== 'undefined') {
    versionEl.textContent = APP_VERSION;
  }

  const params = utils.parseHashParams(window.location.hash);
  if (params.room && inputs.roomId) inputs.roomId.value = params.room;
  if (params.pass && inputs.password) inputs.password.value = params.pass;
  if (params.name && inputs.username) inputs.username.value = params.name;
}

updateVersionAndHash();
window.addEventListener('load', updateVersionAndHash);
window.addEventListener('hashchange', updateVersionAndHash);

// Dice Button Fix
if (display.genBtn) {
  display.genBtn.addEventListener('click', (e) => {
    e.preventDefault();
    const randomId = utils.generateRoomId();
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

    if (!utils.validateHandle(handle) || !utils.validateRoomId(roomName)) {
      appendSystemMessage('Invalid name or room ID. Stay focused, hero!');
      return;
    }

    myHandle = handle;
    activeRoomId = roomName;

    try {
      enterChatView();
      appendSystemMessage(`Connecting to room: ${roomName}...`);

      messenger.onMessage = (data) => appendMessage(data, false);
      messenger.onSystemMessage = (msg) => appendSystemMessage(msg);
      messenger.onPeerUpdate = (count) => {
        if (display.peerCount) {
          display.peerCount.textContent = `${count} HERO${count !== 1 ? 'ES' : ''} ONLINE`;
        }
      };

      messenger.join(roomName, handle, password);

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
    messenger.leave();
    window.location.reload();
  });
}

// Send Message
if (forms.chat) {
  forms.chat.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = inputs.message.value.trim();
    if (!text) return;

    const msg = messenger.sendMessage(text);
    appendMessage(msg, true);
    inputs.message.value = '';
  });
}

// 8. HELPERS

function enterChatView() {
  const app = document.getElementById('app');
  if (app) {
    app.classList.remove('max-w-sm');
    app.classList.add('max-w-6xl', 'h-[92vh]', 'flex');
  }
  if (views.join) views.join.classList.add('hidden');
  if (views.chat) views.chat.classList.remove('hidden');
  if (display.roomName) display.roomName.textContent = `#${activeRoomId.toUpperCase()}`;
}

function appendMessage(data, isOwn) {
  if (!display.messages) return;

  const div = document.createElement('div');
  div.className = `flex flex-col ${isOwn ? 'items-end ml-auto' : 'items-start'} max-w-[85%] w-full chat-bubble-anim`;

  const time = utils.formatTime(data.timestamp);

  div.innerHTML = `
    <span class="${isOwn ? 'mr-2' : 'ml-2'} mb-1 text-sm font-bold text-[#1A1A1A]">${isOwn ? 'You' : utils.escapeHtml(data.sender || 'Hero')}</span>
    <div class="p-3 ${isOwn ? 'bg-[#4D96FF] chat-bubble-right text-white border-4 border-[#1A1A1A]' : 'bg-white chat-bubble-left text-[#1A1A1A]'} font-bold">
      ${utils.escapeHtml(data.text || '')}
      <span class="message-meta text-[10px] mt-1">${time}</span>
    </div>
  `;

  display.messages.appendChild(div);
  scrollToBottom();
}

function appendSystemMessage(text) {
  if (!display.messages) return;
  const div = document.createElement('div');
  div.className = 'system-message chat-bubble-anim';
  div.textContent = text.toUpperCase();
  display.messages.appendChild(div);
  scrollToBottom();
}

function scrollToBottom() {
  if (display.messages) {
    display.messages.scrollTop = display.messages.scrollHeight;
  }
}



