const assert = require("node:assert/strict");
const fs = require("node:fs");
const { chromium } = require(process.env.AUCTIONPILOT_PLAYWRIGHT_MODULE || "../.local/browser-tools/node_modules/playwright");

(async () => {
  const base = process.env.AUCTIONPILOT_PREVIEW_URL;
  const backend = process.env.AUCTIONPILOT_API_ORIGIN;
  const mock = process.env.AUCTIONPILOT_BROWSER_MOCK_API === "1";
  assert(base && backend, "Set AUCTIONPILOT_PREVIEW_URL and AUCTIONPILOT_API_ORIGIN to the reviewed demo targets.");
  if (mock) assert(["localhost", "127.0.0.1"].includes(new URL(base).hostname), "Mock mode is limited to local previews.");
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  if (mock) await page.route(backend + "/**", async route => {
    const result = route.request().url().includes("/result");
    await route.fulfill({ status: result ? 401 : 503, contentType: "application/json",
      body: JSON.stringify({ message: result ? "Sign in required." : "Synthetic backend cold start." }) });
  });
  const passed = [];
  async function visit(path) {
    const response = await page.goto(base + path, { waitUntil: "domcontentloaded" });
    assert.equal(response.status(), 200, "SPA deep link failed: " + path);
    await page.getByRole("note").filter({ hasText: /^Portfolio demo · Synthetic auctions/ }).waitFor();
  }
  try {
    await visit("/");
    assert(await page.locator("main").isVisible());
    passed.push("Homepage renders and displays the portfolio demo notice");
    await visit("/auctions/1");
    assert(await page.locator("main").isVisible());
    passed.push("Auction deep link serves and renders the SPA");
    const closedId = process.env.AUCTIONPILOT_CLOSED_AUCTION_ID;
    if (closedId) {
      assert(!mock && /^\d+$/.test(closedId), "Closed-auction regression requires a live synthetic closed auction ID.");
      const stored = await page.request.get(backend + "/api/auctions/" + closedId);
      assert.equal(stored.status(), 200, "Closed-auction fixture is unavailable.");
      assert.equal((await stored.json()).isClosed, true, "Regression fixture must be closed by the backend.");
      await visit("/auctions/" + closedId);
      const bid = page.getByRole("button", { name: "Place Bid", exact: true });
      await bid.waitFor();
      assert(await bid.isDisabled(), "A persisted closed auction must disable bidding without a realtime event.");
      passed.push("Persisted closed auction disables bidding after a direct browser load");
    }
    await visit("/payment-success?paid=true");
    await page.getByText("Payments are unavailable. This page does not confirm a payment or transaction.").waitFor();
    passed.push("Payment URL never confirms a payment");
    await visit("/auction-result/1?winner=true");
    await page.getByText("Sign in to view a verified demo result.").waitFor({ timeout: 150000 });
    assert(!(await page.locator("main").innerText()).includes("You won this demo auction."));
    passed.push("Result URL cannot fabricate an anonymous auction win");
    for (const path of ["/auctionmanage", "/usermanage", "/admin"]) {
      await visit(path);
      await page.waitForURL("**/login");
      passed.push("Anonymous admin route redirects to sign-in: " + path);
    }
    await visit("/hello");
    assert(await page.locator('main button[type="submit"]').isDisabled());
    passed.push("Consignment submission remains disabled");
    assert.deepEqual(errors, [], "Browser runtime errors occurred");
    passed.push("No uncaught browser runtime errors");
    fs.mkdirSync(".local", { recursive: true });
    await page.screenshot({ path: ".local/browser-consignment.png", fullPage: true });
    const result = { mode: mock ? "local production bundle with simulated unavailable API" : "live anonymous preview", base, backend, passed };
    fs.writeFileSync(".local/browser-acceptance.json", JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
