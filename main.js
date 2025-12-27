import { Buffer } from 'https://esm.sh/buffer@6.0.3';
window.Buffer = Buffer;
import QRCode from 'https://esm.sh/qrcode@1.5.1';

import { P2PMessenger } from './p2p.js';
import * as utils from './utils.js';

// 1. CONFIG
const APP_ID = 'p2pmsg-v2';

// 2. STATE
window.P2PMessenger = P2PMessenger;
window.messenger = null; // Exposed for testing/debugging
let messenger = null; // Will be initialized per room

// No migration needed as we don't persist data anymore

let rooms = [{ id: 'self-messages', name: 'Self-Messages', icon: '⭐', isPrivate: true, lastRead: Date.now() }];
let activeRoomId = 'self-messages';
let roomMessages = {};

// Expose for testing/debugging
window.utils = utils;

// 3. DOM ELEMENTS
const getEl = (id) => document.getElementById(id);

const els = {
  sidebar: getEl('sidebar'),
  sidebarToggle: getEl('sidebar-toggle'),
  roomList: getEl('room-list'),
  displayUsername: getEl('display-username'),
  editProfileBtn: getEl('edit-profile-btn'),
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
  leaveBtn: getEl('leave-btn'),
  mainContent: document.querySelector('main'),
  sidebarBackdrop: getEl('sidebar-backdrop'),
  identityModal: getEl('identity-modal'),
  identityForm: getEl('identity-form'),
  identityInput: getEl('identity-input'),
  shareBtn: getEl('share-room-btn'),
  shareModal: getEl('share-modal'),
  closeShareModal: getEl('close-share-modal'),
  qrContainer: getEl('qrcode-container'),
  copyInviteBtn: getEl('copy-invite-btn'),
};

let myHandle = '';

// 4. INIT
function init() {
  if (myHandle.length < 4) {
    els.identityModal.classList.remove('hidden');
  } else {
    els.identityModal.classList.add('hidden');
    updatePersonalRoomName();
  }

  if (els.displayUsername) els.displayUsername.textContent = (myHandle || 'HERO').toUpperCase();
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
    if (els.displayUsername) els.displayUsername.textContent = myHandle.toUpperCase();
    if (myHandle.length >= 4) {
      els.identityModal.classList.add('hidden');
      updatePersonalRoomName();
    }
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
    if (window.innerWidth < 640) {
      const isOpen = els.sidebar.classList.toggle('open');
      els.sidebarBackdrop.classList.toggle('hidden', !isOpen);
    } else {
      els.sidebar.classList.toggle('collapsed');
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

  els.editProfileBtn.addEventListener('click', () => {
    els.identityInput.value = myHandle;
    els.identityModal.classList.remove('hidden');
  });

  els.identityForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const val = els.identityInput.value.trim();
    if (val.length >= 4) {
      myHandle = val;
      if (els.displayUsername) els.displayUsername.textContent = myHandle.toUpperCase();
      // No localStorage saving
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
    if (activeRoomId === 'self-messages') return;
    removeRoom(activeRoomId);
  });

  els.shareBtn.addEventListener('click', async () => {
    const room = rooms.find(r => r.id === activeRoomId);
    if (!room || room.isPrivate) return;

    const shareUrl = `${window.location.origin}${window.location.pathname}#room=${room.id}&pass=${room.password || ''}`;

    // Clear previous QR
    els.qrContainer.innerHTML = '';

    // Generate QR
    try {
      const canvas = await QRCode.toCanvas(shareUrl, {
        width: 200,
        margin: 0,
        color: {
          dark: '#1A1A1A',
          light: '#FFFFFF'
        }
      });
      els.qrContainer.appendChild(canvas);
      els.shareModal.classList.remove('hidden');
    } catch (err) {
      console.error(err);
    }
  });

  els.closeShareModal.addEventListener('click', () => {
    els.shareModal.classList.add('hidden');
  });

  els.copyInviteBtn.addEventListener('click', () => {
    const room = rooms.find(r => r.id === activeRoomId);
    if (!room) return;

    const shareUrl = `${window.location.origin}${window.location.pathname}#room=${room.id}&pass=${room.password || ''}`;
    navigator.clipboard.writeText(shareUrl);

    const originalText = els.copyInviteBtn.innerHTML;
    els.copyInviteBtn.innerHTML = 'COPIED! ✅';
    setTimeout(() => els.copyInviteBtn.innerHTML = originalText, 2000);
  });

  window.addEventListener('hashchange', refreshFromHash);
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
    `;

    btn.addEventListener('click', (e) => {
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
  const sanitizedId = utils.sanitizeRoomName(id);
  const sanitizedName = name.substring(0, utils.MAX_ROOM_ID_LENGTH);
  if (rooms.find(r => r.id === sanitizedId)) return;
  rooms.push({ id: sanitizedId, name: sanitizedName, password, icon: '💬' });
  saveRooms();
  renderRoomList();
}

function removeRoom(id) {
  rooms = rooms.filter(r => r.id !== id);
  saveRooms();
  renderRoomList();
  switchRoom('self-messages');
}

function updatePersonalRoomName() {
  // We do NOT rename the self-messages room anymore.
  // We ONLY update the handle in the variable and UI header.
  if (els.displayUsername) els.displayUsername.textContent = (myHandle || 'HERO').toUpperCase();
}

function saveRooms() {
  // No-op: Persistence removed
}

function saveMessages() {
  // No-op: Persistence removed
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
  const isPersonal = id === 'self-messages';

  // Explicitly set display instead of relying on class alone to ensure it works
  els.shareBtn.style.display = isPersonal ? 'none' : 'flex';
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
  const isPrivate = activeRoomId === 'self-messages';
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
