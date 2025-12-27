import { Buffer } from 'https://esm.sh/buffer@6.0.3';
window.Buffer = Buffer;

import { P2PMessenger } from './p2p.js';
import * as utils from './utils.js';

// 1. CONFIG
const APP_ID = 'p2pmsg-v2';

// 2. STATE
window.P2PMessenger = P2PMessenger;
window.messenger = null; // Exposed for testing/debugging
let messenger = null; // Will be initialized per room
let myHandle = localStorage.getItem('p2p_handle') || '';
let rooms = [];
try {
  rooms = JSON.parse(localStorage.getItem('p2p_rooms')) || [
    { id: 'saved-messages', name: 'Saved-Messages', icon: '⭐', isPrivate: true }
  ];
} catch (e) {
  rooms = [
    { id: 'saved-messages', name: 'Saved-Messages', icon: '⭐', isPrivate: true }
  ];
}
let activeRoomId = 'saved-messages';
let roomMessages = {};
try {
  roomMessages = JSON.parse(localStorage.getItem('p2p_messages')) || {};
} catch (e) {
  roomMessages = {};
}

// Expose for testing/debugging
window.utils = utils;

// 3. DOM ELEMENTS
const getEl = (id) => document.getElementById(id);

const els = {
  sidebar: getEl('sidebar'),
  sidebarToggle: getEl('sidebar-toggle'),
  roomList: getEl('room-list'),
  usernameInput: getEl('username'),
  showJoinModal: getEl('show-join-modal'),
  joinModal: getEl('join-modal'),
  closeModal: getEl('close-modal'),
  joinForm: getEl('join-form'),
  roomIdInput: getEl('room-id'),
  passwordInput: getEl('room-password'),
  genRoomBtn: getEl('gen-room-btn'),
  displayRoomId: getEl('display-room-id'),
  peerCount: getEl('peer-count'),
  messagesContainer: getEl('messages-container'),
  chatForm: getEl('chat-form'),
  messageInput: getEl('message-input'),
  leaveBtn: getEl('leave-btn'),
  copyBtn: getEl('copy-room-btn'),
  profileName: getEl('profile-name'),
};

// 4. INIT
function init() {
  els.usernameInput.value = myHandle;
  updateProfileDisplay();
  renderRoomList();
  switchRoom(activeRoomId);
  setupEventListeners();

  // Handle URL Hash if present
  const params = utils.parseHashParams(window.location.hash);
  handleParams(params);
}

function handleParams(params) {
  if (params.name) {
    myHandle = params.name;
    els.usernameInput.value = myHandle;
    updateProfileDisplay();
    localStorage.setItem('p2p_handle', myHandle);
  }

  if (params.room) {
    addRoom(params.room, params.room, params.pass || '');
    switchRoom(params.room);
  }
}

function refreshFromHash() {
  const params = utils.parseHashParams(window.location.hash);
  handleParams(params);
}

// 5. EVENT LISTENERS
function setupEventListeners() {
  els.sidebarToggle.addEventListener('click', () => {
    els.sidebar.classList.toggle('open');
  });

  els.usernameInput.addEventListener('input', (e) => {
    myHandle = e.target.value.trim();
    updateProfileDisplay();
    localStorage.setItem('p2p_handle', myHandle);
  });

  els.showJoinModal.addEventListener('click', () => {
    els.joinModal.classList.remove('hidden');
  });

  els.closeModal.addEventListener('click', () => {
    els.joinModal.classList.add('hidden');
  });

  els.genRoomBtn.addEventListener('click', () => {
    els.roomIdInput.value = utils.generateRoomId();
  });

  els.joinForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const id = els.roomIdInput.value.trim();
    const pass = els.passwordInput.value.trim();

    if (id) {
      addRoom(id, id, pass);
      els.joinModal.classList.add('hidden');
      els.joinForm.reset();
      switchRoom(id);
    }
  });

  els.chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = els.messageInput.value.trim();
    if (!text) return;

    handleSendMessage(text);
    els.messageInput.value = '';
  });

  els.leaveBtn.addEventListener('click', () => {
    if (activeRoomId === 'saved-messages') return;
    removeRoom(activeRoomId);
  });

  els.copyBtn.addEventListener('click', () => {
    const room = rooms.find(r => r.id === activeRoomId);
    if (!room || room.isPrivate) return;

    const shareUrl = `${window.location.origin}${window.location.pathname}#room=${room.id}&pass=${room.password || ''}`;
    navigator.clipboard.writeText(shareUrl);

    const originalText = els.copyBtn.textContent;
    els.copyBtn.textContent = 'COPIED! ✅';
    setTimeout(() => els.copyBtn.textContent = originalText, 2000);
  });

  window.addEventListener('hashchange', refreshFromHash);
}

function updateProfileDisplay() {
  els.profileName.textContent = myHandle || 'Anonymous Hero';
}

// 6. ROOM MANAGEMENT
function renderRoomList() {
  els.roomList.innerHTML = '';
  rooms.forEach(room => {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.className = `room-item w-full group ${activeRoomId === room.id ? 'active' : ''}`;
    btn.dataset.roomId = room.id;
    btn.setAttribute('role', 'button');
    btn.setAttribute('aria-label', `Join room ${room.name}`);
    btn.tabIndex = 0;

    btn.innerHTML = `
      <span class="room-icon" aria-hidden="true">${room.icon || '💬'}</span>
      <div class="flex-1 min-w-0">
        <div class="room-name truncate">${room.name}</div>
        <div class="text-[10px] truncate text-[#1A1A1A]">${room.id}</div>
      </div>
      ${!room.isPrivate ? `<button class="rename-btn text-xs opacity-0 group-hover:opacity-100" data-id="${room.id}" aria-label="Rename room ${room.name}">✏️</button>` : ''}
    `;

    btn.addEventListener('click', (e) => {
      if (e.target.classList.contains('rename-btn')) {
        const newName = prompt('Enter new name for room:', room.name);
        if (newName) renameRoom(room.id, newName);
        return;
      }
      switchRoom(room.id);
      if (window.innerWidth < 640) els.sidebar.classList.remove('open');
    });

    li.appendChild(btn);
    els.roomList.appendChild(li);
  });
}

function addRoom(id, name, password = '') {
  if (rooms.find(r => r.id === id)) return;
  rooms.push({ id, name, password, icon: '💬' });
  saveRooms();
  renderRoomList();
}

function removeRoom(id) {
  rooms = rooms.filter(r => r.id !== id);
  saveRooms();
  renderRoomList();
  switchRoom('saved-messages');
}

function renameRoom(id, newName) {
  const room = rooms.find(r => r.id === id);
  if (room) {
    room.name = newName;
    saveRooms();
    renderRoomList();
    if (activeRoomId === id) {
      switchRoom(id);
    }
  }
}

function saveRooms() {
  localStorage.setItem('p2p_rooms', JSON.stringify(rooms));
}

// 7. CHAT LOGIC
async function switchRoom(id) {
  if (messenger) {
    messenger.leave();
    messenger = null;
    window.messenger = null;
  }

  activeRoomId = id;
  const room = rooms.find(r => r.id === id);

  els.displayRoomId.textContent = (room?.name || id).toUpperCase();

  const idSubtitle = (room && room.name.toLowerCase() !== room.id.toLowerCase()) ? `ID: ${room.id}` : '';
  const baseStatus = room?.isPrivate ? 'SAVED MESSAGES' : 'CONNECTING...';
  els.peerCount.textContent = idSubtitle ? `${idSubtitle} • ${baseStatus}` : baseStatus;

  // Clear messages container and load history
  els.messagesContainer.innerHTML = '';
  const history = roomMessages[id] || [];
  history.forEach(msg => appendMessageUI(msg, msg.isOwn));

  renderRoomList();
  els.messageInput.focus();

  if (room && !room.isPrivate) {
    initP2P(room);
  }
}

function initP2P(room) {
  if (!myHandle) {
    appendSystemMessage('Please set a hero name in the sidebar first!');
  }

  messenger = new P2PMessenger(APP_ID);
  window.messenger = messenger;

  messenger.onMessage = (data) => {
    saveAndAppendMessage(activeRoomId, data, false);
  };

  messenger.onSystemMessage = (msg) => appendSystemMessage(msg);

  messenger.onPeerUpdate = (count) => {
    const idSubtitle = (room && room.name.toLowerCase() !== room.id.toLowerCase()) ? `ID: ${room.id} • ` : '';
    els.peerCount.textContent = `${idSubtitle}${count} HERO${count !== 1 ? 'ES' : ''} ONLINE`;
  };

  messenger.join(room.id, myHandle || 'Anonymous Hero', room.password);
  // Initial count update
  const idSubtitle = (room && room.name.toLowerCase() !== room.id.toLowerCase()) ? `ID: ${room.id} • ` : '';
  els.peerCount.textContent = `${idSubtitle}1 HERO ONLINE`;
}

function handleSendMessage(text) {
  const isPrivate = activeRoomId === 'saved-messages';
  const msg = {
    text,
    sender: myHandle || 'You',
    timestamp: Date.now(),
    isOwn: true
  };

  if (!isPrivate && messenger) {
    messenger.sendMessage(text);
  }

  saveAndAppendMessage(activeRoomId, msg, true);
}

function saveAndAppendMessage(roomId, data, isOwn) {
  if (!roomMessages[roomId]) roomMessages[roomId] = [];

  const msgToSave = { ...data, isOwn };
  roomMessages[roomId].push(msgToSave);

  // Keep only last 50 messages per room to save localStorage space
  if (roomMessages[roomId].length > 50) roomMessages[roomId].shift();

  localStorage.setItem('p2p_messages', JSON.stringify(roomMessages));

  if (activeRoomId === roomId) {
    appendMessageUI(data, isOwn);
  }
}

function appendMessageUI(data, isOwn) {
  const div = document.createElement('div');
  div.className = `flex flex-col ${isOwn ? 'items-end ml-auto' : 'items-start'} max-w-[85%] w-full chat-bubble-anim`;

  const time = utils.formatTime(data.timestamp);
  const sender = isOwn ? 'You' : utils.escapeHtml(data.sender || 'Hero');

  div.innerHTML = `
    <span class="${isOwn ? 'mr-2' : 'ml-2'} mb-1 text-[10px] font-black uppercase text-[#1A1A1A]">${sender}</span>
    <div class="p-3 ${isOwn ? 'bg-[#4D96FF] chat-bubble-right text-[#1A1A1A] border-4 border-[#1A1A1A]' : 'bg-white chat-bubble-left text-[#1A1A1A]'} font-bold">
      ${utils.escapeHtml(data.text || '')}
      <span class="message-meta text-[10px] mt-1 text-[#1A1A1A]">${time}</span>
    </div>
  `;

  els.messagesContainer.appendChild(div);
  els.messagesContainer.scrollTop = els.messagesContainer.scrollHeight;
}

function appendSystemMessage(text) {
  const div = document.createElement('div');
  div.className = 'system-message chat-bubble-anim';
  div.textContent = text.toUpperCase();
  els.messagesContainer.appendChild(div);
  els.messagesContainer.scrollTop = els.messagesContainer.scrollHeight;
}



// Start the app
init();
