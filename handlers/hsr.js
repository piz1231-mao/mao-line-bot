// ======================================================
// 🚄 高鐵查詢 Handler（最終穩定版）
// ======================================================

const { getSession, clearSession } = require("../sessions/sessionStore");
const { getSessionKey } = require("../utils/sessionKey");
const { getHSRAllTimetable } = require("../services/tdx");

console.log("✅ HSR handler loaded");

// ------------------------------------------------------
// 工具
// ------------------------------------------------------
function toMinutes(t) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function parseTime(text) {
  const m = text.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

// ======================================================
// 主 Handler
// ======================================================
module.exports = async function handleHSR(event) {
  if (event.type !== "message") return null;
  if (event.message.type !== "text") return null;
  if (event.source.type !== "user") return null; // 私訊限定

  const text = event.message.text.trim();
  const key = getSessionKey(event);
  const session = getSession(key);

  console.log("[HSR] event:", text, "state:", session.state);

  // ----------------------------------------------------
  // 尚未進入高鐵流程，只接受「查高鐵」
  // ----------------------------------------------------
  if (!session.inHSR && text !== "查高鐵") {
    return null;
  }

  // ----------------------------------------------------
  // 起手
  // ----------------------------------------------------
  if (text === "查高鐵") {
    clearSession(key);
    const s = getSession(key);
    s.inHSR = true;
    s.state = "DIR";
    return "🚄 查高鐵\n請選擇方向：\n北上 / 南下";
  }

  // ----------------------------------------------------
  // 方向
  // ----------------------------------------------------
  if (session.state === "DIR") {
    if (!["北上", "南下"].includes(text)) {
      return "請回覆：北上 或 南下";
    }
    session.dir = text;
    session.state = "STATION";
    return "🚄 請輸入起訖站\n例如：左營到台中";
  }

  // ----------------------------------------------------
  // 起訖站
  // ----------------------------------------------------
  if (session.state === "STATION") {
    if (!text.includes("到")) {
      return "格式錯誤，請輸入：左營到台中";
    }
    const [o, d] = text.split("到");
    session.origin = o.trim();
    session.dest = d.trim();
    session.state = "TIME";
    return "🚄 請輸入時間（例如 21:30）";
  }

  // ----------------------------------------------------
  // 時間 → 查詢
  // ----------------------------------------------------
  if (session.state === "TIME") {
    const startMin = parseTime(text);
    if (startMin === null) {
      return "請輸入正確時間格式（例如 21:30）";
    }

    session.startMin = startMin;
    const result = await queryHSR(session);

    clearSession(key); // 查完一定清，避免後續亂吃
    return result;
  }

  return null;
};

// ======================================================
// 查詢高鐵（用 StationName.Zh_tw，比對正確）
// ======================================================
async function queryHSR(session) {
  const today = new Date()
    .toLocaleDateString("zh-TW", { timeZone: "Asia/Taipei" })
    .replace(/\//g, "-");

  const trains = await getHSRAllTimetable(today);
  console.log("[HSR] raw trains:", trains.length);

  const trips = [];

  for (const t of trains) {
    const stops = t.StopTimes;
    if (!stops) continue;

    const oIdx = stops.findIndex(
      s => s.StationName?.Zh_tw === session.origin
    );
    const dIdx = stops.findIndex(
      s => s.StationName?.Zh_tw === session.dest
    );

    if (oIdx === -1 || dIdx === -1 || oIdx >= dIdx) continue;

    const dep = stops[oIdx].DepartureTime;
    const arr = stops[dIdx].ArrivalTime;

    const depMin = toMinutes(dep);
    if (depMin < session.startMin) continue;

    trips.push({
      dep,
      arr,
      depMin
    });
  }

  trips.sort((a, b) => a.depMin - b.depMin);

  console.log("[HSR] filtered trips:", trips.length);

  if (!trips.length) {
    return "🚄 該時間之後沒有班次";
  }

  let msg = `🚄 高鐵｜${session.origin} → ${session.dest}\n\n`;
  trips.slice(0, 10).forEach((t, i) => {
    msg += `${i + 1}️⃣ ${t.dep.slice(0, 5)} → ${t.arr.slice(0, 5)}\n`;
  });

  return msg;
}
