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
// SCHEMA MIGRATION & INITIALIZATION
const DATA_VERSION = '2';
function migrateData() {
  const currentVersion = localStorage.getItem('p2p_version');
  if (currentVersion !== DATA_VERSION) {
    console.log(`Migrating data from ${currentVersion || 'v1'} to v2...`);

    // Example Migration: Add lastRead to rooms
    let savedRooms = [];
    try {
      savedRooms = JSON.parse(localStorage.getItem('p2p_rooms')) || [];
      savedRooms = savedRooms.map(room => ({
        ...room,
        lastRead: room.lastRead || Date.now()
      }));
      localStorage.setItem('p2p_rooms', JSON.stringify(savedRooms));
    } catch (e) {
      console.warn('Migration failed or no rooms to migrate');
    }

    localStorage.setItem('p2p_version', DATA_VERSION);
  }
}
migrateData();

let rooms = [];
try {
  rooms = JSON.parse(localStorage.getItem('p2p_rooms'));
  if (!rooms || rooms.length === 0) {
    rooms = [{ id: 'saved-messages', name: 'Personal Channel', icon: '⭐', isPrivate: true, lastRead: Date.now() }];
  }
} catch (e) {
  rooms = [{ id: 'saved-messages', name: 'Personal Channel', icon: '⭐', isPrivate: true, lastRead: Date.now() }];
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
  mainContent: document.querySelector('main'),
  sidebarBackdrop: getEl('sidebar-backdrop'),
  identityModal: getEl('identity-modal'),
  identityForm: getEl('identity-form'),
  identityInput: getEl('identity-input'),
};

let myHandle = localStorage.getItem('p2p_handle') || '';

// 4. INIT
function init() {
  if (myHandle.length < 4) {
    els.identityModal.classList.remove('hidden');
  } else {
    els.identityModal.classList.add('hidden');
    updatePersonalRoomName();
  }

  els.usernameInput.value = myHandle;
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
  els.sidebarToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = els.sidebar.classList.toggle('open');
    if (window.innerWidth < 640) {
      els.sidebarBackdrop.classList.toggle('hidden', !isOpen);
    }
  });

  // Close sidebar when clicking backdrop on mobile
  els.sidebarBackdrop.addEventListener('click', () => {
    els.sidebar.classList.remove('open');
    els.sidebarBackdrop.classList.add('hidden');
  });

  // Close sidebar when clicking any main content (backup)
  els.mainContent.addEventListener('click', (e) => {
    if (window.innerWidth < 640 && els.sidebar.classList.contains('open')) {
      // Don't close if Clicking the toggle itself (handled above)
      if (!els.sidebarToggle.contains(e.target)) {
        els.sidebar.classList.remove('open');
        els.sidebarBackdrop.classList.add('hidden');
      }
    }
  });

  els.usernameInput.addEventListener('input', (e) => {
    const val = e.target.value.trim();
    if (val.length >= 4) {
      myHandle = val;
      updatePersonalRoomName();
      localStorage.setItem('p2p_handle', myHandle);
    }
  });

  els.identityForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const val = els.identityInput.value.trim();
    if (val.length >= 4) {
      myHandle = val;
      els.usernameInput.value = myHandle;
      updatePersonalRoomName();
      localStorage.setItem('p2p_handle', myHandle);
      els.identityModal.classList.add('hidden');
    }
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
      if (window.innerWidth < 640) {
        els.sidebar.classList.remove('open');
        els.sidebarBackdrop.classList.add('hidden');
      }
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
    setTimeout(() => els.copyBtn.textContent = 'LINK 🔗', 2000);
  });

  window.addEventListener('hashchange', refreshFromHash);

  // Sync across tabs
  window.addEventListener('storage', (e) => {
    if (e.key === 'p2p_handle') {
      myHandle = e.newValue || '';
      els.usernameInput.value = myHandle;
      updatePersonalRoomName();
    }
    if (e.key === 'p2p_rooms') {
      const oldActiveRoomId = activeRoomId;
      try {
        rooms = JSON.parse(e.newValue) || [];
      } catch (err) {
        rooms = [];
      }
      renderRoomList();

      // If our active room was deleted in another tab, kick us back to personal
      const stillExists = rooms.some(r => r.id === activeRoomId);
      if (!stillExists && activeRoomId !== 'saved-messages') {
        switchRoom('saved-messages');
      } else if (activeRoomId === oldActiveRoomId) {
        // Refresh header in case of rename
        const room = rooms.find(r => r.id === activeRoomId);
        if (room) {
          els.displayRoomId.textContent = (room.name || room.id).toUpperCase();
        }
      }
    }
    if (e.key === 'p2p_messages') {
      try {
        roomMessages = JSON.parse(e.newValue) || {};
      } catch (err) {
        roomMessages = {};
      }
      // If we are in a room, refresh the view to show new messages from other tab
      // Note: This won't double messages because saveAndAppendMessage already handles the active view
      // But it's good for history consistency
      if (activeRoomId) {
        const container = els.messagesContainer;
        const scrollPos = container.scrollTop;
        const atBottom = Math.abs(container.scrollHeight - container.scrollTop - container.clientHeight) < 50;

        container.innerHTML = '';
        const history = roomMessages[activeRoomId] || [];
        history.forEach(msg => appendMessageUI(msg, msg.isOwn));

        if (atBottom) {
          container.scrollTop = container.scrollHeight;
        } else {
          container.scrollTop = scrollPos;
        }
      }
    }
  });
}

// 6. ROOM MANAGEMENT
window.addRoom = addRoom;
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
        <div class="room-name truncate text-sm font-black">${room.name}</div>
        <div class="text-[9px] truncate text-[#1A1A1A] opacity-50 uppercase font-black tracking-tighter">${room.id}</div>
      </div>
      ${!room.isPrivate ? `<button class="rename-btn text-[10px] w-6 h-6 rounded-lg opacity-0 bg-[#FFD93D] border-2 border-[#1A1A1A] group-hover:opacity-100 transition-opacity" data-id="${room.id}" aria-label="Rename room ${room.name}">✏️</button>` : ''}
    `;

    btn.addEventListener('click', (e) => {
      if (e.target.classList.contains('rename-btn')) {
        const newName = prompt('Enter new name for room:', room.name);
        if (newName) renameRoom(room.id, newName);
        return;
      }
      switchRoom(room.id);
      if (window.innerWidth < 640) {
        els.sidebar.classList.remove('open');
        els.sidebarBackdrop.classList.add('hidden');
      }
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
  if (id === 'saved-messages') return; // Cannot rename personal room here
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

function updatePersonalRoomName() {
  const personalRoom = rooms.find(r => r.id === 'saved-messages');
  if (personalRoom) {
    personalRoom.name = myHandle || 'Personal';
    saveRooms();
    renderRoomList();
    if (activeRoomId === 'saved-messages') {
      switchRoom(activeRoomId);
    }
  }
}

function saveRooms() {
  try {
    localStorage.setItem('p2p_rooms', JSON.stringify(rooms));
  } catch (e) {
    if (e.name === 'QuotaExceededError') {
      console.error('LocalStorage quota exceeded! Cannot save rooms.');
      appendSystemMessage('Memory full! Older chats might not be saved.');
    }
  }
}

function saveMessages() {
  try {
    localStorage.setItem('p2p_messages', JSON.stringify(roomMessages));
  } catch (e) {
    if (e.name === 'QuotaExceededError') {
      console.error('LocalStorage quota exceeded! Cannot save messages.');
      // Cleanup strategy: could delete oldest room messages here
      appendSystemMessage('Memory full! Cleaning up old messages...');
      const roomIds = Object.keys(roomMessages);
      if (roomIds.length > 0) {
        delete roomMessages[roomIds[0]];
        saveMessages();
      }
    }
  }
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
  const baseStatus = room?.isPrivate ? '' : 'CONNECTING...';
  els.peerCount.textContent = idSubtitle ? `${idSubtitle} ${baseStatus ? '• ' + baseStatus : ''}` : baseStatus;

  // Toggle visibility of share/exit buttons for personal room
  const isPersonal = id === 'saved-messages';

  // Explicitly set display instead of relying on class alone to ensure it works
  els.copyBtn.style.display = isPersonal ? 'none' : 'flex';
  els.leaveBtn.style.display = isPersonal ? 'none' : 'flex';

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
  saveMessages();

  if (activeRoomId === roomId) {
    appendMessageUI(data, isOwn);

    // Performance: Trim DOM if it exceeds buffer
    const allMessages = els.messagesContainer.querySelectorAll('.chat-bubble-anim, .system-message');
    if (allMessages.length > 50) {
      allMessages[0].remove();
    }
  }
}

function appendMessageUI(data, isOwn) {
  const div = document.createElement('div');
  div.className = `flex flex-col ${isOwn ? 'items-end ml-auto' : 'items-start'} max-w-[85%] w-full chat-bubble-anim`;

  const time = utils.formatTime(data.timestamp);
  const sender = isOwn ? 'You' : utils.escapeHtml(data.sender || 'Hero');

  div.innerHTML = `
    <span class="${isOwn ? 'mr-3' : 'ml-3'} mb-1.5 text-[10px] font-black uppercase text-[#1A1A1A] opacity-60 tracking-widest">${sender}</span>
    <div class="${isOwn ? 'chat-bubble-right' : 'chat-bubble-left'}">
      <div class="text-sm md:text-base">${utils.escapeHtml(data.text || '')}</div>
      <span class="message-meta">${time}</span>
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
