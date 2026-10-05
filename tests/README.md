# AuctionPilot verification

Prerequisites: .NET 8 SDK, Node 22, and a separate PostgreSQL 17 test database. Docker is optional for local database tests but required to verify the deployment image.

Export AUCTIONPILOT_TEST_CONNECTION to the isolated database. Fixtures create randomly named ap_test_* schemas and delete only their own schemas. Never point this variable at Azure, a production database or a database containing valuable data.

From the repository root:

    dotnet build backend/AuctionApi.csproj -c Release
    dotnet test tests/AuctionApi.Tests/AuctionApi.Tests.csproj -c Release
    dotnet run --project tests/UploadValidationSmoke/UploadValidationSmoke.csproj -c Release
    docker build -f backend/Dockerfile -t auctionpilot-demo:verify .

From frontend/, with VITE_API_URL and VITE_SIGNALR_URL set to valid HTTPS URLs:

    npm ci
    npm run typecheck
    npm run build
    npm audit

The integration suite requires PostgreSQL rather than silently skipping or substituting an in-memory provider. It uses synthetic accounts, actual migrations, concurrent connections and injectable transport/clock/failure hooks. The standalone upload smoke checks fully decode/re-encode content, so arbitrary signature-only byte arrays are intentionally rejected.

See ../docs/MIGRATION-VERIFICATION.md for the recorded results and remaining audit/container/provider blockers. The CI workflow runs database, upload, frontend and Docker build checks on Ubuntu.

## Browser smoke checks

Install temporary tooling from the repository root (it stays ignored):

    npm install --prefix .local/browser-tools --no-save --package-lock=false playwright

Chrome must be installed. Set AUCTIONPILOT_PREVIEW_URL to the Vercel preview origin and AUCTIONPILOT_API_ORIGIN to the actual Render origin, then run:

    node tests/browser-acceptance.cjs

For a localhost production preview with a simulated unavailable backend only, also set AUCTIONPILOT_BROWSER_MOCK_API=1. Mock mode is forbidden for external preview origins. Local checks cover SPA routing, demo messaging, anonymous result/admin guards and disabled consignments. Authenticated bidding, live Cloudinary and sleep/reconnect acceptance remain separate checks in the deployment guide.

## Backend deployment gate

After Render reports successful remote Docker build/startup, run from PowerShell:

    ./tests/Check-DemoBackend.ps1 -BackendOrigin https://ACTUAL-RENDER-HOST.onrender.com

After the preview's exact origin is configured in Render CORS, also supply -FrontendOrigin https://ACTUAL-PREVIEW.vercel.app. This script performs one bounded liveness/readiness/state/CORS check; it does not keep the service awake.
