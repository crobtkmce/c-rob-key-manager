# C-ROB Smart Key Locker

A complete hardware-integrated key management and booking system for the C-ROB Lab at TKMCE.

This repository contains the frontend web application and the Supabase backend architecture (Database schemas, Edge Functions, and automated cron jobs) required to securely manage physical custody of the C-ROB lab key.

## 🚀 Features

### 1. Authentication & Security

- **Google SSO Integration:** Users sign in strictly using their `@tkmce.ac.in` Google workspace accounts.
- **Role-Based Access Control (RBAC):** Three distinct tiers of access (`Student`, `Execom`, and `Admin`) strictly enforced by PostgreSQL Row Level Security (RLS).
- **Admin Console:** A dedicated dashboard for Administrators to view all registered users, search by email/name, and securely promote or demote roles.

### 2. Booking Engine & OTP System

- **Slot Booking:** Students can book the key for 1-5 hour intervals.
- **Conflict Prevention:** A database-level Postgres trigger strictly prevents overlapping booking slots.
- **Secure OTP Generation:** Upon booking, a Supabase Edge Function automatically generates a 6-digit PIN and securely emails it to the user via Resend.
- **Hardware Gateway:** A dedicated Edge Function endpoint (`iot-gateway`) for the ESP32 hardware keypad to validate the PIN.

### 3. Physical Custody & Handovers

- **IoT State Tracking:** The database explicitly tracks the physical sequence of events (`locker_opened` -> `key_removed` -> `key_returned`) triggered by the ESP32 Hall Effect sensors.
- **Peer-to-Peer Handovers:** A current key holder can initiate a "Handover Request" to another registered student, transferring digital custody. Requests auto-expire after 10 minutes.
- **Execom Delegation:** Execom members can monitor a lab-wide view of active key custody, and can override standard students via the "Request Takeover" mechanism.

### 4. Automated Reminders & Escalations

- **pg_cron Integration:** A native Postgres cron job runs every 5 minutes to verify all active sessions.
- **30-Minute Reminders:** The system automatically emails the current key holder 30 minutes before their session ends.
- **Overdue Escalations:** If the key is not returned 10 minutes past the session end time, the system emails all C-ROB Admins/Execoms and flashes an urgent dashboard alert.

---

## 🛠️ Tech Stack

- **Frontend:** React 19, TypeScript, Vite, TanStack Router
- **Styling:** Tailwind CSS, shadcn/ui
- **Backend:** Supabase (PostgreSQL, GoTrue Auth)
- **Serverless:** Supabase Edge Functions (Deno)
- **Emails:** Resend API

---

## ⚙️ Setup & Deployment Guide

### 1. Database Initialization

1. Create a new Supabase project.
2. Go to the **SQL Editor** and paste the entire contents of `db/schema.sql`.
3. Run the script. This will set up all tables, RLS policies, triggers, and the 5-minute cron scheduler.

### 2. Edge Functions Deployment

You must deploy the three serverless functions that power the backend logic:

```bash
npx supabase functions deploy generate-otp
npx supabase functions deploy iot-gateway
npx supabase functions deploy cron-notifier
```

### 3. Environment Secrets

Configure the required API secrets in your Supabase project:

```bash
npx supabase secrets set RESEND_API_KEY="your_resend_key"
npx supabase secrets set LOCKER_API_SECRET="your_custom_hardware_password"
```

### 4. Webhook Configuration

1. In your Supabase Dashboard, go to **Database > Webhooks**.
2. Create a new Webhook targeting the `bookings` table on `INSERT`.
3. Point it to the URL of your deployed `generate-otp` Edge Function.

### 5. Local Frontend Development

```bash
# Install dependencies
npm install

# Start the development server
npm run dev
```

---

## 🔌 Hardware (ESP32) Endpoints

The ESP32 communicates exclusively with the `iot-gateway` Edge Function.

**Headers Required:**

```http
Authorization: Bearer <LOCKER_API_SECRET>
Content-Type: application/json
```

**Validate OTP Payload:**

```json
{
  "action": "validate_otp",
  "otp": "123456",
  "esp32_id": "MAIN_DOOR_1",
  "timestamp": "2024-03-20T10:00:00Z"
}
```

**Report Event Payload:**

```json
{
  "action": "report_event",
  "event_type": "key_removed",
  "session_id": "<uuid-from-validate-otp-response>",
  "esp32_id": "MAIN_DOOR_1",
  "timestamp": "2024-03-20T10:00:05Z",
  "idempotency_key": "unique-uuid-per-event"
}
```

_(Valid `event_type`s: `locker_opened`, `key_removed`, `key_returned`, `power_restored`)_

