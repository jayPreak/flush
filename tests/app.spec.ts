import { test, expect, type Page } from "@playwright/test";

// Gurgaon center — where seeded data lives
const TEST_LAT = 28.4595;
const TEST_LNG = 77.0266;

// Grant geolocation to place the user in Gurgaon where the data is
test.beforeEach(async ({ context }) => {
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: TEST_LAT, longitude: TEST_LNG });
});

async function waitForMap(page: Page) {
  await page.waitForSelector(".leaflet-container", { timeout: 15000 });
  await page.waitForSelector(".leaflet-tile-loaded", { timeout: 15000 });
}

async function waitForMarkers(page: Page) {
  // Wait for the debounced RPC call (500ms) + network + render
  await page.waitForFunction(
    () => document.querySelectorAll(".leaflet-marker-icon").length >= 2,
    { timeout: 15000 }
  );
}

async function clickFirstMarker(page: Page) {
  await waitForMarkers(page);
  // Click a toilet marker (not the user location marker which has a blue circle)
  // Toilet markers have SVGs with the toilet icon
  const markers = page.locator(".leaflet-marker-icon");
  const count = await markers.count();
  // Click the last one (user marker is usually first or renders differently)
  // Try clicking each marker until a drawer opens
  for (let i = 0; i < count; i++) {
    await markers.nth(i).click({ force: true });
    try {
      await expect(page.getByRole("dialog")).toBeVisible({ timeout: 2000 });
      return; // Drawer opened
    } catch {
      // This marker didn't open a drawer (might be the user location marker), try next
    }
  }
  throw new Error("No toilet marker opened the drawer");
}

// ─── Core Page Load ───────────────────────────────────────────────

test.describe("Page Load & Map", () => {
  test("shows loading state then renders map", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("main")).toBeVisible();
    await waitForMap(page);
    await expect(page.locator(".leaflet-container")).toBeVisible();
  });

  test("renders CARTO Voyager tiles", async ({ page }) => {
    await page.goto("/");
    await waitForMap(page);
    const tiles = page.locator(".leaflet-tile-loaded");
    const count = await tiles.count();
    expect(count).toBeGreaterThan(0);
  });

  test("FABs are visible on the map", async ({ page }) => {
    await page.goto("/");
    await waitForMap(page);
    await expect(page.getByLabel("Find nearest toilet urgently")).toBeVisible();
    await expect(page.getByLabel("Add a toilet")).toBeVisible();
  });
});

// ─── Geolocation Fallback ─────────────────────────────────────────

test.describe("Geolocation Fallback", () => {
  test("shows geolocation denied banner when permission denied", async ({ browser }) => {
    // Create a context WITHOUT geolocation permissions
    const context = await browser.newContext({
      permissions: [],
      geolocation: undefined,
    });
    const page = await context.newPage();
    await page.goto("/");
    await waitForMap(page);
    await expect(
      page.getByText("Location access denied")
    ).toBeVisible({ timeout: 12000 });
    await context.close();
  });
});

// ─── Toilet Pins ──────────────────────────────────────────────────

test.describe("Toilet Pins", () => {
  test("renders toilet markers from seeded data", async ({ page }) => {
    await page.goto("/");
    await waitForMap(page);
    await waitForMarkers(page);

    const markers = page.locator(".leaflet-marker-icon");
    const count = await markers.count();
    // Should have at least 2 markers (user location + at least 1 toilet)
    expect(count).toBeGreaterThanOrEqual(2);
  });
});

// ─── Toilet Detail Bottom Sheet ───────────────────────────────────

test.describe("Toilet Detail Sheet", () => {
  test("opens bottom sheet when a pin is tapped", async ({ page }) => {
    await page.goto("/");
    await waitForMap(page);
    await clickFirstMarker(page);
    await expect(page.getByRole("dialog")).toBeVisible();
  });

  test("shows toilet name and free/paid badge", async ({ page }) => {
    await page.goto("/");
    await waitForMap(page);
    await clickFirstMarker(page);

    const dialog = page.getByRole("dialog");
    // Should show either "Free" or a price badge
    const freeOrPaid = dialog.getByText(/Free|₹/);
    await expect(freeOrPaid.first()).toBeVisible();
  });

  test("shows rating and review count", async ({ page }) => {
    await page.goto("/");
    await waitForMap(page);
    await clickFirstMarker(page);

    const dialog = page.getByRole("dialog");
    // Should have at least 5 star buttons (the header rating display)
    const stars = dialog.getByLabel(/star/);
    const count = await stars.count();
    expect(count).toBeGreaterThanOrEqual(5);
    // Should show review count in parentheses like "(5)"
    await expect(dialog.getByText(/\(\d+\)/)).toBeVisible();
  });

  test("shows Get Directions link pointing to Google Maps", async ({ page }) => {
    await page.goto("/");
    await waitForMap(page);
    await clickFirstMarker(page);

    const dialog = page.getByRole("dialog");
    const directionsLink = dialog.getByText("Get Directions");
    await expect(directionsLink).toBeVisible();
    const href = await directionsLink.getAttribute("href");
    expect(href).toContain("google.com/maps");
  });

  test("shows Write a Review button", async ({ page }) => {
    await page.goto("/");
    await waitForMap(page);
    await clickFirstMarker(page);

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Write a Review")).toBeVisible();
  });

  test("opens review form on Write a Review click", async ({ page }) => {
    await page.goto("/");
    await waitForMap(page);
    await clickFirstMarker(page);

    const dialog = page.getByRole("dialog");
    await dialog.getByText("Write a Review").click();
    await expect(dialog.getByText("Your Rating")).toBeVisible();

    // The interactive form should have exactly 5 star buttons
    const formStars = dialog.locator("form").getByLabel(/star/);
    const formCount = await formStars.count();
    expect(formCount).toBe(5);
  });

  test("closes the sheet on Escape", async ({ page }) => {
    await page.goto("/");
    await waitForMap(page);
    await clickFirstMarker(page);

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible({ timeout: 3000 });
  });
});

// ─── Review Form ──────────────────────────────────────────────────

test.describe("Review Flow", () => {
  async function openReviewForm(page: Page) {
    await page.goto("/");
    await waitForMap(page);
    await clickFirstMarker(page);

    const dialog = page.getByRole("dialog");
    await dialog.getByText("Write a Review").click();
    await expect(dialog.getByText("Your Rating")).toBeVisible();
    return dialog;
  }

  test("submit button is disabled until a star is selected", async ({ page }) => {
    const dialog = await openReviewForm(page);
    const submitBtn = dialog.getByText("Submit Review");
    await expect(submitBtn).toBeDisabled();
  });

  test("can select a star rating and enable submit", async ({ page }) => {
    const dialog = await openReviewForm(page);
    await dialog.locator("form").getByLabel("4 star").click();
    const submitBtn = dialog.getByText("Submit Review");
    await expect(submitBtn).toBeEnabled();
  });

  test("can type in the review body", async ({ page }) => {
    const dialog = await openReviewForm(page);
    const textarea = dialog.getByPlaceholder("How was it? (optional)");
    await textarea.fill("Great toilet, very clean!");
    await expect(textarea).toHaveValue("Great toilet, very clean!");
  });

  test("submits review and shows success toast", async ({ page }) => {
    const dialog = await openReviewForm(page);
    await dialog.locator("form").getByLabel("4 star").click();
    await dialog.getByPlaceholder("How was it? (optional)").fill("Playwright test review");
    await dialog.getByText("Submit Review").click();
    await expect(page.getByText("Review submitted!")).toBeVisible({ timeout: 5000 });
  });
});

// ─── Emergency Button ─────────────────────────────────────────────

test.describe("Emergency Button", () => {
  test("finds nearest toilet and shows result toast", async ({ page }) => {
    await page.goto("/");
    await waitForMap(page);

    await page.getByLabel("Find nearest toilet urgently").click();
    // Should show a toast with "Found!" and distance info
    await expect(page.getByText(/Found!/)).toBeVisible({ timeout: 10000 });
  });
});

// ─── Add Toilet Flow ──────────────────────────────────────────────

test.describe("Add Toilet Flow", () => {
  async function openAddFlow(page: Page) {
    await page.goto("/");
    await waitForMap(page);
    await page.getByLabel("Add a toilet").click({ force: true });
    await expect(page.getByText("Add a Toilet")).toBeVisible({ timeout: 5000 });
  }

  test("opens overlay with Step 1/4", async ({ page }) => {
    await openAddFlow(page);
    await expect(page.getByText("Step 1/4")).toBeVisible();
  });

  test("Step 1: shows location picker with crosshair", async ({ page }) => {
    await openAddFlow(page);
    // The crosshair has a red circle
    const crosshair = page.locator(".border-red-500.rounded-full");
    await expect(crosshair).toBeVisible({ timeout: 5000 });
  });

  test("navigates through all 4 steps", async ({ page }) => {
    await openAddFlow(page);

    // Step 1 → 2
    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByText("Step 2/4")).toBeVisible();
    await expect(page.getByText("Name (optional)")).toBeVisible();

    // Step 2 → 3
    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByText("Step 3/4")).toBeVisible();
    await expect(page.getByText("Select all that apply:")).toBeVisible();

    // Step 3 → 4
    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByText("Step 4/4")).toBeVisible();
    await expect(page.getByText("Confirm Details")).toBeVisible();
  });

  test("Step 2: can fill in toilet details", async ({ page }) => {
    await openAddFlow(page);
    await page.getByRole("button", { name: "Next" }).click();

    await page.getByPlaceholder("e.g. Ambience Mall Restroom").fill("PW Test Toilet");
    await page.getByText("Restaurant").click();
    await page.getByText("Paid").click();

    const priceInput = page.getByPlaceholder("Price in ₹");
    await expect(priceInput).toBeVisible();
    await priceInput.fill("15");

    await page.getByPlaceholder("e.g. 24/7 or 6am-10pm").fill("9am-9pm");
  });

  test("Step 3: can toggle amenity chips", async ({ page }) => {
    await openAddFlow(page);
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByRole("button", { name: "Next" }).click();

    await expect(page.getByText("Step 3/4")).toBeVisible();
    await page.getByText("Western").click();
    await page.getByText("Soap").click();
  });

  test("Step 4: shows summary of entered details", async ({ page }) => {
    await openAddFlow(page);

    await page.getByRole("button", { name: "Next" }).click();
    await page.getByPlaceholder("e.g. Ambience Mall Restroom").fill("Summary Test Toilet");
    await page.getByText("Mall").click();

    await page.getByRole("button", { name: "Next" }).click();
    await page.getByText("Western").click();

    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByText("Confirm Details")).toBeVisible();
    await expect(page.getByText("Summary Test Toilet")).toBeVisible();
    // Type shows as "mall" (with CSS capitalize making it visually "Mall")
    await expect(page.getByText(/mall/i)).toBeVisible();
    await expect(page.getByText("Free")).toBeVisible();
  });

  test("can go back between steps", async ({ page }) => {
    await openAddFlow(page);
    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByText("Step 2/4")).toBeVisible();

    await page.getByRole("button", { name: "Back" }).click();
    await expect(page.getByText("Step 1/4")).toBeVisible();
  });

  test("close button dismisses the flow", async ({ page }) => {
    await openAddFlow(page);
    await page.getByText("✕").click();
    await expect(page.getByText("Add a Toilet")).not.toBeVisible();
  });
});

// ─── Accessibility ────────────────────────────────────────────────

test.describe("Accessibility", () => {
  test("emergency button has aria-label", async ({ page }) => {
    await page.goto("/");
    await waitForMap(page);
    await expect(page.getByLabel("Find nearest toilet urgently")).toBeVisible();
  });

  test("add toilet button has aria-label", async ({ page }) => {
    await page.goto("/");
    await waitForMap(page);
    await expect(page.getByLabel("Add a toilet")).toBeVisible();
  });

  test("drawer has accessible title", async ({ page }) => {
    await page.goto("/");
    await waitForMap(page);
    await clickFirstMarker(page);

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    const heading = dialog.locator("h2, [role='heading']");
    await expect(heading.first()).toBeVisible();
  });
});

// ─── Mobile Viewport ──────────────────────────────────────────────

test.describe("Mobile Viewport", () => {
  test("map fills the full viewport height", async ({ page }) => {
    await page.goto("/");
    await waitForMap(page);

    const main = page.locator("main");
    const box = await main.boundingBox();
    const viewport = page.viewportSize()!;
    expect(box!.height).toBeGreaterThan(viewport.height * 0.8);
  });

  test("FABs are positioned at bottom corners", async ({ page }) => {
    await page.goto("/");
    await waitForMap(page);

    const viewport = page.viewportSize()!;

    const emergencyBox = await page.getByLabel("Find nearest toilet urgently").boundingBox();
    expect(emergencyBox!.x).toBeGreaterThan(viewport.width / 2);
    expect(emergencyBox!.y).toBeGreaterThan(viewport.height / 2);

    const addBox = await page.getByLabel("Add a toilet").boundingBox();
    expect(addBox!.x).toBeLessThan(viewport.width / 2);
    expect(addBox!.y).toBeGreaterThan(viewport.height / 2);
  });
});
