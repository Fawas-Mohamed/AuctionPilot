The SQL Server migration files at this directory's root, including the original model snapshot, are preserved verbatim for Azure history and rollback review. AuctionApi.csproj excludes only these root-level C# files from the PostgreSQL build.

The active PostgreSQL baseline and snapshot are in Postgres/. Apply them only to the separate empty demo database. They do not migrate, reset or import the Azure database. Keep both histories; never run this PostgreSQL baseline against an existing SQL Server or an unreviewed populated PostgreSQL schema.

To add future PostgreSQL migrations, use:
    dotnet tool restore
    dotnet ef migrations add NAME --project backend/AuctionApi.csproj --output-dir Migrations/Postgres --namespace AuctionApi.Migrations.Postgres

Review the generated files and confirm that every legacy SQL Server file is unchanged before applying a migration. Do not use EnsureDeleted, drop/reset commands or automatic down-migrations for cutover/rollback.
