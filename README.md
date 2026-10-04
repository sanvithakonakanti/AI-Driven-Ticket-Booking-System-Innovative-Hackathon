# 🎬 AI-Driven Ticket Booking System (70% Completed Starter Kit)

Welcome to the **Cinema Booking System Challenge**! This is a modern ticket booking application built using **Next.js**, **Supabase**, and **Tailwind CSS**.

Currently, the application is **70% complete**. It contains a fully functional core booking system, but leaves the remaining **30% advanced features** as a coding challenge for you to implement!

---

## 🚀 Features Already Implemented (70%)

1. **Movie Catalog**: Browse now-showing and upcoming movies with filters.
2. **Authentication**: Fully integrated authentication system using Supabase Auth.
3. **Core Seating & Booking**: Interactive seat layout and seat selection flow.
4. **Wallet System**: Users can deposit funds and check out using their wallet balance.
5. **Database Architecture**: Full database migrations for tables and initial seed data.

---

## 🛠️ Getting Started

### 1. Clone & Install
```bash
# Navigate to the project directory
npm install
```

### 2. Set Up Environment Variables
Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```
Fill in your own **Supabase** URL and API keys, and optional **Razorpay** / **SMTP** keys.

### 3. Set Up the Database
In your Supabase project's SQL Editor, run the SQL scripts in order from the `scripts/` directory:
1. `001_create_cinema_schema.sql` (Creates movies, theaters, showtimes, seats, bookings)
2. `002_seed_cinema_data.sql` (Inserts initial movies, shows, and seat data)
3. `003_create_wallet_system.sql` (Creates wallets and transaction tables)

### 4. Run Development Server
```bash
npm run dev
```
Open `http://localhost:3000` to start building!

---

## 📂 Project Structure
*   `app/` - Next.js App Router pages and API routes.
*   `components/` - Reusable UI elements (seating grid, movie cards, wallet interface).
*   `lib/` - Supabase client setup, shared utilities, and TypeScript types.
*   `scripts/` - Database seed SQL files.

Good luck, and happy coding! 🚀
