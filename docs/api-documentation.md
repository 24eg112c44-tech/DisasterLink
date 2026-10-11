# DisasterLink REST API Documentation

**Base URL**: `http://localhost:5000/api`  
**Content-Type**: `application/json`

---

## 1. System Health

### `GET /health`
Returns runtime availability of the API service and connected MongoDB instance.

* **Response `200 OK` (Healthy)**:
  ```json
  {
    "status": "ok",
    "database": "connected",
    "timestamp": "2026-10-10T09:13:52.342Z"
  }
  ```
* **Response `503 Service Unavailable` (Degraded/DB Offline)**:
  ```json
  {
    "status": "degraded",
    "database": "disconnected",
    "timestamp": "2026-10-10T09:13:52.342Z"
  }
  ```

---

## 2. Emergency Reports Management

### `POST /sos`
Submits a single emergency SOS report. Supports idempotent re-submission; repeating a `reportId` returns the existing document without overwriting or duplicating records.

* **Request Body**:
  ```json
  {
    "reportId": "SOS-FL-9901",
    "message": "Water reached 4 feet. Two seniors unable to walk.",
    "category": "Flooding",
    "peopleCount": 2,
    "location": "Sector 4B, River View Apartments, Flat 102",
    "latitude": 13.0827,
    "longitude": 80.2707,
    "deviceId": "dev-pseudonym-9823",
    "deliveryStatus": "Synced",
    "receivedVia": "Internet"
  }
  ```
* **Validation Rules**:
  * `reportId`: String (1–100 chars, required)
  * `message`: String (1–2000 chars, required)
  * `peopleCount`: Integer (1–10000, optional, defaults to `1`)
  * `latitude` & `longitude`: Number pair (-90 to 90, -180 to 180, must be provided together or omitted)
  * `category`: String (max 80 chars, optional)
* **Response `201 Created`**:
  ```json
  {
    "duplicate": false,
    "report": {
      "reportId": "SOS-FL-9901",
      "message": "Water reached 4 feet. Two seniors unable to walk.",
      "category": "Flooding",
      "peopleCount": 2,
      "location": "Sector 4B, River View Apartments, Flat 102",
      "latitude": 13.0827,
      "longitude": 80.2707,
      "status": "Pending",
      "deliveryStatus": "Synced",
      "receivedVia": "Internet",
      "hopCount": 0,
      "createdAt": "2026-10-10T09:15:00.000Z"
    }
  }
  ```
* **Response `200 OK` (Duplicate Resubmission)**:
  ```json
  {
    "duplicate": true,
    "report": { ... }
  }
  ```
* **Response `400 Bad Request`**: Validation failure (e.g. invalid latitude).

---

### `GET /sos`
Queries reports with pagination, status filtering, and keyword search.

* **Query Parameters**:
  * `page`: Integer (default `1`)
  * `limit`: Integer (default `50`, max `100`)
  * `status`: Optional filter (`Pending`, `Acknowledged`, `Rescue Dispatched`, `Resolved`)
  * `search`: Optional string (regex search over `message`, `location`, `category`, `reportId`)
* **Response `200 OK`**:
  ```json
  {
    "reports": [ ... ],
    "page": 1,
    "limit": 50,
    "total": 12,
    "pages": 1
  }
  ```

---

### `GET /sos/:reportId`
Retrieves a specific emergency record by its unique `reportId`.

* **Response `200 OK`**:
  ```json
  {
    "report": { ... }
  }
  ```
* **Response `404 Not Found`**:
  ```json
  {
    "error": "Report not found."
  }
  ```

---

### `PATCH /sos/:reportId/status`
Updates the operational triage status of an SOS report according to validated transition rules.

* **Transition Rules**:
  * `Pending` → `Acknowledged`
  * `Acknowledged` → `Rescue Dispatched` or `Resolved`
  * `Rescue Dispatched` → `Resolved`
  * `Resolved` → Terminal (no transitions allowed)
* **Request Body**:
  ```json
  {
    "status": "Acknowledged"
  }
  ```
* **Response `200 OK`**: Returns updated report document.
* **Response `409 Conflict`**: Invalid or backward status transition.

---

### `POST /sos/sync`
Batch synchronization endpoint utilized by mobile devices reconnecting after an outage. Accepts up to 100 offline reports. Fault-isolated; invalid records are individually rejected without rejecting valid sibling records.

* **Request Body**:
  ```json
  {
    "reports": [
      {
        "reportId": "OFFLINE-001",
        "message": "Trapped on roof",
        "category": "Trapped",
        "peopleCount": 3,
        "deliveryStatus": "Relayed",
        "receivedVia": "Nearby",
        "hopCount": 2,
        "createdAt": "2026-10-10T08:00:00.000Z"
      }
    ]
  }
  ```
* **Response `200 OK`**:
  ```json
  {
    "accepted": 1,
    "rejected": 0,
    "results": [
      {
        "reportId": "OFFLINE-001",
        "ok": true,
        "duplicate": false,
        "report": { ... }
      }
    ]
  }
  ```

---

## 3. Aggregate Operations Analytics

### `GET /stats`
Returns aggregated counts directly calculated from MongoDB.

* **Response `200 OK`**:
  ```json
  {
    "total": 8,
    "active": 7,
    "awaitingAssistance": 4,
    "resolved": 1,
    "relayed": 3,
    "byStatus": {
      "Pending": 4,
      "Acknowledged": 2,
      "Rescue Dispatched": 1,
      "Resolved": 1
    },
    "byDay": [
      { "day": "2026-10-10", "reports": 8 }
    ],
    "byCategory": [
      { "category": "Flooding", "reports": 4 },
      { "category": "Trapped", "reports": 3 },
      { "category": "Medical", "reports": 1 }
    ]
  }
  ```
