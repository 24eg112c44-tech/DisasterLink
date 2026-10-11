require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const SOSReport = require("./models/SOSReport");
const sosRoutes = require("./routes/sosRoutes");

const app = express();
const PORT = Number(process.env.PORT || 5000);
let dbConnectPromise;

async function ensureDatabaseConnected() {
  if (mongoose.connection.readyState === 1) return;

  if (!dbConnectPromise) {
    if (!process.env.MONGODB_URI) {
      throw new Error("MONGODB_URI is missing");
    }

    dbConnectPromise = mongoose.connect(process.env.MONGODB_URI).catch((error) => {
      dbConnectPromise = null;
      throw error;
    });
  }

  await dbConnectPromise;
}
const allowedOrigins = (process.env.CORS_ORIGINS || "http://localhost:5173,http://127.0.0.1:5173").split(",").map(s => s.trim());
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes("*") || allowedOrigins.includes(origin)) return cb(null, true);
    if (/^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+)(:\d+)?$/.test(origin)) return cb(null, true);
    cb(new Error("Origin not allowed by CORS"));
  }
}));
app.use(express.json({ limit: "100kb" }));
app.use(async (_req, _res, next) => {
  try {
    await ensureDatabaseConnected();
    next();
  } catch (error) {
    next(error);
  }
});
app.get(["/", "/api", "/api/", "/ap"], (_req, res) => res.json({
  name: "DisasterLink API",
  version: "1.0.0",
  message: "Flood emergency reporting server is running.",
  status: "online",
  endpoints: {
    health: "/api/health",
    stats: "/api/stats",
    reports: "/api/sos",
    batchSync: "/api/sos/sync"
  }
}));
app.get("/api/health", (_req, res) => { const db = mongoose.connection.readyState === 1; res.status(db ? 200 : 503).json({ status: db ? "ok" : "degraded", database: db ? "connected" : "disconnected", timestamp: new Date().toISOString() }); });
app.get("/api/stats", async (_req, res, next) => {
  try {
    const since = new Date(); since.setUTCDate(since.getUTCDate() - 6); since.setUTCHours(0, 0, 0, 0);
    const [total, byStatus, relayed, byDay, byCategory] = await Promise.all([
      SOSReport.countDocuments(),
      SOSReport.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
      SOSReport.countDocuments({ $or: [{ deliveryStatus: "Relayed" }, { receivedVia: "Nearby" }] }),
      SOSReport.aggregate([{ $match: { createdAt: { $gte: since } } }, { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: "UTC" } }, count: { $sum: 1 } } }, { $sort: { _id: 1 } }]),
      SOSReport.aggregate([{ $group: { _id: "$category", count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 8 }]),
    ]);
    const statuses = Object.fromEntries(byStatus.map(x => [x._id, x.count]));
    res.json({ total, active: total - (statuses.Resolved || 0), awaitingAssistance: statuses.Pending || 0, resolved: statuses.Resolved || 0, relayed, byStatus: statuses, byDay: byDay.map(x => ({ day: x._id, reports: x.count })), byCategory: byCategory.map(x => ({ category: x._id || "Other", reports: x.count })) });
  } catch (e) { next(e); }
});
app.use("/api/sos", sosRoutes);
app.use((err, _req, res, _next) => {
  if (err && err.type === "entity.parse.failed") return res.status(400).json({ error: "Malformed JSON request." });
  if (err && err.type === "entity.too.large") return res.status(413).json({ error: "Request body is too large." });
  if (err && err.code === 11000) return res.status(409).json({ error: "A report with this reportId already exists." });
  console.error("API request failed:", err && err.message);
  res.status(500).json({ error: "Internal server error." });
});

async function startServer() {
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is missing from backend/.env");
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("MongoDB connected.");
  app.listen(PORT, () => console.log(`DisasterLink API: http://localhost:${PORT}`));
}
if (require.main === module) startServer().catch(e => { console.error("Server startup failed:", e.message); process.exit(1); });
module.exports = app;
