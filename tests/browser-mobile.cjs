// Local-only responsive regression check. All API/auth responses are synthetic.
// Run from the repository root after starting Vite or a production preview.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { chromium } = require(process.env.AUCTIONPILOT_PLAYWRIGHT_MODULE || "../.local/browser-tools/node_modules/playwright");
const base = process.env.AUCTIONPILOT_PREVIEW_URL || "http://127.0.0.1:5173";
assert(["localhost", "127.0.0.1"].includes(new URL(base).hostname), "This fixture suite must only run against localhost.");
const widths = [320, 375, 390, 430, 768, 1440];
const categories = [{ id: 1, name: "Fine Art" }, { id: 2, name: "Rare Collectibles and Jewelry" }, { id: 3, name: "LongCategory".repeat(12) }];
const auctions = [
  { id: 101, title: "Rare vintage watch with original papers and an exceptionally long collector provenance " + "LongTitle".repeat(16), description: "Collector provenance " + "LongDescription".repeat(20), imageUrl: "/uploads/mobile-fixture.svg", startPrice: 999999999999, currentPrice: 99999999999999.95, startTime: "2026-09-01T00:00:00Z", endTime: "2030-01-01T00:00:00Z", bidCount: 12345678, categoryId: 1, category: categories[0], status: 2, isClosed: false, seller: { displayName: "Synthetic Seller" } },
  { id: 102, title: "Painting with no image", description: "Watercolor", imageUrl: null, startPrice: 100, currentPrice: 500, startTime: "2026-10-01T00:00:00Z", endTime: "2029-01-01T00:00:00Z", bidCount: 3, categoryId: 2, category: categories[1], status: 2, isClosed: false },
  { id: 103, title: "Closed collectible", description: "Archived synthetic item", imageUrl: null, startPrice: 50, currentPrice: 250, startTime: "2025-01-01T00:00:00Z", endTime: "2025-02-01T00:00:00Z", bidCount: 8, categoryId: 3, category: categories[2], status: 3, isClosed: true },
];
const normalUser = { id: "mobile-user", email: "long.user.name.for.mobile.layout@example.test", displayName: "Synthetic Customer With A Long Display Name", roles: ["User"] };
const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="#172338"/><circle cx="400" cy="300" r="160" fill="#eac12e"/></svg>';
(async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const output = ".local/mobile-review/after";
  fs.mkdirSync(output, { recursive: true });
  const report = { mode: "local Chrome with synthetic API and auth fixtures; no backend writes", base, widths, passed: [], failed: [], layout: [], runtimeErrors: [], unrun: ["Real backend authentication and realtime transport", "Physical iOS/Android devices"], notApplicable: ["Pagination/load-more: Browse renders the complete result list and has neither control"] };
  let user = null;
  let auctionMode = "success";
  let categoryFailure = false;
  let loginFailure = false;
  const page = await browser.newPage({ hasTouch: true });
  page.setDefaultTimeout(10000);
  page.on("pageerror", error => report.runtimeErrors.push(error.message));
  await page.route("**/*", async route => {
    const url = new URL(route.request().url());
    if (url.origin === new URL(base).origin && !url.pathname.toLowerCase().startsWith("/api/") && !url.pathname.toLowerCase().startsWith("/hubs/")) return route.continue();
    const path = url.pathname.toLowerCase();
    if (!path.startsWith("/api/") && !path.startsWith("/hubs/")) {
      return route.fulfill({ contentType: "image/svg+xml", body: svg });
    }
    if (path.startsWith("/hubs/")) return route.fulfill({ status: 403, contentType: "application/json", body: "{}" });
    let data = [];
    let status = 200;
    if (path === "/api/auth/login") {
      if (loginFailure) { status = 400; data = { message: "Synthetic invalid credentials." }; }
      else { user = normalUser; data = { token: "local-mobile-fixture", user }; }
    } else if (path === "/api/auth/me") { data = user; status = user ? 200 : 401; }
    else if (path === "/api/categories") { data = categories; if (categoryFailure) status = 503; }
    else if (path === "/api/auctions" || path === "/api/auctions/latest") {
      if (auctionMode === "loading") await new Promise(resolve => setTimeout(resolve, 1400));
      if (auctionMode === "error") { status = 503; data = { message: "Synthetic unavailable API" }; }
      else data = auctionMode === "empty" ? [] : auctions;
    } else if (path === "/api/auctions/my") data = auctions;
    else if (/^\/api\/auctions\/\d+$/.test(path)) data = auctions.find(a => a.id === Number(path.split("/").pop()));
    else if (path === "/api/watchlist") data = [{ id: 1, auctionId: 101, auction: auctions[0], addedDate: "2026-10-01" }];
    else if (path.includes("/account/profile")) data = { ...normalUser, name: normalUser.displayName, phone: "0771234567", location: "Colombo", bio: "Synthetic profile", memberSince: "2025-01-01", avatar: null };
    else if (path.includes("/account/stats")) data = [];
    else if (/^\/api\/bids\/\d+$/.test(path)) data = [{ bidder: "LongBidder".repeat(12), amount: 9999999999999, time: "2026-10-01T12:00:00Z" }];
    return route.fulfill({ status, contentType: "application/json", body: JSON.stringify(data ?? {}) });
  });
  async function check(name, fn) {
    try { await fn(); report.passed.push(name); }
    catch (error) { report.failed.push({ name, message: error.message }); console.log("FAIL: " + name + ": " + error.message.split("\n")[0]); await page.keyboard.press("Escape").catch(() => {}); }
  }
  async function visit(path) {
    const response = await page.goto(base + path, { waitUntil: "networkidle" });
    assert.equal(response.status(), 200);
    await page.locator("header").waitFor();
  }
  async function noOverflow(path, width) {
    const result = await page.evaluate(() => {
      const width = document.documentElement.clientWidth;
      return { viewport: width, scrollWidth: document.documentElement.scrollWidth,
        offenders: [...document.querySelectorAll("body *")].filter(e => {
          const r = e.getBoundingClientRect();
          return r.width && (r.right > width + 1 || r.left < -1) && getComputedStyle(e).position !== "absolute";
        }).slice(0, 8).map(e => ({ tag: e.tagName, class: String(e.className), text: e.textContent.slice(0, 80) })) };
    });
    report.layout.push({ path, width, ...result });
    assert(result.scrollWidth <= result.viewport + 1, JSON.stringify(result));
  }
  const trigger = page.getByRole("button", { name: "Open navigation menu", includeHidden: true });
  const drawer = page.getByRole("dialog", { name: "Navigation", exact: true });
  async function openMenu() { await trigger.tap(); await drawer.waitFor(); await drawer.evaluate(el => Promise.all(el.getAnimations().map(animation => animation.finished.catch(() => {})))); }
  async function closedMenu() { await drawer.waitFor({ state: "hidden" }); }

  try {
    for (const width of widths) {
      console.log("Checking viewport " + width);
      await page.setViewportSize({ width, height: 844 });
      for (const path of ["/", "/auctions", "/login", "/register", "/auctions/101", "/auctionpage", "/categery", "/categories/Fine%20Art", "/how-it-works", "/about", "/contact", "/help", "/calendar", "/past-auctions", "/watchlist", "/my-bids", "/my-auctions", "/profile", "/auctions/create", "/live"]) {
        await check("Layout " + width + "px " + path, async () => { await visit(path); await noOverflow(path, width); if (path === "/my-auctions") { await page.getByRole("tab", { name: "My Auctions", exact: true }).click(); await noOverflow("My Auctions listings", width); } });
        if (["/", "/auctions", "/login", "/auctions/101"].includes(path))
          await page.screenshot({ path: output + "/" + (path === "/" ? "home" : path.slice(1).replaceAll("/", "-")) + "-" + width + ".png", fullPage: true });
      }
      await visit("/");
      if (width < 1280) {
        await check("Anonymous menu, focus, scroll lock and Escape " + width, async () => {
          assert(await trigger.isVisible());
          assert(!(await page.locator("header").getByRole("button", { name: "Search", exact: true }).isVisible()));
          const target = await trigger.boundingBox();
          assert(target.width >= 44 && target.height >= 44);
          const previousOverflow = await page.evaluate(() => getComputedStyle(document.body).overflow);
          await openMenu();
          assert.equal(await trigger.getAttribute("aria-expanded"), "true");
          for (const [name, href] of [["Home", "/"], ["Auctions", "/auctionpage"], ["Categories", "/categery"], ["Browse Auctions", "/auctions"], ["How It Works", "/how-it-works"], ["Login", "/login"], ["Register", "/register"]]) {
            const link = drawer.getByRole("link", { name, exact: true });
            assert.equal(await link.getAttribute("href"), href);
            const box = await link.boundingBox();
            assert(box.height >= 44, name + " touch target too short");
          }
          assert.equal(await page.evaluate(() => getComputedStyle(document.body).overflow), "hidden");
          await page.keyboard.press("Shift+Tab");
          assert(await drawer.evaluate(el => el.contains(document.activeElement)));
          await page.keyboard.press("Tab");
          assert(await drawer.evaluate(el => el.contains(document.activeElement)));
          await noOverflow("open menu", width);
          await page.screenshot({ path: output + "/menu-" + width + ".png" });
          await page.keyboard.press("Escape");
          await closedMenu();
          assert(await trigger.evaluate(el => el === document.activeElement), "Focus did not return to trigger");
          assert.equal(await trigger.getAttribute("aria-expanded"), "false");
          assert.equal(await page.evaluate(() => getComputedStyle(document.body).overflow), previousOverflow);
        });
        await check("Close button, backdrop and navigation selection " + width, async () => {
          await openMenu(); await drawer.getByRole("button", { name: "Close", exact: true }).click(); await closedMenu();
          await openMenu(); await page.mouse.click(2, 200); await closedMenu();
          await openMenu(); await drawer.getByRole("link", { name: "Login", exact: true }).click();
          await page.waitForURL("**/login"); await closedMenu();
          await openMenu(); await drawer.getByRole("link", { name: "Register", exact: true }).click();
          await page.waitForURL("**/register"); await closedMenu();
          await openMenu(); await drawer.getByRole("link", { name: "Browse Auctions", exact: true }).click();
          await page.waitForURL("**/auctions"); await closedMenu();
        });
      } else {
        await check("Desktop navigation/search " + width, async () => {
          assert(await page.getByRole("navigation", { name: "Main navigation", exact: true }).isVisible());
          assert(await page.locator("header").getByRole("button", { name: "Search", exact: true }).isVisible());
          assert(!(await trigger.isVisible()));
        });
      }
      await check("Homepage listing action and card route " + width, async () => {
        await visit("/");
        assert.equal(await page.getByRole("link", { name: "View All Auctions" }).getAttribute("href"), "/auctions");
        assert.equal(await page.locator("main").getByRole("link", { name: "Place Bid" }).first().getAttribute("href"), "/auctions/101");
        await page.getByRole("link", { name: "View All Auctions" }).click();
        await page.waitForURL("**/auctions");
      });
      await check("Browse search, keyboard filters, all sorts and card layout " + width, async () => {
        await visit("/auctions");
        const search = page.getByRole("searchbox", { name: "Search auctions" });
        await search.fill("watercolor");
        assert.deepEqual(await page.locator('section[aria-label="Auction results"] h3').allTextContents(), ["Painting with no image"]);
        await search.fill("");
        const filter = page.getByRole("button", { name: "Fine Art", exact: true });
        await filter.focus(); await page.keyboard.press("Enter");
        assert.equal(await filter.getAttribute("aria-pressed"), "true");
        assert.equal(await page.locator('section[aria-label="Auction results"] h3').count(), 1);
        await page.getByRole("button", { name: "All", exact: true }).click();
        const expected = { "ending-soon": 103, newest: 102, "price-low": 103, "price-high": 101, "most-bids": 101 };
        for (const [sort, id] of Object.entries(expected)) {
          await page.getByRole("combobox", { name: "Sort auctions" }).selectOption(sort);
          const first = page.locator('section[aria-label="Auction results"] a').first();
          assert.equal(await first.getAttribute("href"), "/auctions/" + id);
        }
        const columns = await page.locator('section[aria-label="Auction results"] > div.grid').evaluate(el => getComputedStyle(el).gridTemplateColumns.split(" ").length);
        assert.equal(columns, width < 640 ? 1 : width < 1024 ? 2 : 3);
        const images = page.locator('section[aria-label="Auction results"] img');
        for (const img of await images.all()) assert(await img.evaluate(el => el.complete && el.naturalWidth > 0 && getComputedStyle(el).objectFit === "cover"));
        await noOverflow("Browse with long content", width);
        await search.fill("nothing-matches");
        await page.getByText("No auctions found.", { exact: false }).waitFor();
        await page.getByRole("button", { name: "Clear filters" }).click();
        assert.equal(await search.inputValue(), "");
      });
      await check("Detail tabs, long bids, closed state " + width, async () => {
        await visit("/auctions/101");
        for (const name of ["Bidding History", "Condition Report", "Details"]) {
          await page.getByRole("tab", { name, exact: true }).click();
          await noOverflow("details tab " + name, width);
        }
        await visit("/auctions/103");
        assert(await page.locator("main").getByRole("button", { name: "Place Bid", exact: true }).isDisabled());
      });
    }
    await check("Drawer closes when switching to desktop", async () => {
      await page.setViewportSize({ width: 390, height: 844 });
      await visit("/"); await openMenu();
      await page.setViewportSize({ width: 1440, height: 900 }); await closedMenu();
      assert.notEqual(await page.evaluate(() => getComputedStyle(document.body).overflow), "hidden");
    });
    await page.setViewportSize({ width: 320, height: 240 });
    await visit("/");
    await check("Short-screen drawer scroll", async () => {
      await openMenu();
      const scrollArea = drawer.locator(".overflow-y-auto");
      assert(await scrollArea.evaluate(el => el.scrollHeight > el.clientHeight));
      await scrollArea.evaluate(el => { el.scrollTop = el.scrollHeight; });
      assert(await scrollArea.evaluate(el => el.scrollTop > 0));
      await drawer.getByRole("link", { name: "Register", exact: true }).click();
      await closedMenu();
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await check("Browse loading, error, retry, empty and category failure", async () => {
      auctionMode = "loading";
      await page.goto(base + "/auctions", { waitUntil: "domcontentloaded" });
      await page.getByRole("status").filter({ hasText: "Loading auctions" }).waitFor();
      await page.locator('section[aria-label="Auction results"] h3').first().waitFor();
      auctionMode = "error"; await visit("/auctions");
      await page.getByRole("alert").filter({ hasText: "Unable to load auctions" }).waitFor();
      await noOverflow("Browse error", 390);
      auctionMode = "success"; await page.getByRole("button", { name: "Retry auctions" }).click();
      await page.locator('section[aria-label="Auction results"] h3').first().waitFor();
      auctionMode = "empty"; await visit("/auctions"); await page.getByText("No auctions found.", { exact: true }).waitFor();
      auctionMode = "success"; categoryFailure = true; await visit("/auctions");
      await page.getByText("Categories are unavailable.", { exact: false }).waitFor();
      categoryFailure = false; await page.getByRole("button", { name: "Retry categories" }).click();
      await page.getByRole("button", { name: "Fine Art", exact: true }).waitFor();
    });
    await check("Login form error and successful synthetic login", async () => {
      await visit("/login"); loginFailure = true;
      await page.getByLabel("Email Address").fill(normalUser.email);
      await page.getByLabel("Password", { exact: true }).fill("Synthetic-password-123!");
      await page.getByRole("button", { name: "Sign In", exact: true }).click();
      await page.getByRole("alert").filter({ hasText: "Synthetic invalid credentials" }).waitFor();
      loginFailure = false; await page.getByRole("button", { name: "Sign In", exact: true }).click();
      await page.waitForURL(base + "/");
    });
    for (const roles of [["User"], ["Admin"]]) {
      user = { ...normalUser, roles };
      for (const width of widths) {
        await page.setViewportSize({ width, height: 844 });
        await visit("/");
        await check("Synthetic " + roles[0] + " account links and logout " + width, async () => {
          let nav;
          if (width < 1280) { await openMenu(); nav = drawer; }
          else { await page.getByRole("button", { name: "Account menu" }).click(); nav = page.getByRole("navigation", { name: "Account navigation", exact: true }); }
          for (const [name, href] of [["Profile", "/profile"], ["My Bids", "/my-bids"], ["My Auctions", "/my-auctions"], ["Settings", "/settings"]])
            assert.equal(await nav.getByRole("link", { name, exact: true }).getAttribute("href"), href);
          assert.equal(await nav.getByRole("link", { name: "Admin Dashboard", exact: true }).count(), roles.includes("Admin") ? 1 : 0);
          if (width < 1280) {
            await noOverflow("signed-in drawer", width);
            if (width === 390) await page.screenshot({ path: output + "/menu-" + roles[0].toLowerCase() + "-390.png" });
          }
          await nav.getByRole("button", { name: "Logout", exact: true }).click();
          assert.equal(await page.evaluate(() => localStorage.getItem("token")), null);
          if (width < 1280) await closedMenu();
          await page.evaluate(() => localStorage.setItem("token", "local-mobile-fixture"));
        });
      }
    }
    await check("No uncaught browser errors", async () => assert.deepEqual(report.runtimeErrors, []));
  } finally {
    fs.writeFileSync(output + "/results.json", JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ mode: report.mode, passed: report.passed.length, failed: report.failed, screenshots: output, unrun: report.unrun }, null, 2));
    await browser.close();
  }
  if (report.failed.length) process.exitCode = 1;
})().catch(error => { console.error(error); process.exitCode = 1; });
