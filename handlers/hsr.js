// ======================================================
// 🚄 高鐵查詢 Handler（v1.0 定版｜嚴格隔離）
// ======================================================

const { getSession, clearSession } = require("../sessions/sessionStore");
const { getSessionKey } = require("../utils/sessionKey");
const { getHSRAllTimetable } = require("../services/tdx");
const stationMap = require("../utils/hsrStations");

console.log("✅ HSR handler loaded");

// HH:mm or HH:mm:ss → minutes
function toMinutes(t) {
  if (!t) return null;
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function parseTime(text) {
  const m = text.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

module.exports = async function handleHSR(event) {
  if (event.type !== "message" || event.message.type !== "text") return null;

  const text = event.message.text.trim();
  const key = getSessionKey(event);
  const session = getSession(key);

  // ======================================================
  // ✅ 嚴格入口鎖：只有「查高鐵」或「後面」能進來
  // ======================================================
  const isEntry = text === "查高鐵";
  const isPaging = session.state === "HSR_RESULT" && text === "後面";

  if (!isEntry && !isPaging && session.state !== "HSR_DIR" &&
      session.state !== "HSR_STATION" &&
      session.state !== "HSR_TIME") {
    return null;
  }

  console.log("[HSR] event:", text);

  // ======================================================
  // 起手
  // ======================================================
  if (isEntry) {
    clearSession(key);
    session.state = "HSR_DIR";
    return "🚄 查高鐵\n請選擇方向：\n北上 / 南下";
  }

  // ======================================================
  // 方向
  // ======================================================
  if (session.state === "HSR_DIR") {
    if (!["北上", "南下"].includes(text)) {
      return "請回覆：北上 或 南下";
    }
    session.state = "HSR_STATION";
    return "🚄 請輸入起訖站\n例如：左營到台中";
  }

  // ======================================================
  // 起訖站
  // ======================================================
  if (session.state === "HSR_STATION") {
    if (!text.includes("到")) {
      return "格式錯誤，請輸入：左營到台中";
    }
    const [o, d] = text.split("到");
    session.origin = o.trim();
    session.dest = d.trim();
    session.state = "HSR_TIME";
    return "🚄 請輸入時間（例如 21:30）";
  }

  // ======================================================
  // 時間 → 查詢（查完就結束 session）
  // ======================================================
  if (session.state === "HSR_TIME") {
    const min = parseTime(text);
    if (min === null) {
      return "請輸入正確時間格式（例如 21:30）";
    }
    session.startMin = min;

    const result = await fetchResult(session);
    clearSession(key); // 🔥 關鍵：查完立刻清 session
    return result;
  }

  return null;
};

// ======================================================
// 查全線 → 自行 filter
// ======================================================
async function fetchResult(session) {
  const originId = stationMap[session.origin];
  const destId = stationMap[session.dest];

  if (!originId || !destId) {
    return "找不到站名，請重新查詢";
  }

  const today = new Date()
    .toLocaleDateString("zh-TW", { timeZone: "Asia/Taipei" })
    .replace(/\//g, "-");

  const trains = await getHSRAllTimetable(today);
  console.log("[HSR] raw trains:", trains.length);

  const trips = [];

  for (const train of trains) {
    const stops = train.StopTimes;
    if (!Array.isArray(stops)) continue;

    const oIdx = stops.findIndex(s => s.StationID === originId);
    const dIdx = stops.findIndex(s => s.StationID === destId);

    if (oIdx === -1 || dIdx === -1 || oIdx >= dIdx) continue;

    const depMin = toMinutes(stops[oIdx].DepartureTime);
    if (depMin < session.startMin) continue;

    trips.push({
      dep: stops[oIdx].DepartureTime.slice(0, 5),
      arr: stops[dIdx].ArrivalTime.slice(0, 5),
      min: depMin
    });
  }

  trips.sort((a, b) => a.min - b.min);
  console.log("[HSR] filtered trips:", trips.length);

  if (!trips.length) {
    return "🚄 該時間之後沒有班次";
  }

  let msg = `🚄 高鐵｜${session.origin} → ${session.dest}\n\n`;
  trips.slice(0, 8).forEach((t, i) => {
    msg += `${i + 1}️⃣ ${t.dep} → ${t.arr}\n`;
  });

  return msg;
}
