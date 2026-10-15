import { expect, test } from '@playwright/test';

test('home page exposes community and event discovery', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /find your people/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /communities/i }).first()).toBeVisible();
});

test('sign-up form validates required account fields', async ({ page }) => {
  await page.goto('/auth/signup');
  await expect(page.getByRole('heading', { name: /create an account/i })).toBeVisible();
  await expect(page.getByLabel(/your name/i)).toBeVisible();
  await expect(page.getByLabel(/email address/i)).toBeVisible();
  await expect(page.getByLabel(/password/i)).toBeVisible();
});

test('communities directory is reachable and searchable', async ({ page }) => {
  await page.goto('/communities');
  await expect(page.getByRole('heading', { name: 'Communities', exact: true })).toBeVisible();
  await expect(page.getByRole('textbox', { name: /search communities/i })).toBeVisible();
});

test('a signed-in student can create a community, event, and project', async ({ page }) => {
  const identity = `e2e-${Date.now()}@example.test`;
  await page.goto('/auth/signup');
  await page.getByLabel(/your name/i).fill('CampusConnect Test');
  await page.getByLabel(/email address/i).fill(identity);
  await page.getByLabel(/password/i).fill('CampusConnect-E2E-Password-123');
  await page.getByRole('button', { name: /create account/i }).click();
  await expect(page).toHaveURL('/');

  const suffix = String(Date.now());
  await page.goto('/communities');
  await page.getByRole('button', { name: /create a community/i }).click();
  await page.getByLabel(/community name/i).fill(`E2E community ${suffix}`);
  await page.getByLabel(/category/i).fill('Testing');
  await page.getByLabel(/description/i).fill('A community created by the CampusConnect browser flow test.');
  await page.getByRole('button', { name: /create community/i }).last().click();
  await expect(page.getByText(`E2E community ${suffix}`)).toBeVisible();

  await page.goto('/events');
  await page.getByRole('button', { name: /create event/i }).click();
  await page.getByLabel(/event name/i).fill(`E2E event ${suffix}`);
  await page.getByLabel(/description/i).fill('A published event created by the browser flow test.');
  const start = new Date(Date.now() + 86_400_000);
  const end = new Date(Date.now() + 90_000_000);
  const asLocal = (date: Date) => new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
  await page.getByLabel(/starts/i).fill(asLocal(start));
  await page.getByLabel(/ends/i).fill(asLocal(end));
  await page.getByRole('button', { name: /publish event/i }).click();
  await expect(page.getByText(`E2E event ${suffix}`)).toBeVisible();

  await page.goto('/projects');
  await page.getByRole('button', { name: /start a project/i }).click();
  await page.getByLabel(/project name/i).fill(`E2E project ${suffix}`);
  await page.getByLabel(/category/i).fill('Testing');
  await page.getByLabel(/description/i).fill('A project created by the CampusConnect browser flow test.');
  await page.getByRole('button', { name: /create project/i }).click();
  await expect(page.getByText(`E2E project ${suffix}`)).toBeVisible();
});
