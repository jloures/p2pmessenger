import { test, expect } from '@playwright/test';

test.describe('Limit Enforcement Tests', () => {

    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        // Handle identity modal if it appears
        const modal = page.locator('#identity-modal');
        if (await modal.isVisible()) {
            await page.fill('#identity-input', 'TestHero');
            await page.click('#identity-form button');
        }
    });

    test('Enforcement: Room ID input should have maxlength 30', async ({ page }) => {
        await page.click('#show-join-modal');
        const roomIdInput = page.locator('#room-id');
        await expect(roomIdInput).toHaveAttribute('maxlength', '30');
    });

    test('Enforcement: Identity input should have maxlength 20', async ({ page }) => {
        await page.click('#edit-profile-btn');
        const identityInput = page.locator('#identity-input');
        await expect(identityInput).toHaveAttribute('maxlength', '20');
    });

    test('Enforcement: Should not be able to enter more than 30 chars in Room ID', async ({ page }) => {
        await page.click('#show-join-modal');
        const roomIdInput = page.locator('#room-id');
        const longId = 'A'.repeat(50);
        await roomIdInput.fill(longId);
        const value = await roomIdInput.inputValue();
        expect(value.length).toBe(30);
    });

    test('Enforcement: Should not be able to enter more than 20 chars in Identity', async ({ page }) => {
        await page.click('#edit-profile-btn');
        const identityInput = page.locator('#identity-input');
        const longName = 'B'.repeat(50);
        await identityInput.fill(longName);
        const value = await identityInput.inputValue();
        expect(value.length).toBe(20);
    });

    test('Enforcement: Programmatic addRoom should still truncate (via JS)', async ({ page }) => {
        await page.evaluate(() => {
            window.addRoom('very-long-room-id-that-exceeds-thirty-characters-limit', 'Very Long Room Name');
        });
        const roomItem = page.locator('.room-item').last();
        const roomNameText = await roomItem.locator('.room-name').textContent();
        expect(roomNameText.length).toBeLessThanOrEqual(30);

        const technicalIdText = await roomItem.locator('div:nth-child(2) > div:nth-child(2)').textContent();
        expect(technicalIdText.length).toBeLessThanOrEqual(30);
    });
});
