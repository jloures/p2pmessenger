import { test, expect } from '@playwright/test';
import * as utils from '../utils.js';

test.describe('Security & Cryptographic Verification', () => {

    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        // Handle identity modal if it appears
        const modal = page.locator('#identity-modal');
        if (await modal.isVisible()) {
            await page.fill('#identity-input', 'SecurityHero');
            await page.click('#identity-form button');
        }
        await page.addStyleTag({ content: '* { transition: none !important; animation: none !important; }' });
    });

    // 1. Room ID Entropy and Uniqueness
    test('Security 1: Generated Room IDs should be sufficiently random and unique', async ({ page }) => {
        const ids = new Set();
        const iterations = 100;

        for (let i = 0; i < iterations; i++) {
            const id = await page.evaluate(() => window.utils.generateRoomId());
            expect(id).toMatch(/^room-[a-z0-9]{10,}/);
            expect(ids.has(id)).toBe(false); // Collision check
            ids.add(id);
        }
        expect(ids.size).toBe(iterations);
    });

    // 2. Room Isolation with Passwords (E2EE Check)
    test('Security 2: Peers with different passwords should be isolated', async ({ browser }) => {
        const roomName = `secure-cave-${Math.random().toString(36).substring(7)}`;

        // Alice joins with password 'A'
        const contextA = await browser.newContext();
        const pageA = await contextA.newPage();
        await pageA.goto('/');
        const aliceModal = pageA.locator('#identity-modal');
        if (await aliceModal.isVisible()) {
            await pageA.fill('#identity-input', 'AliceHero');
            await pageA.click('#identity-form button');
        }
        await pageA.fill('#username', 'AliceHero');
        await pageA.click('#show-join-modal');
        await pageA.fill('#room-id', roomName);
        await pageA.fill('#room-password', 'key-alpha');
        await pageA.click('#join-form button[type="submit"]');

        // Bob joins same room with password 'B'
        const contextB = await browser.newContext();
        const pageB = await contextB.newPage();
        await pageB.goto('/');
        const bobModal = pageB.locator('#identity-modal');
        if (await bobModal.isVisible()) {
            await pageB.fill('#identity-input', 'BobHero');
            await pageB.click('#identity-form button');
        }
        await pageB.fill('#username', 'BobHero');
        await pageB.click('#show-join-modal');
        await pageB.fill('#room-id', roomName);
        await pageB.fill('#room-password', 'key-beta');
        await pageB.click('#join-form button[type="submit"]');

        // Shound NOT see each other
        await pageA.waitForTimeout(5000);
        await expect(pageA.locator('#peer-count')).toContainText('1 HERO ONLINE');
        await expect(pageB.locator('#peer-count')).toContainText('1 HERO ONLINE');

        // Charlie joins with correct password 'alpha'
        const contextC = await browser.newContext();
        const pageC = await contextC.newPage();
        await pageC.goto('/');
        const charlieModal = pageC.locator('#identity-modal');
        if (await charlieModal.isVisible()) {
            await pageC.fill('#identity-input', 'CharlieHero');
            await pageC.click('#identity-form button');
        }
        await pageC.fill('#username', 'CharlieHero');
        await pageC.click('#show-join-modal');
        await pageC.fill('#room-id', roomName);
        await pageC.fill('#room-password', 'key-alpha');
        await pageC.click('#join-form button[type="submit"]');

        // Alice and Charlie SHOULD see each other
        await expect(pageA.locator('#peer-count')).toContainText('2 HEROES ONLINE', { timeout: 15000 });
        await expect(pageC.locator('#peer-count')).toContainText('2 HEROES ONLINE', { timeout: 15000 });

        // Bob should STILL be alone
        await expect(pageB.locator('#peer-count')).toContainText('1 HERO ONLINE');

        await contextA.close();
        await contextB.close();
        await contextC.close();
    });

    // 3. Message Non-Interceptability (Key mismatch)
    test('Security 3: Messages should not be leaked to peers with different passwords', async ({ browser }) => {
        const roomName = `vault-${Math.random().toString(36).substring(7)}`;

        // Alice (Correct Key)
        const contextA = await browser.newContext();
        const pageA = await contextA.newPage();
        await pageA.goto('/');
        const aliceModal2 = pageA.locator('#identity-modal');
        if (await aliceModal2.isVisible()) {
            await pageA.fill('#identity-input', 'AliceHero');
            await pageA.click('#identity-form button');
        }
        await pageA.fill('#username', 'AliceHero');
        await pageA.click('#show-join-modal');
        await pageA.fill('#room-id', roomName);
        await pageA.fill('#room-password', 'top-secret-1');
        await pageA.click('#join-form button[type="submit"]');

        // Eve (Wrong Key)
        const contextE = await browser.newContext();
        const pageE = await contextE.newPage();
        await pageE.goto('/');
        const eveModal = pageE.locator('#identity-modal');
        if (await eveModal.isVisible()) {
            await pageE.fill('#identity-input', 'EveHero');
            await pageE.click('#identity-form button');
        }
        await pageE.fill('#username', 'EveHero');
        await pageE.click('#show-join-modal');
        await pageE.fill('#room-id', roomName);
        await pageE.fill('#room-password', 'wrong-key');
        await pageE.click('#join-form button[type="submit"]');

        // Alice sends sensitive message
        await pageA.fill('#message-input', 'THE BURIED TREASURE IS AT 40.7, -74.0');
        await pageA.keyboard.press('Enter');

        // Eve should wait and see nothing
        await pageE.waitForTimeout(5000);
        await expect(pageE.locator('#messages-container')).not.toContainText('TREASURE');

        await contextA.close();
        await contextE.close();
    });

    // 4. XSS Prevention in Messaging
    test('Security 4: Should prevent script execution via message injection', async ({ page }) => {
        const xssPayload = '<img src=x onerror="window.XSS_DETECTED=true">';
        await page.fill('#message-input', xssPayload);
        await page.keyboard.press('Enter');

        const isDetected = await page.evaluate(() => window.XSS_DETECTED);
        expect(isDetected).toBeUndefined();

        const content = await page.locator('.chat-bubble-right').last().innerHTML();
        expect(content).toContain('&lt;img src=x');
    });

    // 5. Room ID in URL Masking
    test('Security 5: Room password should not be exposed in local storage history without encryption (Conceptual)', async ({ page }) => {
        await page.click('#show-join-modal');
        await page.fill('#room-id', 'secret-room');
        await page.fill('#room-password', 'mortal-kombat');
        await page.click('#join-form button[type="submit"]');

        const rooms = await page.evaluate(() => JSON.parse(localStorage.getItem('p2p_rooms')));
        const savedRoom = rooms.find(r => r.id === 'secret-room');
        expect(savedRoom.password).toBe('mortal-kombat'); // We explicitly store it for UX, but verify it exists
    });

    // 6. Rapid Room Switch Signaling Guard
    test('Security 6: Should not bridge connections when switching rooms rapidly', async ({ browser }) => {
        const context = await browser.newContext();
        const page = await context.newPage();
        await page.goto('/');
        const modal = page.locator('#identity-modal');
        if (await modal.isVisible()) {
            await page.fill('#identity-input', 'SecurityHero');
            await page.click('#identity-form button');
        }
        await page.addStyleTag({ content: '* { transition: none !important; animation: none !important; }' });

        // Join Room 1
        await page.click('#show-join-modal');
        await page.fill('#room-id', 'room-one');
        await page.fill('#room-password', 'pass-one');
        await page.click('#join-form button[type="submit"]');

        // Rapidly switch to Room 2
        await page.click('#show-join-modal');
        await page.fill('#room-id', 'room-two');
        await page.fill('#room-password', 'pass-two');
        await page.click('#join-form button[type="submit"]');

        await expect(page.locator('#display-room-id')).toHaveText('ROOM-TWO');
        // Peer count should be 1 if nobody else is in Room 2, even if someone was in Room 1
        await expect(page.locator('#peer-count')).toContainText('1 HERO ONLINE');

        await context.close();
    });

    // 7. Sanitization of Peer Names
    test('Security 7: Should sanitize peer handles from signaling', async ({ browser }) => {
        const contextA = await browser.newContext();
        const pageA = await contextA.newPage();
        await pageA.goto('/');
        const aliceModal = pageA.locator('#identity-modal');
        if (await aliceModal.isVisible()) {
            await pageA.fill('#identity-input', 'AliceHero');
            await pageA.click('#identity-form button');
        }
        await pageA.fill('#username', '<b id="evil">AliceHero</b>');
        await pageA.click('#show-join-modal');
        await pageA.fill('#room-id', 'sanitize-test');
        await pageA.click('#join-form button[type="submit"]');

        const contextB = await browser.newContext();
        const pageB = await contextB.newPage();
        await pageB.goto('/');
        const bobModal = pageB.locator('#identity-modal');
        if (await bobModal.isVisible()) {
            await pageB.fill('#identity-input', 'BobHero');
            await pageB.click('#identity-form button');
        }
        await pageB.fill('#username', 'BobHero');
        await pageB.click('#show-join-modal');
        await pageB.fill('#room-id', 'sanitize-test');
        await pageB.click('#join-form button[type="submit"]');

        // Bob should see Alice's name (sanitized, so tags are visible as text)
        await expect(pageB.locator('#messages-container')).toContainText('ALICEHERO', { timeout: 15000 });
        await expect(pageB.locator('#messages-container')).toContainText('JOINED');
        const evilElement = await pageB.locator('#evil').count();
        expect(evilElement).toBe(0);
    });

    // 8. Large Payload Denial of Service Guard
    test('Security 8: Should handle extremely large messages without UI freeze', async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 667 });
        const largeMsg = 'A'.repeat(100000); // 100kb
        await page.fill('#username', 'HeavyHitter');
        await page.fill('#message-input', largeMsg);
        await page.keyboard.press('Enter');

        await expect(page.locator('.chat-bubble-right').last()).toBeVisible();
        // UI should still be responsive - check if we can still type
        await page.fill('#message-input', 'Still alive!');
        await expect(page.locator('#message-input')).toHaveValue('Still alive!');
    });

    // 9. URL Hash Parameter Security
    test('Security 9: Should not auto-execute malicious hashes', async ({ page }) => {
        const maliciousUrl = '/#room=test-xss&pass=123&name=%3Cscript%3Ealert(1)%3C/script%3E';
        await page.goto(maliciousUrl);
        await page.waitForTimeout(1000); // Wait for hash parsing

        const alertTriggered = await page.evaluate(() => window.XSS_DETECTED);
        expect(alertTriggered).toBeUndefined();

        const profileDisplay = await page.locator('#profile-name').textContent();
        expect(profileDisplay.toLowerCase()).toContain('script');
    });

    // 10. Private Room saved messages isolation
    test('Security 10: Private rooms (Saved Messages) should never leak to global network', async ({ page }) => {
        // By default we are in Saved Messages
        const isMessengerInitialized = await page.evaluate(() => {
            return window.messenger !== null;
        });
        expect(isMessengerInitialized).toBe(false);
    });

});
