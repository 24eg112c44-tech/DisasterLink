# DisasterLink — Complete Flood Emergency Response System

**DisasterLink** is a comprehensive, functional flood emergency response prototype designed to keep SOS communications flowing during severe flooding disasters—even when cellular networks and mobile internet are offline.

The system features:
1. **Web Operations Control Dashboard**: Built with React 18, Vite, OpenStreetMap (Leaflet), and Recharts. Enables dispatchers to monitor incoming reports, inspect coordinate clusters, triage by urgency, and update emergency lifecycle statuses.
2. **Backend REST API & MongoDB Service**: Built with Node.js, Express, and Mongoose. Features idempotent record creation, fault-isolated batch synchronization, geospatial indexing, state machine transition validation, and aggregate metrics.
3. **Android SOS Mobile Application**: Built with Kotlin, Jetpack Room, WorkManager, and Wi-Fi Direct. Stores SOS reports locally on-device, transfers reports to nearby compatible smartphones without cellular signal (store-and-forward mesh), and auto-syncs when internet connectivity is restored.

---

## ⚡ Quick Start on Windows (PowerShell)

### Terminal 1: Backend API & MongoDB
Ensure MongoDB is running on your machine:
```powershell
# Navigate to backend directory
cd DisasterLink\backend

# Install dependencies if needed
npm install

# Run automated tests
npm test

# Start the dev server with Nodemon
npm run dev
```
* **API Health Check**: `http://localhost:5000/api/health`
* **API Documentation**: See [`docs/api-documentation.md`](docs/api-documentation.md)

### Terminal 2: Web Operations Dashboard
```powershell
# Navigate to dashboard directory
cd DisasterLink\dashboard

# Install dependencies if needed
npm install

# Start the Vite development server
npm run dev
```
* **Dashboard URL**: Open `http://localhost:5173` in your browser.
* **Demo Scenario Mode**: Use the "Demo Scenario" toggle in the dashboard header to test with simulated flood reports, or click **"📥 Seed to Live Database"** to populate realistic flood incident reports into MongoDB with 1 click.

### Terminal 3: Android Mobile Application
1. Open the folder `DisasterLink\android-app` in **Android Studio**.
2. Allow Gradle sync to download dependencies (SDK 35, Room 2.6.1, WorkManager 2.9.1).
3. If running on an emulator, the API URL defaults to `http://10.0.2.2:5000/api`. If deploying to a physical Android device, update `API_URL` in `app/build.gradle.kts` to your computer's local LAN IP (e.g. `http://192.168.1.50:5000/api`).
4. Build and run on your device or emulator.

---

## 📁 Repository Structure

```
DisasterLink/
├── backend/
│   ├── models/
│   │   └── SOSReport.js          # Mongoose schema with coordinate and status validation
│   ├── routes/
│   │   └── sosRoutes.js          # REST endpoints (/sos, /sync, /status, etc.)
│   ├── server.js                 # Express app initialization, CORS, and error handlers
│   ├── test-suite.js             # Automated test suite (25 test assertions)
│   ├── package.json
│   └── .env.example
│
├── dashboard/
│   ├── src/
│   │   ├── components/
│   │   │   ├── SummaryMetrics.jsx    # Real-time KPI summary cards
│   │   │   ├── IncidentMap.jsx       # Leaflet OpenStreetMap with bounds fitting
│   │   │   ├── AnalyticsCharts.jsx   # Status bar chart, inflow area chart, categories
│   │   │   ├── ReportsTable.jsx      # Triage table with search, filter, CSV export
│   │   │   ├── ReportDetailModal.jsx # Full emergency dossier with telemetry
│   │   │   ├── CreateSOSModal.jsx    # Hotline/radio emergency logging form
│   │   │   └── DemoModeBanner.jsx   # Explicit demo scenario notification
│   │   ├── services/
│   │   │   ├── api.js                # Centralized REST API service
│   │   │   └── demoData.js           # Realistic simulated flood scenario dataset
│   │   ├── App.jsx                   # Main control room dashboard
│   │   ├── index.css                 # Dark navy operations center styles
│   │   └── main.jsx
│   ├── package.json
│   ├── vite.config.js
│   └── .env.example
│
├── android-app/
│   └── app/src/main/
│       ├── AndroidManifest.xml       # Wi-Fi Direct, Location, and Network permissions
│       └── java/com/disasterlink/
│           ├── MainActivity.kt       # 6-screen tabbed mobile interface
│           ├── LocalDatabase.kt      # Room SQLite persistence & DAO
│           ├── SOSManager.kt         # SOSReport entity & manager
│           ├── SyncManager.kt        # WorkManager background sync worker
│           └── NearbyConnection.kt   # Wi-Fi Direct P2P store-and-forward relay
│
├── docs/
│   ├── architecture.md           # Mermaid system diagrams & protocol specifications
│   ├── api-documentation.md      # Complete REST API reference
│   └── testing-guide.md          # 14-point test checklist & verification guide
│
└── README.md
```

---

## 🔒 Security & Safety Disclaimers

* **Prototype Status**: DisasterLink is an academic software prototype developed for research and demonstration. It is not an officially certified municipal emergency dispatch system.
* **No Rescue Guarantee**: Saving an SOS report locally on a phone or relaying it to a nearby device does NOT guarantee that official emergency responders have received the signal until server synchronization is confirmed.
* **Official Contacts**: Survivors in immediate physical danger must always call official public safety numbers (**911** / **112**) whenever voice cellular networks are available.
* **Privacy By Design**: No personal names, social logins, or phone numbers are collected. GPS coordinates are strictly optional and landmark text descriptions are fully supported.
