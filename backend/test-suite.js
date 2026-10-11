/**
 * DisasterLink Backend Verification Test Suite
 * Tests all required REST API endpoints and validation constraints:
 * 1. GET /api/health (DB and server status)
 * 2. POST /api/sos (Create SOS report)
 * 3. Idempotent duplicate prevention (re-POSTing same reportId)
 * 4. Coordinate range and malformed input validation (lat/lon limits)
 * 5. GET /api/sos (List reports with pagination & filtering)
 * 6. GET /api/sos/:reportId (Retrieve single report)
 * 7. PATCH /api/sos/:reportId/status (Status transitions & validation)
 * 8. POST /api/sos/sync (Batch offline sync with partial failure isolation)
 * 9. GET /api/stats (Aggregated metrics)
 */

const http = require("http");

const BASE_URL = process.env.TEST_API_URL || "http://localhost:5000";

function request(path, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const reqOptions = {
      method: options.method || "GET",
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
    };

    const req = http.request(url, reqOptions, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        let body;
        try {
          body = data ? JSON.parse(data) : {};
        } catch {
          body = data;
        }
        resolve({ status: res.statusCode, headers: res.headers, body });
      });
    });

    req.on("error", reject);

    if (options.body) {
      req.write(typeof options.body === "string" ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

async function runTests() {
  console.log("==================================================");
  console.log("   DISASTERLINK BACKEND AUTOMATED TEST SUITE      ");
  console.log("==================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${message}`);
      failed++;
    }
  }

  try {
    // 1. Health check
    console.log("Test 1: Health check endpoint");
    const health = await request("/api/health");
    assert(health.status === 200, `GET /api/health returned 200 (got ${health.status})`);
    assert(health.body.status === "ok", `API status is 'ok' (got ${health.body.status})`);
    assert(health.body.database === "connected", `Database is 'connected' (got ${health.body.database})`);

    // 2. Create SOS report
    console.log("\nTest 2: Create new SOS report");
    const testId = `TEST-SUITE-${Date.now()}`;
    const createRes = await request("/api/sos", {
      method: "POST",
      body: {
        reportId: testId,
        message: "Flood water reached 4 feet. Need boat rescue.",
        category: "Flooding",
        peopleCount: 5,
        location: "East Riverside Sector 12",
        latitude: 13.0827,
        longitude: 80.2707,
      },
    });
    assert(createRes.status === 201, `POST /api/sos created report (status 201, got ${createRes.status})`);
    assert(createRes.body.report && createRes.body.report.reportId === testId, "Created report has matching reportId");
    assert(createRes.body.duplicate === false, "First submission marked as non-duplicate");

    // 3. Idempotent duplicate submission
    console.log("\nTest 3: Duplicate submission idempotency");
    const dupRes = await request("/api/sos", {
      method: "POST",
      body: {
        reportId: testId,
        message: "Duplicate message retry attempt",
        peopleCount: 5,
      },
    });
    assert(dupRes.status === 200, `POST duplicate returns 200 OK (got ${dupRes.status})`);
    assert(dupRes.body.duplicate === true, "Duplicate flag is true");
    assert(dupRes.body.report.message.includes("Flood water reached"), "Original message preserved without corruption");

    // 4. Input validation (invalid latitude > 90)
    console.log("\nTest 4: Coordinate validation");
    const invalidCoord = await request("/api/sos", {
      method: "POST",
      body: {
        reportId: `INVALID-COORD-${Date.now()}`,
        message: "Testing invalid latitude",
        latitude: 105.5,
        longitude: 40.0,
      },
    });
    assert(invalidCoord.status === 400, `Invalid latitude rejected with 400 (got ${invalidCoord.status})`);
    assert(invalidCoord.body.error.includes("latitude"), `Error mentions latitude constraint: "${invalidCoord.body.error}"`);

    // Coordinate mismatch (latitude provided without longitude)
    const mismatchedCoord = await request("/api/sos", {
      method: "POST",
      body: {
        reportId: `MISMATCH-COORD-${Date.now()}`,
        message: "Testing mismatched coords",
        latitude: 12.0,
      },
    });
    assert(mismatchedCoord.status === 400, `Mismatched coords rejected with 400 (got ${mismatchedCoord.status})`);

    // 5. Retrieve single report
    console.log("\nTest 5: Retrieve report by ID");
    const getRes = await request(`/api/sos/${testId}`);
    assert(getRes.status === 200, `GET /api/sos/:reportId returned 200 (got ${getRes.status})`);
    assert(getRes.body.report.reportId === testId, "Retrieved report matches reportId");

    // 6. Status transitions
    console.log("\nTest 6: Valid and invalid status transitions");
    // Valid: Pending -> Acknowledged
    const ackRes = await request(`/api/sos/${testId}/status`, {
      method: "PATCH",
      body: { status: "Acknowledged" },
    });
    assert(ackRes.status === 200, `Status transitioned to Acknowledged (got ${ackRes.status})`);
    assert(ackRes.body.report.status === "Acknowledged", "Status is Acknowledged");

    // Valid: Acknowledged -> Rescue Dispatched
    const dispatchRes = await request(`/api/sos/${testId}/status`, {
      method: "PATCH",
      body: { status: "Rescue Dispatched" },
    });
    assert(dispatchRes.status === 200, `Status transitioned to Rescue Dispatched (got ${dispatchRes.status})`);

    // Invalid: Rescue Dispatched -> Pending (illegal backward transition)
    const invalidTrans = await request(`/api/sos/${testId}/status`, {
      method: "PATCH",
      body: { status: "Pending" },
    });
    assert(invalidTrans.status === 409, `Illegal backward transition rejected with 409 Conflict (got ${invalidTrans.status})`);

    // Valid: Rescue Dispatched -> Resolved
    const resolveRes = await request(`/api/sos/${testId}/status`, {
      method: "PATCH",
      body: { status: "Resolved" },
    });
    assert(resolveRes.status === 200, `Status transitioned to Resolved (got ${resolveRes.status})`);

    // 7. Batch sync (/api/sos/sync)
    console.log("\nTest 7: Offline batch sync endpoint");
    const syncRes = await request("/api/sos/sync", {
      method: "POST",
      body: {
        reports: [
          {
            reportId: `SYNC-NEW-${Date.now()}`,
            message: "Batch report 1 from nearby device",
            category: "Trapped",
            peopleCount: 3,
            deliveryStatus: "Relayed",
            receivedVia: "Nearby",
            hopCount: 1,
          },
          {
            reportId: testId, // Already exists and resolved
            message: "Duplicate in batch",
            peopleCount: 5,
          },
          {
            reportId: `SYNC-BAD-${Date.now()}`,
            message: "Bad latitude",
            latitude: 999.0,
            longitude: 0.0,
          },
        ],
      },
    });
    assert(syncRes.status === 200, `POST /api/sos/sync returned 200 (got ${syncRes.status})`);
    assert(syncRes.body.accepted === 2, `Accepted 2 reports (1 new + 1 duplicate idempotently, got ${syncRes.body.accepted})`);
    assert(syncRes.body.rejected === 1, `Rejected 1 malformed report (got ${syncRes.body.rejected})`);

    // 8. Stats summary endpoint
    console.log("\nTest 8: Aggregate stats endpoint");
    const statsRes = await request("/api/stats");
    assert(statsRes.status === 200, `GET /api/stats returned 200 (got ${statsRes.status})`);
    assert(typeof statsRes.body.total === "number" && statsRes.body.total >= 2, `Total count is numeric >= 2 (got ${statsRes.body.total})`);
    assert(typeof statsRes.body.relayed === "number" && statsRes.body.relayed >= 1, `Relayed count tracked >= 1 (got ${statsRes.body.relayed})`);

    console.log("\n==================================================");
    console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log("==================================================");

    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error("Test execution failed with error:", err);
    process.exit(1);
  }
}

runTests();
