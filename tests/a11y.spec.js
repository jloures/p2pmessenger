import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Accessibility (a11y) Audits', () => {

    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        const modal = page.locator('#identity-modal');
        if (await modal.isVisible()) {
            await page.fill('#identity-input', 'A11yHero');
            await page.click('#identity-form button');
        }
    });

    // 1. Full Page Automated Audit
    test('A11y 1: Main page should have no automatically detectable a11y violations', async ({ page }) => {
        const accessibilityScanResults = await new AxeBuilder({ page }).analyze();
        expect(accessibilityScanResults.violations).toEqual([]);
    });

    // 2. Join Modal Automated Audit
    test('A11y 2: Join room modal should have no a11y violations', async ({ page }) => {
        await page.click('#show-join-modal');
        await page.waitForSelector('#join-modal:not(.hidden)');
        const accessibilityScanResults = await new AxeBuilder({ page })
            .include('#join-modal')
            .analyze();
        expect(accessibilityScanResults.violations).toEqual([]);
    });

    // 3. Document Language
    test('A11y 3: Should have a lang attribute on the html element', async ({ page }) => {
        const lang = await page.getAttribute('html', 'lang');
        expect(lang).toBeTruthy();
    });

    // 4. Heading Structure
    test('A11y 4: Should have exactly one H1 for SEO and screen readers', async ({ page }) => {
        const h1Count = await page.locator('h1').count();
        expect(h1Count).toBe(1);
    });

    // 5. Form Labels - Identity
    test('A11y 5: Identity input should have an associated label', async ({ page }) => {
        await page.click('#edit-profile-btn');
        const label = page.locator('label[for="identity-input"]');
        await expect(label).toBeVisible();
    });

    // 6. Sidebar Toggle ARIA
    test('A11y 6: Sidebar toggle button should have a descriptive aria-label', async ({ page }) => {
        const toggle = page.locator('#sidebar-toggle');
        const ariaLabel = await toggle.getAttribute('aria-label');
        expect(ariaLabel).toMatch(/toggle sidebar/i);
    });

    // 7. Dice Button ARIA (Icon only)
    test('A11y 7: Generate Room ID button should have an aria-label', async ({ page }) => {
        await page.click('#show-join-modal');
        const diceBtn = page.locator('#gen-room-btn');
        const ariaLabel = await diceBtn.getAttribute('aria-label');
        expect(ariaLabel).toMatch(/generate/i);
    });

    // 8. Close Modal ARIA
    test('A11y 8: Close modal button should have an aria-label', async ({ page }) => {
        await page.click('#show-join-modal');
        const closeBtn = page.locator('#close-modal');
        const ariaLabel = await closeBtn.getAttribute('aria-label');
        expect(ariaLabel).toMatch(/close/i);
    });

    // 9. Input Placeholder ARIA
    test('A11y 9: Message input should have a placeholder and label/aria-label', async ({ page }) => {
        const input = page.locator('#message-input');
        const ariaLabel = await input.getAttribute('aria-label');
        const placeholder = await input.getAttribute('placeholder');
        expect(ariaLabel || placeholder).toBeTruthy();
    });

    // 10. Color Contrast (Automated check for text elements)
    test('A11y 10: Contrast of primary text should be sufficient', async ({ page }) => {
        const results = await new AxeBuilder({ page })
            .withTags(['cat.color'])
            .analyze();
        expect(results.violations.filter(v => v.id === 'color-contrast')).toEqual([]);
    });

    // 11. Image Alt Text (Check for room icon or branding)
    test('A11y 11: All images or decorative icons should have alt/aria-hidden', async ({ page }) => {
        const icons = page.locator('.room-icon');
        const count = await icons.count();
        for (let i = 0; i < count; i++) {
            const ariaHidden = await icons.nth(i).getAttribute('aria-hidden');
            expect(ariaHidden).toBe('true');
        }
    });

    // 12. Skip Navigation (Check if footer links or sidebar can be bypassed)
    // Note: Usually useful for large sites, but simple apps benefit too.
    test('A11y 12: Interactive elements should be focusable via Tab', async ({ page }) => {
        await page.keyboard.press('Tab');
        const focusedId = await page.evaluate(() => document.activeElement.id || document.activeElement.tagName);
        expect(focusedId).toBeTruthy();
    });

    // 13. Focus Ring Visibility
    test('A11y 13: Focused elements should not have outline: none without alternative', async ({ page }) => {
        await page.click('#edit-profile-btn');
        const input = page.locator('#identity-input');
        await input.focus();
        const outline = await input.evaluate(el => getComputedStyle(el).outlineStyle);
        expect(outline).not.toBe('none');
    });

    // 14. Button Role Verification
    test('A11y 14: Interactive elements should use button or a tags', async ({ page }) => {
        const clickable = page.locator('#show-join-modal, #leave-btn, #share-room-btn');
        const tagNames = await clickable.evaluateAll(els => els.map(el => el.tagName.toLowerCase()));
        tagNames.forEach(tag => expect(['button', 'a']).toContain(tag));
    });

    // 15. Form Submission via Keyboard
    test('A11y 15: Join room form should be submittable via Enter key', async ({ page }) => {
        await page.click('#show-join-modal');
        await page.fill('#room-id', 'keyboard-room');
        await page.keyboard.press('Enter');
        await expect(page.locator('#display-room-id')).toContainText('KEYBOARD-ROOM');
    });

    // 16. Modal Backdrop ARIA
    test('A11y 16: Modal container should have aria-modal and role dialog', async ({ page }) => {
        await page.click('#show-join-modal');
        const modal = page.locator('#join-modal');
        await expect(modal).toHaveAttribute('role', 'dialog');
        await expect(modal).toHaveAttribute('aria-modal', 'true');
    });

    // 17. Live Region for Messages
    test('A11y 17: Container for incoming messages should have aria-live or similar', async ({ page }) => {
        const container = page.locator('#messages-container');
        const ariaLive = await container.getAttribute('aria-live');
        expect(ariaLive).toBe('polite');
    });

    // 18. Sidebar List Structure
    test('A11y 18: Room list should be structured as a list for screen readers', async ({ page }) => {
        const list = page.locator('#room-list');
        // It should either be a <ul> or have role="list"
        const tagName = await list.evaluate(el => el.tagName.toLowerCase());
        const role = await list.getAttribute('role');
        expect(tagName === 'ul' || role === 'list').toBe(true);
    });

    // 19. Room Item labels
    test('A11y 19: Individual room items should be focusable and labeled', async ({ page }) => {
        const roomItem = page.locator('.room-item').first();
        await expect(roomItem).toHaveAttribute('role', 'button');
        await expect(roomItem).toHaveAttribute('tabindex', '0');
    });

    // 20. App Main Content Landmark
    test('A11y 20: Should use semantic main landmark', async ({ page }) => {
        const main = page.locator('main');
        await expect(main).toBeVisible();
    });

    // 21. Share Modal Automated Audit
    test('A11y 21: Share modal should have no a11y violations', async ({ page }) => {
        // Must join a room first to see share button
        await page.click('#show-join-modal');
        await page.fill('#room-id', 'a11y-share-room');
        await page.click('#join-form button[type="submit"]');

        await page.click('#share-room-btn');
        await page.waitForSelector('#share-modal:not(.hidden)');

        const accessibilityScanResults = await new AxeBuilder({ page })
            .include('#share-modal')
            .analyze();
        expect(accessibilityScanResults.violations).toEqual([]);
    });

});
