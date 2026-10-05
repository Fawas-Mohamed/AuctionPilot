# Fresh demo release review — 2026-10-04

Branch: codex/neon-render-demo-migration. This review follows the initial migration verification. GitHub publication is authorized; merging and production frontend promotion are separate steps. Azure data/resources remain preserved. Only Free resources are in scope.

## PostgreSQL evidence

The tests use NpgsqlConnection and UseNpgsql against an isolated PostgreSQL 17 server at 127.0.0.1:55439. Each fixture creates its own ap_test_* schema, applies the PostgreSQL migration, and removes only that owned schema. No SQLite, EF in-memory database or mocked database provider is used.

The earlier recorded 31-test run had zero skips, but its custom attribute could skip database tests if configuration was absent. That mismatch was corrected: missing AUCTIONPILOT_TEST_CONNECTION now fails explicitly. A new test asserts Database.IsNpgsql(), SELECT version() starting with PostgreSQL, the applied InitialPostgreSqlDemo migration and no pending migrations.

Final review run: 32 passed, 0 failed, 0 skipped. A separate negative run with the connection removed failed with the intended missing-configuration error. This is a passing guard check, not an unresolved suite failure. The TRX files are postgres-review.trx and missing-connection.trx under the ignored TestResults directory.

The business tests start independent DbContexts/connections concurrently. They cover 20 competing unequal bids, 12 equal bids, 10 identical UUID retries, a bid holding the row lock while closure waits, closure holding the row lock while a bid waits, server expiry during lock wait, 10 repeated closures, native xmin conflicts, and rollback after database writes before commit. Fresh connections observe committed notification/state consistency before transport events. These exercise real PostgreSQL locks and transactions.

Demo initialization was also reviewed: roles, private admin and categories now seed inside one transaction, so a failure cannot leave a partially created administrator behind.

## Secret review

Gitleaks v8.30.1 was downloaded from its official release and SHA-256 verified. The exact staged migration diff reports zero secret findings. Only backend/.env.example and frontend/.env.example are staged; both contain placeholders. Local .env files and deployment tool credentials are ignored. The pre-existing Azure ServiceDependencies files are excluded from the migration commit.

Full existing HEAD history was also scanned. That scan exits 1 with four detections in commit d9355b636f2988459579f0a37b7115cbcb989f3f:
- backend/.vs/New folder/config/applicationhost.config, lines 126–127.
- backend/.vs/AuctionApi/config/applicationhost.config, lines 126–127.

These are IIS protected-configuration provider sessionKey attributes. They are historical local server configuration values, not newly introduced cloud credentials. The .vs files are no longer tracked in the current tree. No history rewrite or Azure credential/resource change was performed. Do not reuse those historical values. Treat the history scan as findings requiring review if the original IIS environment is retained; do not call the entire repository history secret-free.

Microsoft describes these IIS encryption providers and machine-specific key containers in [Shared Configuration with IIS](https://learn.microsoft.com/en-us/iis/manage/managing-your-configuration-settings/shared-configuration_264). Their absence from the new tree and the separate Render-generated JWT key limit this demo's exposure; this is an inference, not proof that every historical value is harmless.

## Current npm audit

Rechecked against the registry and GitHub advisory on 2026-10-04. npm audit --json still exits 1 with eight high findings and no moderate/critical findings. They are one underlying braces stack-exhaustion issue and seven dependent-package findings, rather than eight independent exploitable bugs.

The underlying [GHSA-vfj7-8cjw-p6xm / CVE-2026-93687](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) was updated 2026-10-02, affects braces through 3.0.3, and lists no patched release. npm view confirms 3.0.3 is still the newest published braces version.

Installed roots and exact paths:

    tailwindcss@3.4.19
      -> chokidar@3.6.0 -> braces@3.0.3
      -> micromatch@4.0.8 -> braces@3.0.3
      -> fast-glob@3.3.3 -> micromatch@4.0.8 -> braces@3.0.3

    @tailwindcss/typography@0.5.20 -> tailwindcss@3.4.19 -> paths above
    lovable-tagger@1.3.5 -> tailwindcss@3.4.19 -> paths above
    tailwindcss-animate@1.0.7 -> tailwindcss@3.4.19 -> paths above

All three dependent roots resolve the same installed Tailwind peer. Tailwind 3.4.19, chokidar 3.6.0, micromatch 4.0.8 and fast-glob 3.3.3 are already the newest compatible versions in those lines. npm audit fix --dry-run --json proposes zero dependency version changes. Its fast-glob fixAvailable flag does not remove the affected parser; suggested force actions include downgrading typography/tagger, and do not supply a patched braces release. No force upgrade, arbitrary override, audit exclusion or advisory suppression was applied.

Earlier compatible dependency updates and explicit patched Vite 6.4.3 / React Router 7.18.4 are retained. Moving to Tailwind 4 would require a separately verified CSS/tooling migration; it is not a compatible drop-in fix for this preserved design.

Practical impact: deeply nested attacker-controlled brace patterns can terminate a Node build/watch process. The project's Tailwind content globs are source-controlled; public auction text, bids and images are not passed to this build parser. A fresh production build was inspected through Rollup's emitted chunk module map: none of the eight audited packages appears in browser JavaScript chunks. Render runs the .NET backend, and Vercel serves static assets. These facts limit the observed runtime exposure, but build/CI jobs processing untrusted glob configuration could still be affected. The audit remains failed.

## Browser and deployment checks

Nine Chrome checks passed against the existing production frontend bundle served locally, with API requests explicitly simulated as unavailable: homepage/demo notice, auction SPA deep link, payment URL with a misleading query, anonymous result URL with a misleading query, three admin route redirects, disabled consignment submission and no uncaught browser runtime errors.

This is local browser verification, not a live backend/deployment acceptance claim. tests/browser-acceptance.cjs can be rerun against the eventual Vercel preview without mock mode. Its output and screenshot are saved under ignored .local/. Build tooling was installed only under .local/browser-tools; it does not change production dependencies.

Render CLI v2.28.0 was downloaded from the official release and checksum verified. Render access is now authorized, Blueprint validation passed, and Render's remote Docker build passed for commit 8b10ff61d54ef80b3f2832b4c75a05b47db78db7. The service's first startup failed on the missing ConnectionStrings__DefaultConnection guard. Neon initialization, live /health/ready, Cloudinary uploads, actual WebSocket reconnect/block behavior and natural sleep/wakeup remain unverified pending saved provider settings. Local Docker Desktop availability is not used as a substitute for Render's requested remote build.

The first external acceptance gate is Render startup after explicit initialization of the empty Neon demo. Verify remote Docker success and /health/ready before setting Vercel Preview variables. Keep preview variables scoped to this branch and do not change Production values or promote the preview as part of this step.

## GitHub publication and remote CI

The migration was committed and pushed as 1fc547a033fef08c3fa674824aecffafbec40fbf, on top of the latest main documentation. [PR #1](https://github.com/Fawas-Mohamed/AuctionPilot/pull/1) is open and unmerged.

Both the [push workflow](https://github.com/Fawas-Mohamed/AuctionPilot/actions/runs/37212148487) and [PR workflow](https://github.com/Fawas-Mohamed/AuctionPilot/actions/runs/37212260825) passed. Each ran backend build, real PostgreSQL 17 integration tests, upload smoke checks, npm lockfile installation, TypeScript, production frontend build and Docker build on the Linux runner.

The follow-up source commit 8b10ff6 also passed both the [push workflow](https://github.com/Fawas-Mohamed/AuctionPilot/actions/runs/37221710623) and [PR workflow](https://github.com/Fawas-Mohamed/AuctionPilot/actions/runs/37221713944), including Docker. Render's own build has since passed as recorded below. No Neon schema or Cloudinary assets have been created by the agent at this checkpoint.

Use tests/Check-DemoBackend.ps1 with the actual Render origin after its remote deployment succeeds. It checks liveness, database readiness, reconciled public state and an exact CORS preflight, once each. Run it before configuring Vercel Preview variables, then rerun it with the exact preview origin after adding that origin to CORS.

## Render deployment checkpoint — 2026-10-05

Render authorization succeeded and the sole workspace was selected. Render's API validated render.yaml with valid=true and a plan containing only auctionpilot-demo-api. A separate service was created through the Render API with the reviewed Blueprint-equivalent settings, rather than modifying existing services:

| Setting | Verified value |
| --- | --- |
| Service | auctionpilot-demo-api / srv-db19ftm0tbcc73a5l8g0 |
| Origin | https://auctionpilot-demo-api.onrender.com |
| Instance / region | Free / Singapore |
| Source branch | codex/neon-render-demo-migration |
| Runtime / Dockerfile / context | Docker / ./backend/Dockerfile / . |
| Automatic deploys / health path | off / /health |
| Initial build commit | 8b10ff61d54ef80b3f2832b4c75a05b47db78db7 |
| Initial deployment | dep-db19fu60tbcc73a5l9rg |

Render logs confirm successful .NET restore and publish, completed image-layer upload, and completed build-cache export. The container then executed and failed with Set ConnectionStrings__DefaultConnection. The deployment status is update_failed; a successful image build is not a ready backend.

The documented Check-DemoBackend.ps1 gate was run once against the actual service. Its first /health request timed out. /health/ready, auction reconciliation and CORS steps consequently did not execute and remain unverified.

A configuration-name check found only the nine supplied defaults, with no linked environment group. ConnectionStrings__DefaultConnection, the three Cloudinary__ settings and both AdminSeed__ settings are still missing; both Database__ initialization flags remain false. Saved values must become visible on this exact service before initialization can proceed. Secret values were neither printed nor committed. Jwt__Key was generated in memory and stored only in Render. CLI authorization remains in Render's local credential file.

Passed: Render authorization, Blueprint validation, separate Free service configuration, remote Docker build/image upload. Failed: first container startup due to missing database configuration, and the bounded /health gate timeout. Unverified: Neon migrations/seeding, live readiness/CORS, Cloudinary upload, Vercel Preview, live authenticated browser/WebSocket/sleep checks. Azure and the three unrelated existing Render services are untouched. No paid service was enabled.

The owner requested a dashboard walkthrough. See the current service setup section in PORTFOLIO-DEMO-DEPLOYMENT.md. Initialization remains a first-boot startup action on the confirmed empty Neon database; no separate paid migration job is used.
