# 🚀 AuctionPilot - Real-Time Online Auction Platform

AuctionPilot is a modern real-time online auction platform that enables users to browse auctions, place bids, receive instant updates, manage listings, and participate in secure online bidding from anywhere.

The platform combines a React frontend with an ASP.NET Core backend and SignalR for real-time communication, providing a seamless auction experience similar to professional auction marketplaces.

---

## 📖 Project Overview

AuctionPilot was developed to provide a secure and user-friendly environment for online auctions. Users can:

* Browse active auctions
* View auction details
* Place bids in real-time
* Receive live bid updates
* Manage auction listings
* Track notifications
* Register and authenticate securely
* Explore categorized auction items

The system supports multiple users bidding simultaneously while maintaining data consistency and transparency.

---

# 🛠 Technology Stack

## Frontend

* React
* TypeScript
* Vite
* Tailwind CSS
* Shadcn UI
* Axios
* React Router
* SignalR Client

## Backend

* ASP.NET Core Web API
* Entity Framework Core
* SQL Server
* ASP.NET Identity
* JWT Authentication
* SignalR

## Cloud & Deployment

### Frontend

* Vercel

### Backend

* Render

### Database

* Neon & Cloudinary
---

# ✨ Key Features

## User Management

* User Registration
* User Login
* JWT Authentication
* Role-Based Access Control
* User Profiles

## Auction Management

* Create Auctions
* Update Auctions
* Delete Auctions
* Auction Categories
* Auction Images
* Auction Status Management

## Real-Time Bidding

* Live Bid Placement
* Instant Price Updates
* SignalR Real-Time Communication
* Live Bid Counters

## Notifications

* Winner Notifications
* Seller Notifications
* Auction Closing Alerts

## Categories

* Fine Art
* Jewelry
* Watches
* Antiques
* Furniture

## Administration

* Manage Users
* Manage Auctions
* Monitor Auction Activity

---

# 🏗 System Architecture

Frontend (React + Vite)
↓
Axios API Requests
↓
ASP.NET Core Web API
↓
Entity Framework Core
↓
SQL Server Database

Real-Time Updates:
SignalR Hub ↔ Connected Clients

---

# 🔐 Authentication

AuctionPilot uses JWT (JSON Web Token) authentication.

### Authentication Flow

1. User logs in.
2. Server validates credentials.
3. JWT token is generated.
4. Token is stored in browser storage.
5. Token is sent with protected API requests.
6. Backend validates token before granting access.

---

# 📂 Project Structure

## Frontend

```text
src/
├── components/
├── pages/
├── hooks/
├── lib/
├── services/
├── utils/
├── assets/
└── App.tsx
```

## Backend

```text
AuctionApi/
├── Controllers/
├── Models/
├── Data/
├── Services/
├── Hubs/
├── Migrations/
├── DTOs/
├── Middleware/
└── Program.cs
```

---

# ⚡ Real-Time Features

SignalR is used for:

* Live bid updates
* Auction creation notifications
* Auction closing notifications
* Instant synchronization across connected clients

Users see updates immediately without refreshing the page.

---

# 🗄 Database

The application uses Entity Framework Core with SQL Server.

Main entities include:

* Users
* Auctions
* Bids
* Categories
* Notifications

Relationships are managed using EF Core navigation properties.

---

# 🚀 Running the Project Locally

## Frontend

### Install Dependencies

```bash
npm install
```

### Run Development Server

```bash
npm run dev
```

### Build Production Version

```bash
npm run build
```

---

## Backend

### Restore Packages

```bash
dotnet restore
```

### Apply Migrations

```bash
dotnet ef database update
```

### Run API

```bash
dotnet run
```

---

# 🌐 Environment Variables

## Frontend (.env)

```env
VITE_API_URL=https://your-api-url/api
VITE_SIGNALR_URL=https://your-api-url/hubs/auction
```

---

## Backend (appsettings.json)

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Your SQL Connection String"
  },
  "Jwt": {
    "Key": "YourSecretKey",
    "Issuer": "AuctionPilot",
    "Audience": "AuctionPilotUsers"
  }
}
```

---

# ☁ Deployment

## Frontend Deployment

Platform: Vercel

```bash
npm run build
```

Automatic deployment is configured through GitHub integration.

### Vercel Routing Fix

Create:

```json
{
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

This prevents 404 errors when refreshing React routes.
---

## Backend Deployment

Platform: Microsoft Azure App Service

Features:

* Automatic deployment
* HTTPS support
* SQL Server integration
* SignalR support
* Application logging

---

# 🧪 Testing

The application was tested for:

* Authentication
* Auction Creation
* Bid Placement
* Real-Time Updates
* API Endpoints
* Database Operations
* User Authorization
* Error Handling

---

# 🔮 Future Enhancements

* Online Payments
* AI Price Prediction
* Email Notifications
* Mobile Application
* Advanced Search Filters
* Multi-language Support

---

# 👨‍💻 Development 

### Mohamed Fawas

Founder & Full Stack Developer

---

# 📄 License

This project is developed for educational and portfolio purposes.

---

## ⭐ Support

If you find this project useful, consider giving it a star on GitHub.

⭐ Star the repository
🍴 Fork the project
🛠 Contribute improvements

Thank you for visiting AuctionPilot!


