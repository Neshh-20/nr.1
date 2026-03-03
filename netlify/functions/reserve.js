import { getStore } from "@netlify/blobs";

const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });

const isISODate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s);
const isTime = (s) => /^\d{2}:\d{2}$/.test(s);

const minutesOf = (hhmm) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

export default async (request) => {
  if (request.method !== "POST") {
    return json(405, { ok: false, message: "Method not allowed" });
  }

  let body = {};
  try {
    body = await request.json();
  } catch {
    return json(400, { ok: false, message: "Invalid JSON" });
  }

  const date = String(body.date || "");
  const time = String(body.time || "");
  const resId = body.res_id ? String(body.res_id) : null;

  const slotMinutes = Number(body.slot_minutes || 90);
  const maxTables = Number(body.max_tables || 6);

  if (!isISODate(date) || !isTime(time)) {
    return json(400, { ok: false, message: "Ungültiges Datum/Uhrzeit." });
  }
  if (!Number.isFinite(slotMinutes) || slotMinutes <= 0) {
    return json(400, { ok: false, message: "Ungültige Slotlänge." });
  }
  if (!Number.isFinite(maxTables) || maxTables <= 0) {
    return json(400, { ok: false, message: "Ungültiges Limit." });
  }

  const mins = minutesOf(time);
  const slotIndex = Math.floor(mins / slotMinutes);
  const slotKey = `${date}-slot-${slotIndex}`;

  const store = getStore("reservations");
  const key = `slots/${slotKey}.json`;

  // Load existing slot data
  let slot = await store.get(key, { type: "json" });
  if (!slot || typeof slot !== "object") slot = { count: 0, ids: [] };

  // Prevent double count on retries
  if (resId && Array.isArray(slot.ids) && slot.ids.includes(resId)) {
    return json(200, { ok: true });
  }

  const current = Number(slot.count || 0);
  if (current >= maxTables) {
    return json(409, {
      ok: false,
      message: "Dieser Zeitraum ist bereits ausgebucht. Wähle einen anderen Zeitraum.",
    });
  }

  // Update
  slot.count = current + 1;
  if (!Array.isArray(slot.ids)) slot.ids = [];
  if (resId) slot.ids.push(resId);

  // Keep ids bounded
  if (slot.ids.length > 300) slot.ids = slot.ids.slice(-300);

  await store.setJSON(key, slot);

  return json(200, { ok: true });
};
