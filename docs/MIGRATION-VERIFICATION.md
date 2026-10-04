# Migration verification and changed-file map

Checked 2026-10-04 in D:\auctionpilot. Branch: codex/neon-render-demo-migration. Initial migration results are recorded below; see DEMO-RELEASE-REVIEW.md for the follow-up review and publication/deployment gates. The requested hardening branch/commit was absent, so the protections were rebuilt against the available source.

## Implemented behavior and files

| Area | Main files | Result |
| --- | --- | --- |
| PostgreSQL | backend/AuctionApi.csproj; Data/ApplicationDbContext.cs; Data/DesignTimeDbContextFactory.cs; Migrations/Postgres/*; Models/Auction.cs, Bid.cs, Notification.cs, Watchlist.cs, ApplicationUser.cs, ImageAsset.cs | EF Core 8/Npgsql; separate PostgreSQL baseline; numeric(18,2); UTC normalization; xmin; relationship restrictions; bid/notification uniqueness and state checks |
| Authoritative auction writes | Services/BidService.cs; AuctionResolver.cs; AuctionEvents.cs; AuctionReconciler.cs; AuctionSchedule.cs; AuctionCloserHostedService.cs; AuctionFreshnessFilter.cs | Shared row lock for bid/closure, request UUID deduplication, deadline checks after locking, reserve rules, atomic state/notifications, broadcast after commit, recovery after sleep |
| Authentication and authorization | Program.cs; Services/TokenService.cs, TokenUserValidator.cs; Hubs/*; Controllers/AuthController.cs, AdminUsersController.cs, AdminReportsController.cs, DevAuditController.cs | Fresh user/stamp/roles checks, lockout/block checks, authenticated hubs, admin restrictions, immediate socket abort on account changes, no client-callable broadcast methods, transactional registration |
| Safe API state | Controllers/AuctionsController.cs, AdminAuctionController.cs, AccountController.cs, WatchlistController.cs; Dtos/AuctionResponse.cs, CreateAuctionDto.cs, PlaceBidDto.cs | Public display DTOs, server-owned seller/image fields, personal verified result endpoint, safe history-preserving admin edits/deletion |
| Images | Utils/ImageUploadValidation.cs; Services/CloudinaryImageStorage.cs, ImageAssetService.cs; Controllers/UploadController.cs, AccountController.cs; Dtos/ImageUploadDto.cs | Authenticated full decode/re-encode of JPG/PNG/WebP; dimension/content/size validation; signed server upload; owned asset metadata; failure responses; old assets retained |
| Demo scope | Controllers/PaymentsController.cs, ConsignmentsController.cs; frontend/src/App.tsx; components/PayButton.tsx; pages/PaymentSuccess.tsx, AuctionResultPage.tsx, CreateConsignment.tsx | Demo banner; unfinished flows disabled; no URL-only payment/winner claims |
| Frontend network/auth | src/lib/config.ts, api.ts, auth.ts, signalr.ts, hub.ts, bidding.ts; hooks/useServerRefresh.ts; contexts/AuthContext.tsx; components/Header.tsx, NotificationBell.tsx, AdminRoute.tsx; src/main.tsx | Central public URLs; fresh hub tokens/room restoration; stored-state recovery; bounded read/start retries; manual bid retry UUID; notification deduplication; admin route guards |
| Existing page integration | pages/Admin/AdminAuctions.tsx, AdminReports.tsx, AdminUsers.tsx; AuctionDetails.tsx, Auctions.tsx, AuctionsList.tsx, AuctionsPage.tsx, Browse.tsx, CategoryPage.tsx, CreateAuction.tsx, Dashboard.tsx, Index.tsx, LiveAuction.tsx, MyAuctions.tsx, UserProfile.tsx, Watchlist.tsx | URL/UTC/event integration; canonical bid reads; upload-before-create; admin role casing/creation endpoint; ordinary dashboard uses authorized APIs; no runaway MyAuctions render requests |
| Hosting/config | backend/Dockerfile; .dockerignore; render.yaml; backend/appsettings.json; backend/.env.example; frontend/.env.example; frontend/vite.config.ts; frontend/package*.json; .config/dotnet-tools.json; .github/workflows/demo-checks.yml; root .gitignore | Non-root multistage .NET container; Free Render Blueprint; exact CORS/proxy/health settings; secret placeholders; URL build validation; patched Vite/router; CI with PostgreSQL/Docker |
| Tests/docs | tests/AuctionApi.Tests/*; tests/UploadValidationSmoke/*; backend/Migrations/README.md; docs/PORTFOLIO-DEMO-DEPLOYMENT.md | Executable security/real PostgreSQL checks; full setup, acceptance and rollback guide |

Original root SQL Server migration files, original snapshot, frontend styles, Tailwind configuration, static assets and components/ui were checked unchanged. Existing backend/frontend .gitignore edits and Azure ServiceDependencies files were present before this task; they were preserved. Local .env contents were not read, altered or copied into examples.

## Passed commands

| Command | Final result |
| --- | --- |
| dotnet tool restore | EF Core CLI 8.0.30 restored |
| dotnet build backend/AuctionApi.csproj -c Release | Passed |
| dotnet ef migrations add InitialPostgreSqlDemo --project backend/AuctionApi.csproj --output-dir Migrations/Postgres --namespace AuctionApi.Migrations.Postgres | PostgreSQL baseline generated and applied to isolated test schemas |
| dotnet ef migrations has-pending-model-changes --project backend/AuctionApi.csproj --no-build --configuration Release | No pending model changes; the design-time factory works without runtime secrets |
| dotnet test tests/AuctionApi.Tests/AuctionApi.Tests.csproj -c Release --logger "trx;LogFileName=postgres-tests.trx" | 32 passed, 0 failed, 0 skipped in the follow-up review |
| dotnet run --project tests/UploadValidationSmoke/UploadValidationSmoke.csproj -c Release | 9 passed |
| dotnet publish backend/AuctionApi.csproj -c Release -o artifacts/backend --no-restore /p:UseAppHost=false | Passed |
| dotnet list backend/AuctionApi.csproj package --vulnerable --include-transitive | No known vulnerable packages reported |
| npm ci (frontend) | Lockfile installation passed |
| npm run typecheck (frontend) | Both application and Vite/node TypeScript configurations passed |
| npm run build (frontend) | Vite 6.4.3 production build passed with placeholder HTTPS API/hub environment values |
| git diff --check with cr-at-eol | Passed; Windows CRLF handled without altering preserved user files |
| git diff --exit-code on legacy migrations/styles/UI primitives | Passed; unchanged |
| HTTP GET existing Vercel /, /auctions/1, /payment-success | Each returned 200 with SPA root HTML |

The frontend build used VITE_API_URL=https://auctionpilot-demo-api.onrender.com/api and VITE_SIGNALR_URL=https://auctionpilot-demo-api.onrender.com/hubs/auction. These are configuration placeholders, not verified deployment URLs.

The tests used an isolated PostgreSQL 17 cluster under .local/postgres-demo-20261004, bound only to 127.0.0.1:55439 with synthetic data, under Asia/Colombo server timezone. Each database fixture owns a unique ap_test_* schema and cleans only that schema. The cluster was stopped afterward; its synthetic files remain ignored. No Azure database or existing local database was reset.

Set AUCTIONPILOT_TEST_CONNECTION to an isolated PostgreSQL connection before running the integration suite. The tests require a real PostgreSQL server; do not use Azure/production credentials. Final TRX output is under tests/AuctionApi.Tests/TestResults/postgres-tests.trx (ignored).

Coverage includes equal/different competing bids, GUID retries after closure, both bid/close lock orders, server deadlines while waiting for a lock, repeated closure, reserve/no-bid outcomes, rollback after SQL writes but before commit, xmin conflicts, registration/login, HTTP/hub roles, stale/blocked tokens, data privacy, UTC conversion, exact CORS, image content/size/failure cases, verified results and disabled demo flows. A real SignalR client connected through TestServer LongPolling; reconnect recovered stored notifications, fabricated events failed and blocking disconnected an established session.

## Failed and unresolved checks

- docker build -f backend/Dockerfile -t auctionpilot-demo:verify . failed because the DockerDesktopLinuxEngine named pipe/daemon was unavailable. The container has not been built or run locally. CI includes a Docker build, but remote CI was not run.
- npm audit --json exits 1 with 8 high findings in the Tailwind 3 build dependency chain: braces, chokidar, micromatch, fast-glob, tailwindcss, @tailwindcss/typography, lovable-tagger and tailwindcss-animate. The underlying [braces advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) has no published fixed version. Compatible updates and explicit patched Vite 6.4.3 / React Router 7.18.4 reduced the initial 22 findings (19 high) to 8 high. The audit has not been suppressed or marked clean. Tailwind's major redesign/migration was not forced.
- The frontend reports the existing large-bundle warning: about 1.13 MB JS, 324 KB gzip. SignalR's PURE annotation warnings remain. The checks still pass; no warning thresholds were raised.
- Initial implementation checks found issues that were corrected and rerun: malformed WebP handling, MVC record-validation attributes, timezone precision, hub test interface setup and TypeScript integration errors. Those earlier failures are not final failures.

The brace parser is used by the build dependency graph; no public endpoint accepts build glob patterns. This limits the observed exposure but does not resolve the dependency advisory.

## Unrun / access blocked

No actual Neon/Cloudinary/Render/Vercel migration deployment, live Cloudinary upload, Render WebSocket upgrade, natural Render sleep/wakeup browser test, remote GitHub Actions run, postdeployment browser acceptance or live visual screenshot regression was performed. Local Chrome checks were added and passed in the follow-up review. ESLint was not run; the requested frontend build and TypeScript checks were run. Cloudinary transport/signed payload behavior was tested with HTTP stubs, not real credentials.

No connected provider accounts, actual backend host, Neon connection or Cloudinary credentials were available. No paid plan, disk, worker or cron was selected. GitHub publication is authorized in the follow-up task. No Azure restart, data import, cloud deletion or production resource cutover was performed.

Auction state and notification writes are durable, but a post-commit live broadcast can be lost if transport fails. Reconnect/visibility refreshes recover through stored API state; there is no durable event outbox. Cloudinary upload followed by database failure may leave a new orphan; it returns failure and leaves deliberate cleanup metadata/logs. Replaced images are retained, consuming quota. Existing admin report charts are clearly labeled sample data.

## Verified existing URLs

- https://auction-pilot.vercel.app/
- https://auction-pilot.vercel.app/auctions/1
- https://auction-pilot.vercel.app/payment-success

Only HTTP/SPA routing was verified on the existing deployment. None of these pages contains this unpublished migration yet. See PORTFOLIO-DEMO-DEPLOYMENT.md for exact environment names, deployment order, acceptance checks, official free-tier sources and rollback.
