// Local-only admin management regression. All account/API responses are synthetic.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { chromium } = require(process.env.AUCTIONPILOT_PLAYWRIGHT_MODULE || "../.local/browser-tools/node_modules/playwright");
const base = process.env.AUCTIONPILOT_PREVIEW_URL || "http://127.0.0.1:5173";
assert(["localhost", "127.0.0.1"].includes(new URL(base).hostname), "Admin fixtures require localhost.");

(async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const context = await browser.newContext({ timezoneId: "Asia/Colombo" });
  await context.addInitScript(() => localStorage.setItem("token", "synthetic-admin-fixture"));
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  page.setDefaultNavigationTimeout(60000);
  const output = ".local/admin-auctions-review";
  fs.mkdirSync(output, { recursive: true });
  const report = { mode: "Local Chrome; synthetic auth and API; no backend writes", passed: [], runtimeErrors: [], dialogWarnings: [] };
  page.on("pageerror", error => report.runtimeErrors.push(error.message));
  page.on("console", message => { if (/Missing.*Description|aria-describedby/.test(message.text())) report.dialogWarnings.push(message.text()); });
  const now = Date.now();
  const future = offset => new Date(now + offset * 60000).toISOString();
  const lot = { description: "Synthetic auction", startPrice: 10.25, currentPrice: 10.25, startTime: future(60), endTime: future(120), status: 1, isClosed: false, bidCount: 0, categoryId: 1, imageUrl: null };
  let auctions = [
    { ...lot, id: 101, title: "Scheduled lot", imageUrl: "https://res.cloudinary.com/demo/image/upload/kept.png" },
    { ...lot, id: 102, title: "Live lot", startTime: future(-60), status: 2 },
    { ...lot, id: 103, title: "Closed early lot", status: 3, isClosed: true },
    { ...lot, id: 104, title: "Lot with bids", bidCount: 2 },
    { ...lot, id: 105, title: "Elapsed lot", startTime: future(-120), endTime: future(-60), status: 2 },
    { ...lot, id: 106, title: "Legacy closed lot", status: "Closed" },
    { ...lot, id: 107, title: "Numeric closed lot", status: 3 },
    { ...lot, id: 108, title: "Draft lot", status: 0 }
  ];
  const writes = [];
  let listError = false;
  let listDelay = 0;
  let saveError = false;
  let uploadError = false;
  let conflict = false;
  let roles = ["Admin"];
  await page.route("**/*", async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === new URL(base).origin && !/^\/(api|hubs)\//.test(url.pathname)) return route.continue();
    let status = 200;
    let data = [];
    const path = url.pathname;
    const method = request.method();
    if (path.startsWith("/hubs/")) { status = 403; data = {}; }
    else if (path === "/api/auth/me") data = { id: "synthetic-admin", email: "admin@example.invalid", displayName: "Admin Fixture", roles };
    else if (path === "/api/categories") data = [{ id: 1, name: "Fine Art" }];
    else if (path === "/api/admin/auctions" && method === "GET") {
      if (listDelay) await new Promise(resolve => setTimeout(resolve, listDelay));
      status = listError ? 403 : 200;
      data = listError ? { message: "Synthetic list failure. Try again." } : auctions;
    } else if (path === "/api/uploads") {
      writes.push({ path, method });
      status = uploadError ? 400 : 200;
      data = uploadError ? { message: "Choose a JPEG, PNG or WebP image." } : { imageUrl: "https://res.cloudinary.com/demo/image/upload/new.png" };
    } else if (path.startsWith("/api/admin/auctions") && method !== "GET") {
      const payload = request.postDataJSON();
      writes.push({ path, method, payload });
      const id = Number(path.split("/")[4]);
      if (conflict) {
        const auction = auctions.find(a => a.id === id);
        if (auction) { auction.isClosed = true; auction.status = 3; }
        status = 409; data = { message: "Auction history must be retained; only unstarted auctions without bids can be deleted." };
      } else if (saveError) {
        status = 400; data = { errors: { Title: ["Synthetic title validation failed."] } };
      } else if (method === "POST") {
        data = { ...lot, ...payload, id: 200 }; auctions.unshift(data); status = 201;
      } else if (method === "PUT") {
        const auction = auctions.find(a => a.id === id); Object.assign(auction, payload); data = auction;
      } else if (method === "DELETE") {
        auctions = auctions.filter(a => a.id !== id); status = 204; data = null;
      } else if (method === "PATCH") {
        const auction = auctions.find(a => a.id === id); auction.isClosed = true; auction.status = 3; data = { success: true };
      }
    }
    return route.fulfill({ status, contentType: "application/json", body: status === 204 ? "" : JSON.stringify(data) });
  });
  const pass = name => { report.passed.push(name); console.log("PASS: " + name); };
  const card = title => page.getByRole("article", { name: title, exact: true });
  const dialog = page.getByRole("dialog");
  async function visit() {
    await page.goto(base + "/auctionmanage", { waitUntil: "domcontentloaded" });
    await page.getByRole("heading", { name: "Auction Management", exact: true }).waitFor();
    await page.getByText("Loading auctions...", { exact: true }).waitFor({ state: "hidden" });
  }
  async function fillNew(title) {
    await page.getByRole("button", { name: "+ New Auction", exact: true }).click();
    await dialog.getByLabel("Title", { exact: true }).fill(title);
    await dialog.getByLabel("Start price", { exact: true }).fill("12.25");
    const times = await page.evaluate(() => {
      const local = offset => { const d = new Date(Date.now() + offset * 60000); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };
      return [local(60), local(120)];
    });
    await dialog.getByLabel("Start time", { exact: false }).fill(times[0]);
    await dialog.getByLabel("End time", { exact: false }).fill(times[1]);
    await dialog.getByLabel("Category", { exact: true }).selectOption("1");
    return times;
  }
  try {
    for (const width of [320, 376, 768, 1440]) {
      await page.setViewportSize({ width, height: 608 });
      await visit();
      const dimensions = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
      assert(dimensions.scroll <= dimensions.width + 1, JSON.stringify(dimensions));
      const container = width < 768 ? card("Scheduled lot") : page.getByRole("row").filter({ hasText: "Scheduled lot" });
      assert(await container.getByRole("button", { name: "Edit", exact: true }).isEnabled());
      assert(await container.getByRole("button", { name: "Delete", exact: true }).isEnabled());
      await page.screenshot({ path: output + "/list-" + width + ".png", fullPage: true });
      pass("Admin list and actions fit " + width + "px");
    }
    await page.setViewportSize({ width: 376, height: 608 });
    for (const [title, status] of [["Live lot", "Live"], ["Closed early lot", "Closed"], ["Elapsed lot", "Closed"], ["Legacy closed lot", "Closed"], ["Numeric closed lot", "Closed"], ["Draft lot", "Draft"]]) {
      await card(title).getByText(status, { exact: true }).waitFor();
      if (title !== "Draft lot") {
        assert(await card(title).getByRole("button", { name: "Edit", exact: true }).isDisabled());
        assert(await card(title).getByRole("button", { name: "Delete", exact: true }).isDisabled());
      }
      if (status === "Closed") {
        assert.equal(await card(title).getByRole("button", { name: "Close", exact: true }).count(), 0);
        assert.match(await card(title).getByRole("link", { name: "View history", exact: true }).getAttribute("href"), /^\/auctions\//);
      }
    }
    assert(await card("Lot with bids").getByRole("button", { name: "Delete", exact: true }).isDisabled());
    assert(await card("Draft lot").getByRole("button", { name: "Edit", exact: true }).isEnabled());
    assert.equal(writes.length, 0);
    pass("Numeric, legacy, elapsed and early closed states retain history; bid-bearing auctions are protected");

    await card("Scheduled lot").getByRole("button", { name: "Edit", exact: true }).click();
    assert.equal(await dialog.getByLabel("Start price", { exact: true }).inputValue(), "10.25");
    await dialog.getByLabel("Title", { exact: true }).fill("Updated scheduled lot");
    await dialog.getByRole("button", { name: "Save", exact: true }).click();
    await dialog.waitFor({ state: "hidden" });
    const update = writes.find(w => w.method === "PUT");
    assert.equal(update.path, "/api/admin/auctions/101");
    assert.equal(update.payload.startTime, new Date(lot.startTime).toISOString().replace(/:\d{2}\.\d{3}Z$/, ":00.000Z"));
    assert.equal(update.payload.imageUrl, "https://res.cloudinary.com/demo/image/upload/kept.png");
    await card("Updated scheduled lot").waitFor();
    pass("Editing retains existing image and round-trips Colombo local times to UTC");

    const times = await fillNew("New synthetic lot");
    await dialog.getByLabel("End time", { exact: false }).fill(times[0]);
    const beforeInvalid = writes.length;
    await dialog.getByRole("button", { name: "Save", exact: true }).click();
    await dialog.getByRole("alert").getByText("The end time must be after the start time and in the future.").waitFor();
    assert.equal(writes.length, beforeInvalid);
    await dialog.getByLabel("End time", { exact: false }).fill(times[1]);
    saveError = true;
    await dialog.getByRole("button", { name: "Save", exact: true }).click();
    await dialog.getByRole("alert").getByText("Synthetic title validation failed.").waitFor();
    assert.equal(await dialog.getByLabel("Title", { exact: true }).inputValue(), "New synthetic lot");
    saveError = false;
    uploadError = true;
    await dialog.getByLabel("Image (optional)", { exact: true }).setInputFiles({ name: "synthetic.png", mimeType: "image/png", buffer: Buffer.from("synthetic fixture") });
    await dialog.getByRole("button", { name: "Save", exact: true }).click();
    await dialog.getByRole("alert").getByText("Choose a JPEG, PNG or WebP image.").waitFor();
    uploadError = false;
    await page.screenshot({ path: output + "/form-376.png" });
    await dialog.getByRole("button", { name: "Save", exact: true }).click();
    await dialog.waitFor({ state: "hidden" });
    const creation = writes.filter(w => w.method === "POST" && w.path === "/api/admin/auctions").at(-1);
    assert.equal(creation.payload.startPrice, 12.25);
    assert.equal(creation.payload.categoryId, 1);
    assert.equal(creation.payload.imageUrl, "https://res.cloudinary.com/demo/image/upload/new.png");
    assert(creation.payload.startTime.endsWith("Z"));
    await card("New synthetic lot").waitFor();
    pass("Creation validates dates, exposes API validation/upload errors and saves the entered form on retry");

    page.once("dialog", prompt => prompt.dismiss());
    await card("New synthetic lot").getByRole("button", { name: "Delete", exact: true }).click();
    assert(!writes.some(w => w.method === "DELETE"));
    page.once("dialog", prompt => prompt.accept());
    await card("New synthetic lot").getByRole("button", { name: "Delete", exact: true }).click();
    await card("New synthetic lot").waitFor({ state: "hidden" });
    assert(writes.some(w => w.path === "/api/admin/auctions/200" && w.method === "DELETE"));
    page.once("dialog", prompt => prompt.accept());
    await card("Live lot").getByRole("button", { name: "Close", exact: true }).click();
    await card("Live lot").getByText("Closed", { exact: true }).waitFor();
    assert(writes.some(w => w.path === "/api/admin/auctions/102/close" && w.method === "PATCH"));
    pass("Deletion requires confirmation; allowed delete and live closure refresh the list");

    conflict = true;
    page.once("dialog", prompt => prompt.accept());
    await card("Updated scheduled lot").getByRole("button", { name: "Delete", exact: true }).click();
    await page.getByRole("alert").getByText("Auction history must be retained; only unstarted auctions without bids can be deleted.", { exact: true }).waitFor();
    await card("Updated scheduled lot").getByText("Closed", { exact: true }).waitFor();
    assert(await card("Updated scheduled lot").getByRole("button", { name: "Delete", exact: true }).isDisabled());
    conflict = false;
    pass("A stale action displays the actual 409 reason and refreshes the auction's closed state");

    listError = true;
    await page.getByRole("button", { name: "Refresh", exact: true }).click();
    await page.getByRole("alert").getByText("Synthetic list failure. Try again.", { exact: true }).waitFor();
    assert(await page.getByRole("button", { name: "+ New Auction", exact: true }).isDisabled());
    listError = false;
    listDelay = 400;
    await page.getByRole("button", { name: "Retry", exact: true }).click();
    await page.getByText("Loading auctions...", { exact: true }).waitFor();
    await page.getByText("Loading auctions...", { exact: true }).waitFor({ state: "hidden" });
    listDelay = 0;
    auctions = [];
    await page.getByRole("button", { name: "Refresh", exact: true }).click();
    await page.getByText("No auctions yet. Create an auction to get started.", { exact: true }).waitFor();
    pass("Loading, failure with retry, and empty lists have distinct usable states");
    roles = ["User"];
    await page.reload();
    await page.getByText("Administrator access is required.", { exact: true }).waitFor();
    assert.equal(await page.getByRole("heading", { name: "Auction Management", exact: true }).count(), 0);
    pass("Ordinary accounts cannot access admin auction management");
    assert.deepEqual(report.runtimeErrors, []);
    assert.deepEqual(report.dialogWarnings, []);
    pass("No uncaught runtime errors or missing dialog descriptions");
  } catch (error) {
    report.failed = error.message;
    process.exitCode = 1;
    await page.screenshot({ path: output + "/failure.png", fullPage: true }).catch(() => {});
  } finally {
    await browser.close();
    fs.writeFileSync(output + "/results.json", JSON.stringify(report, null, 2) + "\n");
    console.log(JSON.stringify(report, null, 2));
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
