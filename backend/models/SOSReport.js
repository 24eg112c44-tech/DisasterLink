const mongoose = require("mongoose");

const STATUSES = ["Pending", "Acknowledged", "Rescue Dispatched", "Resolved"];
const DELIVERY = ["Local", "Relayed", "Synced"];
const schema = new mongoose.Schema({
  reportId: { type: String, required: true, unique: true, trim: true, maxlength: 100 },
  message: { type: String, required: true, trim: true, maxlength: 2000 },
  category: { type: String, trim: true, maxlength: 80, default: "Other" },
  latitude: { type: Number, min: -90, max: 90, default: null },
  longitude: { type: Number, min: -180, max: 180, default: null },
  peopleCount: { type: Number, min: 1, max: 10000, default: 1 },
  location: { type: String, trim: true, maxlength: 300, default: "" },
  status: { type: String, enum: STATUSES, default: "Pending" },
  deliveryStatus: { type: String, enum: DELIVERY, default: "Synced" },
  deviceId: { type: String, maxlength: 120, default: "" },
  receivedVia: { type: String, enum: ["Internet", "Nearby", "Manual"], default: "Internet" },
  hopCount: { type: Number, min: 0, max: 20, default: 0 },
  syncedAt: { type: Date, default: Date.now },
}, { timestamps: true, versionKey: false });
schema.index({ createdAt: -1 });
schema.index({ status: 1, createdAt: -1 });
module.exports = mongoose.model("SOSReport", schema);
module.exports.STATUSES = STATUSES;
