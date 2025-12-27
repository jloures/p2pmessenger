import { test, expect } from '@playwright/test';

test.describe('P2P Messenger End-to-End Journeys', () => {

    test('Complete User Journey: Create -> Share -> Chat -> Leave', async ({ browser }) => {
        // 1. Alice creates a room
        const aliceContext = await browser.newContext();
        await aliceContext.grantPermissions(['clipboard-read', 'clipboard-write']);
        const alicePage = await aliceContext.newPage();
        await alicePage.goto('/');
        const aliceModal = alicePage.locator('#identity-modal');
        if (await aliceModal.isVisible()) {
            await alicePage.fill('#identity-input', 'Alice');
            await alicePage.click('#identity-form button');
        }
        await alicePage.addStyleTag({ content: '* { transition: none !important; animation: none !important; }' });

        const roomName = `e2e-room-${Math.random().toString(36).substring(7)}`;
        await alicePage.click('#edit-profile-btn');
        await alicePage.fill('#identity-input', 'Alice');
        await alicePage.click('#identity-form button');
        await alicePage.click('#show-join-modal');
        await alicePage.fill('#room-id', roomName);
        await alicePage.click('#join-form button[type="submit"]');

        // Alice is in
        await expect(alicePage.locator('#display-room-id')).toHaveText(roomName.toUpperCase());
        await expect(alicePage.locator('#peer-count')).toContainText('1 HERO ONLINE', { timeout: 30000 });

        // 2. Alice copies the link via Share Modal
        await alicePage.click('#share-room-btn');
        await alicePage.click('#copy-invite-btn');
        const shareLink = await alicePage.evaluate(() => navigator.clipboard.readText());
        expect(shareLink).toContain(`#room=${roomName}`);
        expect(shareLink).toContain(`&creator=`);

        // 3. Bob joins using the share link
        const bobContext = await browser.newContext();
        const bobPage = await bobContext.newPage();
        await bobPage.setViewportSize({ width: 1280, height: 720 });
        await bobPage.goto(`${shareLink}&name=BobTheHero`);
        await bobPage.addStyleTag({ content: '* { transition: none !important; animation: none !important; }' });

        await expect(bobPage.locator('#display-room-id')).toHaveText(roomName.toUpperCase());
        await bobPage.click('#edit-profile-btn');
        await bobPage.fill('#identity-input', 'BobTheHero');
        await bobPage.click('#identity-form button');

        // 4. Verification of Connection
        await expect(alicePage.locator('#peer-count')).toContainText('2 HEROES ONLINE', { timeout: 45000 });
        await expect(bobPage.locator('#peer-count')).toContainText('2 HEROES ONLINE', { timeout: 45000 });

        // 5. Chat Exchange
        await alicePage.fill('#message-input', 'Hey Bob, is this secure?');
        await alicePage.keyboard.press('Enter');

        await expect(bobPage.locator('.chat-bubble-left')).toContainText('Hey Bob, is this secure?', { timeout: 15000 });

        await bobPage.fill('#message-input', 'Totally! No servers involved. 🚀');
        await bobPage.keyboard.press('Enter');

        await expect(alicePage.locator('.chat-bubble-left')).toContainText('Totally! No servers involved.', { timeout: 15000 });

        // 6. Leaving the Room
        await bobPage.evaluate(() => document.getElementById('leave-btn').click());
        // Bob should be back in Self Messages
        await expect(bobPage.locator('#display-room-id')).toContainText('SELF-MESSAGES', { timeout: 10000 });

        // Alice should see Bob left
        await expect(alicePage.locator('#peer-count')).toContainText('1 HERO ONLINE', { timeout: 30000 });
        await expect(alicePage.locator('#messages-container')).toContainText('BOBTHEHERO LEFT', { timeout: 15000 });

        await aliceContext.close();
        await bobContext.close();
    });

    test('E2EE Security: Peers with different keys should not connect', async ({ browser }) => {
        const roomName = `secure-room-${Math.random().toString(36).substring(7)}`;

        // Alice joins with password 'A'
        const contextA = await browser.newContext();
        await contextA.grantPermissions(['clipboard-write', 'clipboard-read']);
        const pageA = await contextA.newPage();
        await pageA.goto('/');
        const aliceModal = pageA.locator('#identity-modal');
        if (await aliceModal.isVisible()) {
            await pageA.fill('#identity-input', 'AliceHero');
            await pageA.click('#identity-form button');
        }
        await pageA.addStyleTag({ content: '* { transition: none !important; animation: none !important; }' });
        await pageA.click('#edit-profile-btn');
        await pageA.fill('#identity-input', 'AliceHero');
        await pageA.click('#identity-form button');
        await pageA.click('#show-join-modal');
        await pageA.fill('#room-id', roomName);
        await pageA.fill('#room-password', 'password-A');
        await pageA.click('#join-form button[type="submit"]');

        // Get Share Link from Alice so Bob joins the SAME topic/creator
        await pageA.click('#share-room-btn');
        // We can just grab it from clipboard or construct it if we knew the ID, but clipboard is safe
        await pageA.click('#copy-invite-btn');
        let shareLink = await pageA.evaluate(() => navigator.clipboard.readText());

        // Construct Bob's link: use Alice's link but with HIS password (or no password, but test says different keys)
        // Alice's link has &pass=password-A. We must replace it with password-B to simulate mismatch.
        shareLink = shareLink.replace('pass=password-A', 'pass=password-B');

        // Bob joins same room (Topic) but with different Password 'B'
        const contextB = await browser.newContext();
        await contextB.grantPermissions(['clipboard-write', 'clipboard-read']);
        const pageB = await contextB.newPage();
        await pageB.goto(shareLink);

        const bobModal = pageB.locator('#identity-modal');
        if (await bobModal.isVisible()) {
            await pageB.fill('#identity-input', 'BobHero');
            await pageB.click('#identity-form button');
        }
        await pageB.addStyleTag({ content: '* { transition: none !important; animation: none !important; }' });
        await pageB.click('#edit-profile-btn');
        await pageB.fill('#identity-input', 'BobHero');
        await pageB.click('#identity-form button');

        // Wait for connection attempt.
        // Trystero/Nostr behavior: Peers with different passwords (keys) DO NOT complete handshake.
        // Therefore, they should NOT see each other.
        await pageA.waitForTimeout(5000);
        await expect(pageA.locator('#peer-count')).toContainText('1 HERO ONLINE');
        await expect(pageB.locator('#peer-count')).toContainText('1 HERO ONLINE');

        await contextA.close();
        await contextB.close();
    });
});
