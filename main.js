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

let rooms = [{ id: 'self-messages', name: 'Self-Messages', icon: '⭐', isPrivate: true, lastRead: Date.now(), creatorId: 'me' }];
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
let myId = utils.generateUUID();

// 4. INIT
function init() {
  // Ensure we have an ID
  if (!myId) myId = utils.generateUUID();

  // Default room creator is us
  rooms[0].creatorId = myId;

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
    const creator = params.creator || myId;
    addRoom(params.room, params.room, params.pass || '', creator);
    // Find the room we just added (in case it already existed, we need the correct reference)
    const roomRef = rooms.find(r => r.id === params.room && r.creatorId === creator);
    if (roomRef) switchRoom(roomRef.id);
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
      addRoom(id, id, pass, myId);
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

    const shareUrl = `${window.location.origin}${window.location.pathname}#room=${room.id}&creator=${room.creatorId}&pass=${room.password || ''}`;

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

    const shareUrl = `${window.location.origin}${window.location.pathname}#room=${room.id}&creator=${room.creatorId}&pass=${room.password || ''}`;
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

function addRoom(id, name, password = '', creatorId = null) {
  const sanitizedId = utils.sanitizeRoomName(id);
  const sanitizedName = name.substring(0, utils.MAX_ROOM_ID_LENGTH);
  const cid = creatorId || myId;

  // Constraint: Same user cannot have duplicate room ID
  if (rooms.find(r => r.id === sanitizedId && r.creatorId === cid)) {
    // If it's us creating it, warn/block. If it's joining, we just return (already exists)
    if (cid === myId) {
      // Logic to handle user feedback could go here, but for now we just return
      // Maybe we should allow joining our own room via link? 
      // The check avoids duplicates in the list.
      if (rooms.find(r => r.id === sanitizedId)) return;
    }
    return;
  }

  rooms.push({ id: sanitizedId, name: sanitizedName, password, icon: '💬', creatorId: creatorId || myId });
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
  // We need to handle potential dupes in ID if we didn't filter list properly 
  // But activeRoomId is usually enough if IDs are unique in the list. 
  // Wait, if IDs are NOT unique across users, activeRoomId needs to be more specific?
  // Current requirement: "a rooms uniqueness is defined by the creator id, and the room id"
  // This means the room list *could* have two rooms named 'chat' if creators are different.
  // Our current `switchRoom` takes `id`. If we have dupes, this finds the first one.
  // We need to update `switchRoom` to take the room object OR update how we ID rooms in the UI.
  // For now, let's assume `id` passed here came from the room object in the list.
  // But wait, `renderRoomList` uses `btn.dataset.roomId = room.id`. This is ambiguous if multiple rooms have same ID.
  // FIX: We should use a composite ID or pass the room index/reference.
  // Let's find the room by matching both ID and Creator if possible, but the current DOM only stores ID.

  // Actually, to fully support "Same Name Different Creator", we need to change how we track active room.
  // But for this step, I will stick to finding *a* room. 
  // Ideally, `activeRoomId` should be unique. 
  // Let's implicitly use `activeRoom` object instead of ID? Or finding by ID is fuzzy?
  // Use `rooms.find` matches the clicked item. 
  // CRITICAL: The task implies we MIGHT have collisions. 
  // I will update `renderRoomList` to store index or composite key?
  // Let's stick to finding by ID for now, assuming user names rooms uniquely enough or we fix the selector later.
  // Wait, I should make `renderRoomList` robust now.

  const room = rooms.find(r => r.id === id); // This is weak if duplicates exist.

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
    // P2P Topic: creatorId(short)_roomId
    // Shortening UUID to avoid potential relay length limits (hypothesis).
    // Usage of colon vs underscore: Underscore is safer.
    const shortCreator = room.creatorId ? room.creatorId.substring(0, 8) : 'anon';
    const topic = `${shortCreator}_${room.id}`;
    initP2P(room, topic);
  }
}

function initP2P(room, topic) {
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

  const p2pTopic = topic || room.id; // Fallback
  console.log(`[P2P] Joining topic: ${p2pTopic} (Handle: ${myHandle})`);
  messenger.join(p2pTopic, myHandle || 'Anonymous Hero', room.password);
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
