// ======================================================
// 🚄 高鐵查詢 Handler（最終修正版｜資料結構正確）
// ======================================================

const { getSession, clearSession } = require("../sessions/sessionStore");
const { getSessionKey } = require("../utils/sessionKey");
const { getHSRAllTimetable } = require("../services/tdx");
const stationMap = require("../utils/hsrStations");

console.log("✅ HSR handler loaded");

// HH:mm or HH:mm:ss → minutes
function toMinutes(t) {
  if (!t) return null;
  const parts = t.split(":").map(Number);
  if (parts.length < 2) return null;
  return parts[0] * 60 + parts[1];
}

function parseTime(text) {
  const m = text.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

module.exports = async function handleHSR(event) {
  if (event.type !== "message" || event.message.type !== "text") return null;

  const text = event.message.text.trim();
  const key = getSessionKey(event);
  const session = getSession(key);

  // 非高鐵流程直接忽略
  if (text !== "查高鐵" && !session.state?.startsWith("HSR")) {
    return null;
  }

  console.log("[HSR] event:", text);

  if (["取消", "結束"].includes(text)) {
    clearSession(key);
    return "🚄 已結束高鐵查詢";
  }

  if (text === "查高鐵") {
    session.state = "HSR_DIR";
    return "🚄 查高鐵\n請選擇方向：\n北上 / 南下";
  }

  if (session.state === "HSR_DIR") {
    if (!["北上", "南下"].includes(text)) {
      return "請回覆：北上 或 南下";
    }
    session.direction = text;
    session.state = "HSR_STATION";
    return "🚄 請輸入起訖站\n例如：左營到台中";
  }

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

  if (session.state === "HSR_TIME") {
    const min = parseTime(text);
    if (min === null) {
      return "請輸入正確時間格式（例如 21:30）";
    }
    session.startMin = min;
    session.page = 1;
    session.state = "HSR_RESULT";
    return await fetchResult(session, key);
  }

  if (session.state === "HSR_RESULT" && text === "後面") {
    session.page++;
    return render(session);
  }

  return null;
};

// ======================================================
// 抓全線 → 自行 filter
// ======================================================
async function fetchResult(session, key) {
  const originId = stationMap[session.origin];
  const destId = stationMap[session.dest];

  if (!originId || !destId) {
    clearSession(key);
    return "找不到站名，請重新查詢";
  }

  const today = new Date()
    .toLocaleDateString("zh-TW", { timeZone: "Asia/Taipei" })
    .replace(/\//g, "-");

  let trains;
  try {
    trains = await getHSRAllTimetable(today);
  } catch (err) {
    console.error("HSR API error:", err.message);
    return "🚄 無法取得高鐵時刻表";
  }

  console.log("[HSR] raw trains:", Array.isArray(trains) ? trains.length : 0);

  const trips = [];

  for (const train of trains || []) {
    const stops = train.StopTimes;
    if (!Array.isArray(stops)) continue;

    const oIdx = stops.findIndex(s => s.StationID === originId);
    const dIdx = stops.findIndex(s => s.StationID === destId);

    if (oIdx === -1 || dIdx === -1) continue;
    if (oIdx >= dIdx) continue;

    const depTime = stops[oIdx].DepartureTime;
    const arrTime = stops[dIdx].ArrivalTime;
    const depMin = toMinutes(depTime);

    if (depMin === null) continue;
    if (depMin < session.startMin) continue;

    trips.push({
      dep: depTime.slice(0, 5),
      arr: arrTime.slice(0, 5),
      min: depMin
    });
  }

  trips.sort((a, b) => a.min - b.min);

  console.log("[HSR] filtered trips:", trips.length);

  if (!trips.length) {
    return "🚄 該時間之後沒有班次";
  }

  session.trips = trips;
  return render(session);
}

// ======================================================
function render(session) {
  const pageSize = 8;
  const start = (session.page - 1) * pageSize;
  const list = session.trips.slice(start, start + pageSize);

  if (!list.length) return "沒有更多班次";

  let msg = `🚄 高鐵｜${session.origin} → ${session.dest}\n\n`;
  list.forEach((t, i) => {
    msg += `${start + i + 1}️⃣ ${t.dep} → ${t.arr}\n`;
  });

  if (start + pageSize < session.trips.length) {
    msg += "\n輸入「後面」查看後續班次";
  }

  return msg;
}
