const express = require("express");
const SOSReport = require("../models/SOSReport");
const router = express.Router();
const STATUSES = SOSReport.STATUSES;

function validateReport(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return "JSON object is required.";
  if (typeof body.reportId !== "string" || !body.reportId.trim() || body.reportId.length > 100) return "reportId is required (max 100 characters).";
  if (typeof body.message !== "string" || !body.message.trim() || body.message.length > 2000) return "message is required (max 2000 characters).";
  if (body.peopleCount !== undefined && (!Number.isInteger(body.peopleCount) || body.peopleCount < 1 || body.peopleCount > 10000)) return "peopleCount must be an integer from 1 to 10000.";
  if ((body.latitude == null) !== (body.longitude == null)) return "latitude and longitude must be provided together.";
  if (body.latitude != null && (typeof body.latitude !== "number" || !Number.isFinite(body.latitude) || body.latitude < -90 || body.latitude > 90)) return "latitude must be between -90 and 90.";
  if (body.longitude != null && (typeof body.longitude !== "number" || !Number.isFinite(body.longitude) || body.longitude < -180 || body.longitude > 180)) return "longitude must be between -180 and 180.";
  if (body.category !== undefined && (typeof body.category !== "string" || body.category.length > 80)) return "category must be a string up to 80 characters.";
  if (body.location !== undefined && (typeof body.location !== "string" || body.location.length > 300)) return "location must be a string up to 300 characters.";
  if (body.deliveryStatus !== undefined && !["Local", "Relayed", "Synced"].includes(body.deliveryStatus)) return "invalid deliveryStatus.";
  if (body.receivedVia !== undefined && !["Internet", "Nearby", "Manual"].includes(body.receivedVia)) return "invalid receivedVia.";
  if (body.hopCount !== undefined && (!Number.isInteger(body.hopCount) || body.hopCount < 0 || body.hopCount > 20)) return "hopCount must be from 0 to 20.";
  if (body.createdAt !== undefined && (!Number.isFinite(Date.parse(body.createdAt)) || Math.abs(Date.now() - Date.parse(body.createdAt)) > 1000 * 60 * 60 * 24 * 365 * 10)) return "createdAt must be a valid timestamp within ten years.";
  return null;
}

function createPayload(body) {
  return {
    reportId: body.reportId.trim(), message: body.message.trim(), category: body.category || "Other",
    latitude: body.latitude ?? null, longitude: body.longitude ?? null, peopleCount: body.peopleCount ?? 1,
    location: body.location || "", deviceId: typeof body.deviceId === "string" ? body.deviceId.slice(0, 120) : "",
    deliveryStatus: body.deliveryStatus === "Relayed" ? "Relayed" : "Synced",
    receivedVia: body.receivedVia === "Nearby" ? "Nearby" : (body.receivedVia === "Manual" ? "Manual" : "Internet"), hopCount: body.hopCount ?? 0,
    createdAt: body.createdAt ? new Date(body.createdAt) : new Date(), syncedAt: new Date(),
  };
}

async function saveIdempotently(body) {
  const reportId = body.reportId.trim();
  const existing = await SOSReport.findOne({ reportId });
  if (existing) return { report: existing, duplicate: true };
  try { return { report: await SOSReport.create(createPayload(body)), duplicate: false }; }
  catch (e) {
    if (e.code !== 11000) throw e;
    return { report: await SOSReport.findOne({ reportId }), duplicate: true };
  }
}

router.post("/sync", async (req, res, next) => {
  try {
  const records = req.body && req.body.reports;
  if (!Array.isArray(records) || records.length < 1 || records.length > 100) return res.status(400).json({ error: "reports must contain 1 to 100 records." });
  const results = await Promise.all(records.map(async (body) => {
    const error = validateReport(body);
    if (error) return { reportId: body && body.reportId || null, ok: false, error };
    const { report, duplicate } = await saveIdempotently(body);
    return { reportId: report.reportId, ok: true, duplicate, report };
  }));
  res.status(200).json({ results, accepted: results.filter(x => x.ok).length, rejected: results.filter(x => !x.ok).length });
  } catch (e) { next(e); }
});

router.post("/", async (req, res, next) => {
  const error = validateReport(req.body);
  if (error) return res.status(400).json({ error });
  try { const result = await saveIdempotently(req.body); res.status(result.duplicate ? 200 : 201).json(result); } catch (e) { next(e); }
});

router.get("/", async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const filter = {};
    if (req.query.status) { if (!STATUSES.includes(req.query.status)) return res.status(400).json({ error: "Invalid status filter." }); filter.status = req.query.status; }
    if (req.query.search) filter.$or = ["message", "location", "reportId", "category"].map(k => ({ [k]: { $regex: String(req.query.search).slice(0, 100).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" } }));
    const [reports, total] = await Promise.all([SOSReport.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(), SOSReport.countDocuments(filter)]);
    res.json({ reports, page, limit, total, pages: Math.ceil(total / limit) });
  } catch (e) { next(e); }
});

router.get("/:reportId", async (req, res, next) => {
  try { const report = await SOSReport.findOne({ reportId: req.params.reportId }).lean(); if (!report) return res.status(404).json({ error: "Report not found." }); res.json({ report }); } catch (e) { next(e); }
});

router.patch("/:reportId/status", async (req, res, next) => {
  const { status } = req.body || {};
  if (!STATUSES.includes(status)) return res.status(400).json({ error: "Invalid report status." });
  try {
    const report = await SOSReport.findOne({ reportId: req.params.reportId });
    if (!report) return res.status(404).json({ error: "Report not found." });
    const transitions = { Pending: ["Acknowledged"], Acknowledged: ["Rescue Dispatched", "Resolved"], "Rescue Dispatched": ["Resolved"], Resolved: [] };
    if (status !== report.status && !transitions[report.status].includes(status)) return res.status(409).json({ error: `Cannot change status from ${report.status} to ${status}.` });
    report.status = status; await report.save(); res.json({ report });
  } catch (e) { next(e); }
});

module.exports = router;
