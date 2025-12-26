/**
 * ToonChat Utility Toolkit
 */

export const escapeHtml = (text) => {
    if (!text) return '';
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
};

export const generateRoomId = () => {
    return 'room-' + Math.random().toString(36).substring(2, 9);
};

export const formatTime = (timestamp) => {
    try {
        return new Date(timestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch (e) {
        return '--:--';
    }
};

export const validateHandle = (handle) => {
    if (!handle) return false;
    const trimmed = handle.trim();
    return trimmed.length >= 2 && trimmed.length <= 20;
};

export const validateRoomId = (roomId) => {
    if (!roomId) return false;
    const trimmed = roomId.trim();
    return trimmed.length >= 3 && trimmed.length <= 30;
};

export const parseHashParams = (hash) => {
    if (!hash) return {};
    const params = new URLSearchParams(hash.substring(1));
    return {
        room: params.get('room') || '',
        pass: params.get('pass') || '',
        name: params.get('name') || ''
    };
};

export const getInitials = (name) => {
    if (!name) return '??';
    return name
        .trim()
        .split(' ')
        .map(n => n[0])
        .join('')
        .substring(0, 2)
        .toUpperCase();
};

export const truncate = (text, length = 50) => {
    if (!text || text.length <= length) return text;
    return text.substring(0, length) + '...';
};

export const isSystemMessage = (data) => {
    return data && (data.type === 'handshake' || data.type === 'handshake-reply');
};

export const sanitizeRoomName = (name) => {
    if (!name) return '';
    return name.toLowerCase().replace(/[^a-z0-9-]/g, '-').substring(0, 30);
};
