# AuctionPilot portfolio demo deployment

Prepared and limits checked on 2026-10-04. Branch: codex/neon-render-demo-migration.

## Data and scope

The owner chose a fresh public demo with Azure data preserved separately. Create a separate empty Neon project/database; do not import Azure users, bids, auctions or images. No Azure resources were restarted, modified or deleted by this work. Keep Azure backups, original upload storage and the SQL Server migration history.

The earlier local branch codex/portfolio-demo-hardening and commit ae7faaf were unavailable in this checkout. The supplied release-candidate directory contained only an upload smoke program. The migration therefore implements the protections against the actual checkout, with executable tests.

This release supports synthetic auctions and bidding. Payments, shipping, settlement and consignments are disabled. Auction wins are verified through the authenticated result API. A payment-success URL never verifies a payment.

## Required settings

ASP.NET Core reads environment variables, not .env files automatically. Use Render's Environment UI or exported shell variables. backend/.env.example and frontend/.env.example contain placeholders only. Do not paste secrets into source files or use VITE variables for them.

### Render backend environment

| Exact name | Value / purpose |
| --- | --- |
| ASPNETCORE_ENVIRONMENT | Production |
| PORT | 10000; Render provides the listening port |
| ConnectionStrings__DefaultConnection | Npgsql connection string for the separate empty Neon database |
| Jwt__Key | Random server-only secret of at least 32 UTF-8 bytes; Blueprint generates one |
| Jwt__Issuer | AuctionAPI |
| Jwt__Audience | AuctionClient |
| CORS_ALLOWED_ORIGINS | https://auction-pilot.vercel.app; exact comma-separated additional origins only |
| Cloudinary__CloudName | Cloudinary product environment cloud name |
| Cloudinary__ApiKey | Cloudinary server API key |
| Cloudinary__ApiSecret | Cloudinary server API secret |
| Proxy__TrustRender | true on Render only |
| Database__ApplyMigrations | true for explicitly reviewed first boot on an empty database; false afterward |
| Database__SeedDemo | true for first boot roles/categories/admin; false afterward |
| AdminSeed__Email | Private demo administrator email for first seed |
| AdminSeed__Password | Strong private password for first seed; remove afterward |

RENDER=true is provided by Render. It gates proxy trust; do not set it for local hosting. Legacy JWT_KEY, ADMIN_EMAIL and ADMIN_PASSWORD aliases remain supported; use the canonical names above for this release.

Use the connection details supplied by Neon. Example syntax (replace every placeholder):

    Host=ep-YOUR-ENDPOINT-pooler.YOUR-REGION.aws.neon.tech;Port=5432;Database=auctionpilot_demo;Username=YOUR_ROLE;Password=YOUR_PASSWORD;SSL Mode=VerifyFull;Maximum Pool Size=5;Minimum Pool Size=0;Connection Idle Lifetime=30;Timeout=30;Command Timeout=30

Use the pooled host shown by Neon and a database-specific role where practical. Quote/escape connection-string values containing delimiters with Npgsql's syntax. Do not disable certificate validation or use an Azure connection. The runtime rejects production connections without VerifyFull and caps oversized pools.

CORS entries must be HTTPS origins without paths, wildcards or trailing slashes. Add an exact Vercel preview URL only if you deliberately intend to test it; remove it afterward. Do not broadly authorize all vercel.app sites.

### Vercel frontend environment

| Exact name | Value |
| --- | --- |
| VITE_API_URL | https://ACTUAL-RENDER-HOST.onrender.com/api |
| VITE_SIGNALR_URL | https://ACTUAL-RENDER-HOST.onrender.com/hubs/auction |

Both are public URLs. API and hub must share an origin and use these exact paths. The production build rejects invalid/missing API configuration. Environment changes require a frontend rebuild. Never set a database connection, JWT signing key or Cloudinary secret in Vercel's VITE namespace.

## Deployment sequence

1. Review the branch and pass local/CI checks. Publish the reviewed branch to GitHub only when ready. The worktree also contains pre-existing user changes and Azure ServiceDependencies files; review staging rather than blindly adding everything. Publication and review results are recorded in DEMO-RELEASE-REVIEW.md and the pull request.
2. In Neon, select Free and create a separate project/database named auctionpilot_demo in AWS Singapore (ap-southeast-1) if offered, alongside the Singapore Render service. Confirm the selected schema is empty. Preserve Azure independently; this branch cannot be used to run the old SQL Server backend.
3. In Cloudinary, select Free. Copy cloud name/API credentials into Render's secret settings. No unsigned public upload preset is required. Uploads are signed by the backend. Images are decoded and re-encoded; supported single-frame formats are JPG, PNG and WebP, at most 5 MiB, 8192 pixels per dimension and 20 million pixels.
4. Create a Render Blueprint from the reviewed branch using render.yaml. Select the Free Docker web service, region Singapore, repository-root Docker context and backend/Dockerfile. Automatic deploy is off. Do not add a paid database, worker, disk or cron.
5. Fill all backend settings. For the first boot only, set Database__ApplyMigrations=true and Database__SeedDemo=true, with a private administrator email/password. The initializer refuses an unreviewed nonempty PostgreSQL schema, never drops/reset data, and never promotes an existing account by changing the seed email. The Blueprint defaults both flags to false.
6. Manually deploy Render. Inspect startup logs for successful migration/reconciliation. Verify Render's Docker build and deployment succeeded, then run tests/Check-DemoBackend.ps1 -BackendOrigin https://ACTUAL-RENDER-HOST.onrender.com. It checks /health, /health/ready, public reconciled state and CORS. /health is the configured liveness path; it does not query Neon on every probe. The application checks database/schema readiness and reconciles expired auctions before startup succeeds.
7. Set both initialization flags back to false and remove AdminSeed__Password (and preferably AdminSeed__Email). Deploy the environment change. Keep the JWT key stable across ordinary releases; changing it signs everyone out.
8. Sign in as the private demo administrator. Register synthetic seller/bidder accounts using addresses you control. Upload new demo images and create auctions through the existing forms. Seeded roles/categories/admin do not automatically create auctions. Never share the administrator password publicly.
9. Keep the existing Vercel project. Root directory: frontend; framework: Vite; Node: 22; install: npm ci; build: npm run typecheck && npm run build; output: dist. Set the two public URL variables to the actual Render host. Select the Preview environment, scoped to codex/neon-render-demo-migration, for the two URL variables. Deploy a preview only after backend readiness, add its exact CORS origin, and verify it. Production promotion is a separate decision. Preserve frontend/vercel.json's SPA rewrite.
10. Run the manual acceptance checks below against the actual new services. The previously local placeholder auctionpilot-demo-api.onrender.com now belongs to the provisioned Free service. Its remote Docker build passed; startup/readiness still require provider configuration.

## Manual acceptance after accounts are connected

- Load the Vercel root and directly open /auctions/ID, /auction-result/ID and /payment-success. Browser refresh must render the SPA.
- Register two synthetic bidders and a seller; sign in/out. A normal user cannot access admin APIs or either admin page/hub; anonymous hub connections fail.
- Upload valid JPG/PNG/WebP auction images and an avatar. Spoofed MIME, truncated data and oversized files fail; Cloudinary errors never show a saved image. Inspect the stored ImageAssets metadata and returned HTTPS Cloudinary URL.
- Create future, running, reserve-unmet and expired auctions. Verify displayed local times correspond to stored UTC instants.
- Use two browser sessions to bid simultaneously. Retry an uncertain bid with its original request ID; it must create only one bid.
- Force-close as admin and let another expire naturally. Winner/status/notifications must agree and repeat closure must not duplicate notifications.
- Disconnect/reconnect SignalR and reload notifications. Stored state must recover missed events. Block a connected user and confirm sockets close and old tokens cannot mutate state.
- Allow Render to sleep naturally. Revisit through the app, allow its cold-start time, and verify overdue closure before actionable state and rejection of late bids. Do not run scheduled keep-alives.
- Check /payment-success never claims payment and /auction-result/ID only claims a win verified for the signed-in account. Consignment submission and payment endpoints remain disabled.
- Inspect browser Network/Console for real WebSocket upgrades, CORS errors, secrets and stale Azure/local URLs. Local tests used real SignalR connections with LongPolling; Render WebSocket upgrades remain an external check.

## Sleep, delivery and resource limits

The background service waits for the next deadline or a schedule change. It cannot run while Render is asleep. Startup and relevant reads reconcile overdue auctions through the same row-locked transactional closure service. Bids independently check server time after acquiring the auction lock. No database polling or artificial uptime traffic is added.

Bids require a client-generated UUID. A repeated UUID with the same bidder/auction/amount returns the recorded bid; changing its amount returns a conflict. The client retries safe reads once for transient failures, reconnects SignalR with fresh tokens, restores auction rooms and refreshes stored state. Mutations are not automatically replayed. Messages are broadcast after commit; a transport failure can lose a live message, but REST refreshes recover stored bids/results/notifications.

Current official limits (recheck in the provider dashboard before launch):

- Render Free sleeps after 15 minutes without qualifying traffic and can take about a minute to wake. Its filesystem is ephemeral. Free service hours are 750 per workspace/month. Build/bandwidth quotas also apply; avoid adding a payment method or enabling paid resources without a separate decision. See [Render Free](https://render.com/docs/free).
- Neon's 2026-10-02 announcement gives Free projects 1 GB storage and 100 CU-hours per project/month, with 10 branches and a 6-hour restore window. Do not rely on the short restore window as your only backup. See [Neon Free update](https://neon.com/blog/neon-free-plan-1-gb-per-project).
- Cloudinary Free provides 25 shared credits. Storage, delivery bandwidth and transformations consume the allowance: one credit corresponds to 1 GB storage, 1 GB bandwidth or 1,000 transformations. See [Cloudinary credits](https://cloudinary.com/documentation/developer_onboarding_faq_credits).
- Vercel serves the static frontend. Its Hobby plan is for personal, noncommercial use and currently includes 100 GB fast data transfer and 1 million CDN requests. Keep the demo within your account's plan/quotas. No plan was changed. See [Vercel Hobby](https://vercel.com/docs/plans/hobby).

Cloudinary assets are never automatically deleted by this application. Replacing an image retains the old asset. If Cloudinary succeeds but database persistence fails, an orphan can remain; the backend returns failure and logs the new public ID for deliberate cleanup. Review orphan/reference status before any manual deletion. This retention consumes quota.

## Database evolution and rollback

The original root-level backend/Migrations SQL Server history/snapshot is preserved verbatim and excluded from the PostgreSQL assembly. The active baseline is backend/Migrations/Postgres. See its sibling README.md for future scaffolding commands. PostgreSQL money uses numeric(18,2), UTC timestamptz values and xmin concurrency. Database checks/indexes supplement transaction locks.

Before any future schema release, back up the demo database using Neon's supported export/backup workflow and retain its matching application revision. The current baseline only initializes a separate empty database; it is not an Azure import tool.

To roll back application behavior, choose the prior tested Render revision and matching Vercel deployment/environment variables. Free Render retains only two previous rollback deployments, so retain reviewed Git revisions too. Do not run down-migrations, drop/reset the demo, delete Cloudinary assets or restart Azure as part of application rollback. If an older app cannot read the new schema, keep the compatible app or restore an export into a new isolated database and repoint after review.

An Azure restoration would require a separate explicit plan using the original SQL Server code/configuration, preserved data and image storage. Do not point this PostgreSQL build at Azure SQL. No Azure cutover or shutdown was performed.

## Access needed to finish

Render CLI login is complete. Deployment now requires Neon/Cloudinary settings saved directly on the provisioned Render service. Use Render's remote Docker build, followed by backend readiness checks, before configuring the Vercel Preview. Never send provider secrets in chat. See DEMO-RELEASE-REVIEW.md and the PR for current verification and remaining access gates.

The existing Vercel root, /auctions/1 and /payment-success returned HTTP 200 and SPA HTML during this session. That checks existing deep-link routing only; it does not validate this unpublished migration or its browser flows.

## Dashboard settings before the first remote deploy

Neon: Free plan, a separate auctionpilot-demo project, PostgreSQL 17, AWS Singapore if available, and an empty auctionpilot_demo database. Use the connection dialog's pooling option. Leave free-tier scale-to-zero enabled. Transfer the password only into ConnectionStrings__DefaultConnection in Render's Environment UI.

Cloudinary: Free plan, cloud name/API key/API secret from Console Settings → API Keys. Save them only as Cloudinary__CloudName, Cloudinary__ApiKey and Cloudinary__ApiSecret in Render. The application uses signed server uploads and its own auctionpilot-demo/ public-ID prefix; an unsigned upload preset is unnecessary.

Render: GitHub repository Fawas-Mohamed/AuctionPilot; branch codex/neon-render-demo-migration; runtime Docker; region Singapore; instance Free; Dockerfile ./backend/Dockerfile; Docker context .; health path /health; automatic deploy off. No database, disk, worker or cron is required on Render. Save the backend table's variables in Environment. First-boot migration/seed flags are true only for the confirmed empty Neon demo. After successful initialization, set both false and remove the seed password.

A Blueprint supplies safe false defaults for initialization. If its first startup occurs before you can change those flags, the application refuses the uninitialized schema; this is not evidence that migrations were applied. Save the reviewed first-boot flags and redeploy. Alternatively, create the same Free Docker web service manually and enter all first-boot environment settings before starting its initial deploy. For manual service setup, generate Jwt__Key privately in a password manager; the Blueprint generates it automatically.

Only after Render's remote build/startup and Check-DemoBackend.ps1 pass, configure the existing Vercel project's Preview environment for this branch: root frontend, Vite, Node 22, install npm ci, build npm run typecheck && npm run build, output dist, and the two VITE URL settings above. Preserve the SPA rewrite. Take the actual preview origin from Vercel, append it exactly to Render's CORS_ALLOWED_ORIGINS, save/redeploy the backend environment, and run Check-DemoBackend.ps1 again with -FrontendOrigin https://ACTUAL-PREVIEW.vercel.app.

Then run tests/browser-acceptance.cjs with AUCTIONPILOT_PREVIEW_URL=https://ACTUAL-PREVIEW.vercel.app and AUCTIONPILOT_API_ORIGIN=https://ACTUAL-RENDER-HOST.onrender.com. Leave AUCTIONPILOT_BROWSER_MOCK_API unset for this live check. Authenticated upload/bidding, admin block/close, WebSocket recovery and natural sleep checks follow the manual acceptance list above.

## Current service setup walkthrough — 2026-10-05

Render service: [auctionpilot-demo-api](https://dashboard.render.com/web/srv-db19ftm0tbcc73a5l8g0). Its Free Docker build passed. First startup failed because the database connection is missing; backend readiness is not yet established. The repository's PR remains open and unmerged.

1. Open the [Neon Console](https://console.neon.tech), sign in, and verify the account is on Free. If the fresh project already exists, use it. Otherwise click New Project, name it auctionpilot-demo, choose AWS Singapore if offered, expand Postgres database to select PostgreSQL 17, and create the project. Enable only Postgres database; retain scale-to-zero. See [Neon project setup](https://neon.com/docs/manage/projects).
2. Select the project's default branch. Under Postgres database, open Databases, click Add database, enter auctionpilot_demo, select the generated database owner, and click Create. If that empty demo database already exists, select it. Do not import data or create application tables manually. See [Neon database setup](https://neon.com/docs/manage/databases).
3. In Neon's SQL Editor, select this branch and auctionpilot_demo, then run the read-only check below. A newly created database returns 0. If existing application tables appear, initialization must wait for review.
4. Click Connect in the Neon Console navigation. Select the default branch, read-write compute, auctionpilot_demo, and its owner role. Keep Connection pooling on. Use the host, role and database password from the dialog to fill the repository's Host=... Npgsql format below, directly in Render. The host contains -pooler and ends in neon.tech. See [Neon connection dialog](https://neon.com/docs/connect/connect-from-any-app).
5. Open the [Cloudinary Console](https://console.cloudinary.com), create/sign into a Free account, and go to Settings > API Keys. Locate the cloud name and API key/secret for its product environment. Save each as its separate Render variable below. See [Cloudinary credentials](https://cloudinary.com/documentation/developer_onboarding_faq_find_credentials).
6. Open the exact Render service above, select Environment in the left pane, and use Add Environment Variable to enter the six rows below. AdminSeed settings create a private administrator in the demo application; choose an email you control and a separate strong password saved in your password manager. Keep the already generated Jwt__Key stable.
7. Edit the existing Database__ApplyMigrations and Database__SeedDemo variables to true only after confirming the selected Neon database is fresh and empty. From the save dropdown choose Save only. That saves settings without deploying; the agent can then validate configuration names and trigger the documented first-boot initialization. See [Render environment settings](https://render.com/docs/configure-environment-variables).
8. Reply with configured status and the empty-database result only. Do not send any credential value or a screenshot containing credentials. After successful initialization/readiness, both Database__ flags return to false and the seed password is removed before the next preview step.

Read-only empty-database check:

    SELECT count(*) AS existing_tables
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE';

ConnectionStrings__DefaultConnection value template (replace all REPLACE values only in Render):

    Host=REPLACE_WITH_FULL_NEON_POOLED_HOST;Port=5432;Database=auctionpilot_demo;Username=REPLACE_WITH_NEON_ROLE;Password=REPLACE_WITH_NEON_DATABASE_PASSWORD;SSL Mode=VerifyFull;Maximum Pool Size=5;Minimum Pool Size=0;Connection Idle Lifetime=30;Timeout=30;Command Timeout=30

| Exact Render key | Value entered privately in Render |
| --- | --- |
| ConnectionStrings__DefaultConnection | Completed Npgsql template above |
| Cloudinary__CloudName | Cloudinary product environment cloud name |
| Cloudinary__ApiKey | Cloudinary API key |
| Cloudinary__ApiSecret | Cloudinary API secret |
| AdminSeed__Email | Chosen private demo administrator email |
| AdminSeed__Password | Chosen strong demo administrator password |

Do not create a second Render service, a Render database or a paid job for migrations. The existing service runs initialization through application startup. Vercel Preview configuration follows only after Render readiness passes; its exact variables and subsequent acceptance commands are documented above.
