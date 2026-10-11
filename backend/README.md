# DisasterLink API

## Run locally (PowerShell)

1. Start MongoDB locally, or set `MONGODB_URI` to a MongoDB database you control.
2. Keep your existing `.env` private. `.env.example` documents the expected variables.
3. In this folder run `npm install` then `npm run dev`.
4. Check `http://localhost:5000/api/health`.

`GET /api/sos?page=1&limit=50&status=Pending&search=boat`, `POST /api/sos`, `GET /api/sos/:reportId`, `PATCH /api/sos/:reportId/status`, `POST /api/sos/sync` with `{ "reports": [...] }`, and `GET /api/stats` are supported. Report IDs are idempotency keys. Status flow is Pending → Acknowledged → Rescue Dispatched → Resolved; Acknowledged may also become Resolved.

Status updates currently have no authentication. This prototype must not be exposed publicly or used as emergency infrastructure without authentication, authorization, transport security, privacy review, and operational safeguards.
