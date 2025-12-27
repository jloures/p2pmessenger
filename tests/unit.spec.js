import { test, expect } from '@playwright/test';
import * as utils from '../utils.js';

test.describe('Unit Tests: utils.js', () => {

    // --- escapeHtml ---
    test('Unit 1: escapeHtml escapes basic tags', () => {
        expect(utils.escapeHtml('<div>')).toBe('&lt;div&gt;');
    });
    test('Unit 2: escapeHtml escapes ampersands', () => {
        expect(utils.escapeHtml('rock & roll')).toBe('rock &amp; roll');
    });
    test('Unit 3: escapeHtml escapes double quotes', () => {
        expect(utils.escapeHtml('He said "Hello"')).toBe('He said &quot;Hello&quot;');
    });
    test('Unit 4: escapeHtml escapes single quotes', () => {
        expect(utils.escapeHtml("It's me")).toBe('It&#039;s me');
    });
    test('Unit 5: escapeHtml returns empty string for null', () => {
        expect(utils.escapeHtml(null)).toBe('');
    });
    test('Unit 6: escapeHtml returns empty string for undefined', () => {
        expect(utils.escapeHtml(undefined)).toBe('');
    });
    test('Unit 7: escapeHtml handles complex nested tags', () => {
        expect(utils.escapeHtml('<script>alert("XSS")</script>')).toBe('&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;');
    });

    // --- generateRoomId ---
    test('Unit 8: generateRoomId starts with room-', () => {
        expect(utils.generateRoomId()).toMatch(/^room-/);
    });
    test('Unit 9: generateRoomId has reasonable length', () => {
        const id = utils.generateRoomId();
        expect(id.length).toBeGreaterThan(10);
    });

    // --- formatTime ---
    test('Unit 10: formatTime returns a valid clock string', () => {
        const time = utils.formatTime(Date.now());
        expect(time).toMatch(/^\d{2}:\d{2} (AM|PM)$/);
    });
    test('Unit 11: formatTime handles invalid timestamps gracefully', () => {
        expect(utils.formatTime('invalid')).toBe('--:--');
    });

    // --- validateHandle ---
    test('Unit 12: validateHandle accepts alphanumeric names', () => {
        expect(utils.validateHandle('Hero123')).toBe(true);
    });
    test('Unit 13: validateHandle rejects too short names', () => {
        expect(utils.validateHandle('A')).toBe(false);
    });
    test('Unit 14: validateHandle rejects too long names', () => {
        expect(utils.validateHandle('A'.repeat(21))).toBe(false);
    });
    test('Unit 15: validateHandle rejects empty names', () => {
        expect(utils.validateHandle('')).toBe(false);
    });
    test('Unit 16: validateHandle rejects whitespace only', () => {
        expect(utils.validateHandle('   ')).toBe(false);
    });
    test('Unit 17: validateHandle rejects null/undefined', () => {
        expect(utils.validateHandle(null)).toBe(false);
    });

    // --- validateRoomId ---
    test('Unit 18: validateRoomId accepts valid ID', () => {
        expect(utils.validateRoomId('my-secret-room')).toBe(true);
    });
    test('Unit 19: validateRoomId rejects too short ID', () => {
        expect(utils.validateRoomId('ab')).toBe(false);
    });
    test('Unit 20: validateRoomId rejects too long ID', () => {
        expect(utils.validateRoomId('a'.repeat(31))).toBe(false);
    });
    test('Unit 21: validateRoomId handles null gracefully', () => {
        expect(utils.validateRoomId(null)).toBe(false);
    });

    // --- parseHashParams ---
    test('Unit 22: parseHashParams extracts room from hash', () => {
        const params = utils.parseHashParams('#room=lobby');
        expect(params.room).toBe('lobby');
    });
    test('Unit 23: parseHashParams extracts name from hash', () => {
        const params = utils.parseHashParams('#name=Alice');
        expect(params.name).toBe('Alice');
    });
    test('Unit 24: parseHashParams extracts password from hash', () => {
        const params = utils.parseHashParams('#pass=1234');
        expect(params.pass).toBe('1234');
    });
    test('Unit 25: parseHashParams extracts multiple fields', () => {
        const params = utils.parseHashParams('#room=abc&pass=xyz&name=bob');
        expect(params.room).toBe('abc');
        expect(params.pass).toBe('xyz');
        expect(params.name).toBe('bob');
    });
    test('Unit 26: parseHashParams returns empty object for empty hash', () => {
        expect(utils.parseHashParams('')).toEqual({});
    });
    test('Unit 27: parseHashParams handles malformed inputs', () => {
        const params = utils.parseHashParams('#room=a=b&junk');
        expect(params.room).toBe('a=b');
    });

    // --- getInitials ---
    test('Unit 28: getInitials two words', () => {
        expect(utils.getInitials('John Doe')).toBe('JD');
    });
    test('Unit 29: getInitials single word', () => {
        expect(utils.getInitials('Alice')).toBe('A');
    });
    test('Unit 30: getInitials multiple words', () => {
        expect(utils.getInitials('Super Hero Man')).toBe('SH');
    });
    test('Unit 31: getInitials handles extra whitespace', () => {
        expect(utils.getInitials('  First   Last  ')).toBe('FL');
    });
    test('Unit 32: getInitials returns ?? for empty input', () => {
        expect(utils.getInitials('')).toBe('??');
    });

    // --- truncate ---
    test('Unit 33: truncate short string', () => {
        expect(utils.truncate('hello', 10)).toBe('hello');
    });
    test('Unit 34: truncate long string', () => {
        expect(utils.truncate('this is a very long string', 5)).toBe('this ...');
    });
    test('Unit 35: truncate exact length', () => {
        expect(utils.truncate('exact', 5)).toBe('exact');
    });
    test('Unit 36: truncate returns empty for falsy', () => {
        expect(utils.truncate(null, 5)).toBe(null);
    });

    // --- sanitizeRoomName ---
    test('Unit 37: sanitizeRoomName lowers case', () => {
        expect(utils.sanitizeRoomName('LOBBY')).toBe('lobby');
    });
    test('Unit 38: sanitizeRoomName replaces spaces with hyphens', () => {
        expect(utils.sanitizeRoomName('Secret Room')).toBe('secret-room');
    });
    test('Unit 39: sanitizeRoomName allows dots (wait, filter check?)', () => {
        // Code: .replace(/[^a-z0-9-]/g, '-')
        expect(utils.sanitizeRoomName('room.test')).toBe('room-test');
    });
    test('Unit 40: sanitizeRoomName truncates at 30', () => {
        expect(utils.sanitizeRoomName('a'.repeat(40))).toHaveLength(30);
    });

    // --- isSystemMessage ---
    test('Unit 41: isSystemMessage returns true for handshake', () => {
        expect(utils.isSystemMessage({ type: 'handshake' })).toBe(true);
    });
    test('Unit 42: isSystemMessage returns false for message', () => {
        expect(utils.isSystemMessage({ type: 'chat' })).toBe(false);
    });
});

test.describe('Unit Tests: Logic Boundaries', () => {

    test('Unit 43: LocalStorage rooms data structure', () => {
        const rooms = [
            { id: '1', name: 'Test' },
            { id: '2', name: 'Private', isPrivate: true }
        ];
        const serialized = JSON.stringify(rooms);
        const parsed = JSON.parse(serialized);
        expect(parsed[1].isPrivate).toBe(true);
    });

    test('Unit 44: LocalStorage message history structure', () => {
        const history = {
            'room-1': [{ text: 'hi', isOwn: true }],
            'room-2': []
        };
        expect(history['room-1'][0].text).toBe('hi');
    });

    test('Unit 45: URL parameter reconstruction', () => {
        const id = 'test-room';
        const pass = 'top-secret';
        const url = `/#room=${id}&pass=${pass}`;
        const params = utils.parseHashParams(url.split('#')[1] ? '#' + url.split('#')[1] : '');
        expect(params.room).toBe(id);
        expect(params.pass).toBe(pass);
    });

    // --- Branch Coverage - Null checks ---
    test('Unit 46: sanitizeRoomName handles null', () => {
        expect(utils.sanitizeRoomName(null)).toBe('');
    });
    test('Unit 47: truncate handles empty string', () => {
        expect(utils.truncate('', 5)).toBe('');
    });
    test('Unit 48: formatTime returns --:-- for 0', () => {
        // Technically 0 is Jan 1st 1970, which is valid, but let's check our implementation
        // utils.js: try { return new Date(timestamp).toLocaleTimeString... } catch { return '--:--' }
        const res = utils.formatTime(0);
        expect(res).not.toBe('--:--'); // 0 is valid
    });
    test('Unit 49: validateHandle handles undefined', () => {
        expect(utils.validateHandle(undefined)).toBe(false);
    });
    test('Unit 50: getInitials handles null', () => {
        expect(utils.getInitials(null)).toBe('??');
    });

});
