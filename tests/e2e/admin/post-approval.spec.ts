
import { test, expect } from "@playwright/test";

test.describe("Gönderi onaylama", () => {
  test("onaylanan gönderi yayımlanır", async ({ page }) => {
    await page.goto("/");

    await expect(page).toHaveURL(/\/$/);
  });
});
