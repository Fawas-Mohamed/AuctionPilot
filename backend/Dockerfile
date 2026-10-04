FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY backend/AuctionApi.csproj backend/
RUN dotnet restore backend/AuctionApi.csproj
COPY backend/ backend/
RUN dotnet publish backend/AuctionApi.csproj -c Release -o /app/publish --no-restore /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app
COPY --from=build /app/publish .
ENV ASPNETCORE_ENVIRONMENT=Production \
    ASPNETCORE_HTTP_PORTS=10000 \
    PORT=10000
EXPOSE 10000
USER $APP_UID
ENTRYPOINT ["dotnet", "AuctionApi.dll"]
