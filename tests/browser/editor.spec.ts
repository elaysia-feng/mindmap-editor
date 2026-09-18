import { test, expect } from '@playwright/test';

async function start(page) {
  await page.goto('/');
  await page.locator('[data-action="start"]').click();
  await page.keyboard.press('Escape');
}
async function markdown(page, text) {
  await page.locator('[data-mode="markdown"]').click();
  await page.locator('#markdown-editor').fill(text);
  await page.waitForTimeout(400);
}
async function command(page, label) {
  await page.keyboard.press('Control+k');
  await page.getByRole('searchbox').fill(label);
  await page.keyboard.press('Enter');
}

test('Markdown insert preserves existing IDs; undo restores exact text; reload preserves data', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await start(page);
  await markdown(page, '# Topic\n\n- A\n- B');
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem('mindmap-studio-v2')!).root.children.map(n => n.id));
  await page.waitForTimeout(850);
  await markdown(page, '# Topic\n\n- New\n- A\n- B');
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem('mindmap-studio-v2')!).root.children.map(n => n.id));
  expect(after.slice(1)).toEqual(before);
  await page.locator('#btn-undo').click();
  await expect(page.locator('#markdown-editor')).toHaveValue('# Topic\n\n- A\n- B');
  await page.locator('#btn-redo').click();
  await page.reload();
  await expect(page.locator('#markdown-editor')).toHaveValue('# Topic\n\n- New\n- A\n- B');
  expect(errors).toEqual([]);
});

test('Chinese composition Enter does not commit a node prematurely', async ({ page }) => {
  await start(page);
  await page.locator('.node-text').dblclick();
  await page.locator('.node-text').evaluate(el => {
    el.textContent = '中文输入';
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', isComposing: true, bubbles: true }));
  });
  await expect(page.locator('.node-text')).toHaveAttribute('contenteditable', 'true');
  await page.keyboard.press('Enter');
  await expect(page.locator('.node-text')).toHaveText('中文输入');
  await page.reload();
  await expect(page.locator('.node-text')).toHaveText('中文输入');
});

test('storage failure is visible instead of falsely reporting saved', async ({ page }) => {
  await start(page);
  await page.evaluate(() => { Storage.prototype.setItem = () => { throw new Error('quota'); }; });
  await page.locator('#btn-theme').click();
  await expect(page.locator('#save-state')).toHaveAttribute('data-state', 'error');
});

test('JSON imports validate data, repair IDs and reject cyclic flow links', async ({ page }) => {
  await start(page);
  const data = { root: { id: 'root', text: 'Root', children: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }, { id: 'a', text: 'Duplicate' }] }, links: [{ id: 'bad"id', from: 'a', to: 'b' }, { id: 'back', from: 'b', to: 'a' }] };
  await page.locator('#json-file-input').setInputFiles({ name: 'map.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(data)) });
  await expect(page.locator('.node')).toHaveCount(4);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('mindmap-studio-v2')!));
  expect(saved.links).toHaveLength(1);
  expect(saved.links[0].from).toBe('a');
  expect(saved.links[0].id).toMatch(/^[A-Za-z0-9_-]+$/);
  page.on('dialog', d => d.accept());
  await page.locator('#json-file-input').setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('null') });
  await expect(page.locator('#toast')).toContainText('没有有效脑图');
  await expect(page.locator('.node')).toHaveCount(4);
});

test('command modal traps focus and prevents map shortcuts; mobile can undo and open backup', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await start(page);
  await command(page, '添加一个新节点');
  await expect(page.locator('.node')).toHaveCount(2);
  await page.keyboard.press('Escape');
  await command(page, '撤销');
  await expect(page.locator('.node')).toHaveCount(1);
  await page.keyboard.press('Control+k');
  await page.getByRole('searchbox').fill('打开 JSON');
  await expect(page.getByRole('option')).toHaveCount(1);
  await page.keyboard.press('Shift+Tab');
  await expect(page.getByRole('option')).toBeFocused();
  await page.keyboard.press('Delete');
  await expect(page.locator('.node')).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});
