const assert = require("node:assert/strict");
const fs = require("node:fs");
const crypto = require("node:crypto");
const { chromium } = require(process.env.AUCTIONPILOT_PLAYWRIGHT_MODULE || "../.local/browser-tools/node_modules/playwright");

(async () => {
  const base = process.env.AUCTIONPILOT_PREVIEW_URL;
  const backend = process.env.AUCTIONPILOT_API_ORIGIN;
  const mock = process.env.AUCTIONPILOT_BROWSER_MOCK_API === "1";
  assert(base && backend, "Set AUCTIONPILOT_PREVIEW_URL and AUCTIONPILOT_API_ORIGIN.");
  if (mock) assert(["localhost", "127.0.0.1"].includes(new URL(base).hostname), "Mock fixtures require localhost.");
  else {
    assert.equal(backend, "https://auctionpilot-demo-api.onrender.com", "Live fixtures are restricted to the fresh demo backend.");
    assert.equal(process.env.AUCTIONPILOT_CREATE_SYNTHETIC_FIXTURE, "1", "Explicitly enable a new synthetic demo account and auction.");
    assert(new URL(base).hostname.endsWith(".vercel.app"), "Use the reviewed Vercel preview.");
  }
  const report = { mode: mock ? "Local production bundle with image fixtures" : "Live Vercel/Render/Neon no-image fixture", base, backend, passed: [], failed: [], auctionId: null };
  const errors = [];
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const page = await browser.newPage();
  page.setDefaultTimeout(mock ? 10000 : 60000);
  page.on("pageerror", error => errors.push(error.message));
  let credentials;
  function pass(check) { report.passed.push(check); console.log("PASS: " + check); }
  try {
    if (mock) {
      const fixture = { startTime: "2026-10-05T10:00:00Z", endTime: "2026-10-06T10:00:00Z", createdAt: "2026-10-05T10:00:00Z", status: "upcoming", startPrice: 100, currentPrice: 100, bidCount: 0 };
      const auctions = [
        { ...fixture, id: 1, title: "Null image", imageUrl: null },
        { ...fixture, id: 2, title: "Omitted image" },
        { ...fixture, id: 3, title: "Empty image", imageUrl: "" },
        { ...fixture, id: 4, title: "HTTPS image", imageUrl: "https://res.cloudinary.com/demo/image/upload/test.png" },
        { ...fixture, id: 5, title: "Relative image", imageUrl: "/uploads/test.png" },
        { ...fixture, id: 6, title: "Filename image", imageUrl: "test.png" },
      ];
      await page.route(backend + "/**", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(route.request().url().split("?")[0] === backend + "/api/auctions/my" ? auctions : []) }));
      await page.route("https://res.cloudinary.com/**", route => route.abort());
      await page.goto(base + "/my-auctions");
    } else {
      credentials = { email: "no-image-" + crypto.randomUUID() + "@example.invalid", password: "Demo!" + crypto.randomBytes(20).toString("hex") + "8" };
      await page.goto(base + "/register");
      await page.locator("#firstName").fill("Synthetic");
      await page.locator("#lastName").fill("No Image Seller");
      await page.locator("#email").fill(credentials.email);
      await page.locator("#password").fill(credentials.password);
      await page.locator("#confirmPassword").fill(credentials.password);
      await page.locator("#terms").click();
      const registration = page.waitForResponse(r => r.url() === backend + "/api/auth/register" && r.request().method() === "POST");
      await page.getByRole("button", { name: "Create Account", exact: true }).click();
      assert([200, 201].includes((await registration).status()), "Synthetic registration failed.");
      await page.waitForURL(base + "/");
      pass("Synthetic seller registers through the live browser");
      await page.goto(base + "/auctions/create");
      await page.getByPlaceholder("Title", { exact: true }).fill("Synthetic no-image regression auction");
      await page.getByPlaceholder("Description", { exact: true }).fill("Synthetic image regression. No payments, shipping or settlement.");
      await page.getByPlaceholder("Start Price", { exact: true }).fill("100");
      const times = await page.evaluate(() => {
        const local = d => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
        return [local(new Date(Date.now() - 60000)), local(new Date(Date.now() + 300000))];
      });
      for (let i = 0; i < 2; i++) await page.locator('input[type="datetime-local"]').nth(i).fill(times[i]);
      await page.locator("select option").nth(1).waitFor({ state: "attached" });
      await page.locator("select").selectOption({ index: 1 });
      const creation = page.waitForResponse(r => r.url() === backend + "/api/auctions" && r.request().method() === "POST");
      await page.getByRole("button", { name: "Create Auction", exact: true }).click();
      const response = await creation;
      assert.equal(response.status(), 201, "No-image auction creation failed.");
      const auction = await response.json();
      assert.equal(auction.imageUrl, null, "The live fixture must have a genuine null image URL.");
      report.auctionId = auction.id;
      pass("Live auction form creates a Neon auction without an uploaded image");
      await page.goto(base + "/my-auctions");
    }
    await page.getByRole("heading", { name: "My Auctions", exact: true }).waitFor();
    await page.getByRole("tab", { name: "My Auctions", exact: true }).click();
    const panel = page.getByRole("tabpanel");
    if (mock) {
      for (const title of ["Null image", "Omitted image", "Empty image"]) {
        const card = panel.locator("div.rounded-lg.border").filter({ has: page.getByRole("heading", { name: title, exact: true }) });
        await card.getByText("No image", { exact: true }).waitFor();
        assert.equal(await card.locator("img").count(), 0);
        pass(title + " renders a fallback without an image element");
      }
      for (const [title, src] of [["HTTPS image", "https://res.cloudinary.com/demo/image/upload/test.png"], ["Relative image", backend + "/uploads/test.png"], ["Filename image", backend + "/uploads/test.png"]]) {
        assert.equal(await panel.getByRole("img", { name: title, exact: true }).getAttribute("src"), src);
        pass(title + " preserves the correctly resolved image URL");
      }
    } else {
      await panel.getByRole("heading", { name: "Synthetic no-image regression auction", exact: true }).waitFor();
      await panel.getByText("No image", { exact: true }).waitFor();
      assert.equal(await panel.locator("img").count(), 0);
      pass("My Auctions renders the real null-image auction and its fallback");
      await page.reload();
      await page.getByRole("tab", { name: "My Auctions", exact: true }).click();
      await panel.getByText("No image", { exact: true }).waitFor();
      pass("A direct reload with persisted null-image data remains usable");
    }
    assert.deepEqual(errors, [], "Uncaught browser runtime errors occurred.");
    pass("No uncaught browser runtime errors");
    await page.screenshot({ path: ".local/browser-my-auctions.png", fullPage: true });
  } catch (error) {
    let message = error.message;
    if (credentials) message = message.replaceAll(credentials.password, "[withheld]");
    report.failed.push(message);
    process.exitCode = 1;
  } finally {
    await browser.close();
    report.runtimeErrors = errors;
    fs.mkdirSync(".local", { recursive: true });
    fs.writeFileSync(".local/browser-my-auctions.json", JSON.stringify(report, null, 2) + "\n");
    console.log(JSON.stringify(report, null, 2));
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
