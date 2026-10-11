# DisasterLink Complete Verification & Testing Guide

This guide details both automated test execution and the 14-point manual verification checklist specified for DisasterLink.

---

## 1. Automated Backend Test Suite

The backend includes a comprehensive automated test runner verifying all 8 endpoint groups and constraint validations:

```powershell
cd DisasterLink\backend
npm test
```

### Verified Automated Scenarios:
1. `GET /api/health` connectivity check (Database connected).
2. `POST /api/sos` creating a unique report with valid coordinates and people count.
3. Idempotent duplicate prevention (re-submitting identical `reportId` returns HTTP 200 without creating a duplicate record or mutating data).
4. Boundary coordinate validation (rejects invalid latitude > 90 and mismatched latitude/longitude pairs with HTTP 400).
5. Single report retrieval (`GET /api/sos/:reportId`).
6. State machine enforcement:
   * Valid: `Pending` → `Acknowledged` → `Rescue Dispatched` → `Resolved`.
   * Invalid: `Rescue Dispatched` → `Pending` (rejected with HTTP 409 Conflict).
7. Fault-isolated batch synchronization (`POST /api/sos/sync`) with a mixed payload of valid new reports, idempotent duplicates, and malformed entries.
8. Aggregate statistical queries (`GET /api/stats`).

---

## 2. Web Operations Dashboard Testing

### Starting the Services

**Terminal 1 (Backend API):**
```powershell
cd DisasterLink\backend
npm run dev
```

**Terminal 2 (Frontend Dashboard):**
```powershell
cd DisasterLink\dashboard
npm run dev
```
Open the printed local URL: `http://localhost:5173`.

### Interactive Dashboard Verification Checklist:
* **API Health Pill**: Displays `API & MONGO CONNECTED` in green.
* **Live vs. Demo Mode**:
  * Toggle "Demo Scenario" switch at the top. Notice the amber notice banner informing operators that simulated data is in use.
  * Click **"📥 Seed to Live Database"** in the banner: Transmits all simulated flood incidents directly into your live MongoDB database via `POST /api/sos/sync`.
  * The dashboard switches seamlessly to Live Mode, and all KPI counters, charts, and Leaflet map markers reflect the real database records!
* **Incident Map (OpenStreetMap & Leaflet)**:
  * Markers appear on the map color-coded by emergency status (Red for Pending, Amber for Acknowledged, Sky Blue for Rescue Dispatched, Emerald Green for Resolved).
  * Click any marker to open its operational popup.
  * Notice the unmapped counter indicator noting any reports submitted without GPS coordinates.
* **Manual Emergency Logging**:
  * Click **"➕ Log Emergency SOS"**.
  * Enter an emergency call from an operator or survivor.
  * Test browser GPS autofill ("📍 Use My Coordinates") or type landmark text.
  * Click **"File Emergency SOS"**. The table and counters refresh instantly.
* **Triage & Status Transitions**:
  * In the reports table, change a "Pending" incident to "Acknowledged".
  * Click "Details" to open the full Emergency Dossier drawer.
  * Progress through "Dispatch Rescue Team" and "Mark Emergency Resolved".
* **CSV Export**:
  * Click **"📥 Export CSV"** above the triage table. Verify the downloaded file opens in Excel or text editor with correct timestamps and coordinates.

---

## 3. Android Application Verification

### Android Studio Setup
1. Open the folder `DisasterLink/android-app` in Android Studio.
2. Allow Gradle sync to download Android SDK 35 and Jetpack Room dependencies.
3. Configure `API_URL` in `app/build.gradle.kts`:
   * Android Emulator: defaults to `http://10.0.2.2:5000/api`.
   * Physical Phone: Change to your host computer's local Wi-Fi IP address (e.g. `http://192.168.1.50:5000/api`).

### Physical Device & Offline Flow Verification:
1. **Offline SOS Creation**:
   * Put phone into Airplane Mode (Wi-Fi & Cellular OFF).
   * Open DisasterLink.
   * Tap "🚨 SEND EMERGENCY SOS" or switch to "Send SOS" tab.
   * Fill emergency description, people count, and location.
   * Tap "SAVE SOS ON THIS DEVICE".
   * Verify confirmation banner: *"Report saved locally on this phone! Upload will sync when network is restored."*
   * Switch to "📋 History" tab: Report is listed with yellow *"⏳ LOCAL PENDING"* badge.
2. **Wi-Fi Direct Peer-to-Peer Relay**:
   * Open DisasterLink on two physical Android phones within 15 meters.
   * Ensure Wi-Fi is enabled on both phones.
   * Switch to the **"📡 Nearby Relay"** tab on both phones.
   * Tap **"SEARCH FOR NEARBY DISASTERLINK PHONES"** and grant Nearby Devices permission.
   * Tap **"Connect & Relay"** on the discovered device.
   * Verify that pending reports are transferred over the local P2P socket (Port 8988).
   * The receiving device inserts the report into its local Room database without modifying the original `reportId` or creation timestamp.
   * The relay hop count increments by 1.
3. **Automatic Online Synchronization**:
   * Disable Airplane Mode and reconnect phone to Wi-Fi.
   * Switch to **"🔄 Sync Status"** tab and tap **"TRIGGER WORKMANAGER SYNC NOW"** (or allow WorkManager background worker to trigger automatically).
   * Switch to **"📋 History"** tab: The report status updates to green *"✓ SYNCED"*.
   * Check the web dashboard at `http://localhost:5173`: The report now appears in the live triage queue with `deliveryStatus: "Relayed"` and hop count recorded!
