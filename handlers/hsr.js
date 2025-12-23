// handlers/hsr.js
const { getSession, clearSession } = require("../sessions/sessionStore");
const { getSessionKey } = require("../utils/sessionKey");
const { getHSRTimetable } = require("../services/tdx");
const stationMap = require("../utils/hsrStations");

console.log("✅ HSR handler loaded");

// 時間轉分鐘
function toMinutes(t) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function parseTime(text) {
  const m = text.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

module.exports = async function handleHSR(event) {
  if (!event.message || event.message.type !== "text") return null;

  const text = event.message.text.trim();
  const key = getSessionKey(event);
  const session = getSession(key);

  console.log("[HSR] event:", text);

  if (["取消", "結束"].includes(text)) {
    clearSession(key);
    return "🚄 已結束高鐵查詢";
  }

  if (text === "查高鐵") {
    session.state = "DIR";
    return "🚄 查高鐵\n請選擇方向：北上 / 南下";
  }

  if (!session.state) return null;

  if (session.state === "DIR") {
    if (!["北上", "南下"].includes(text)) {
      return "請回覆：北上 或 南下";
    }
    session.state = "STATION";
    return "🚄 請輸入起訖站（例如：左營到台中）";
  }

  if (session.state === "STATION") {
    if (!text.includes("到")) return "格式錯誤，請輸入：左營到台中";
    const [o, d] = text.split("到");
    session.origin = o.trim();
    session.dest = d.trim();
    session.state = "TIME";
    return "🚄 請輸入時間（例如 20:55）";
  }

  if (session.state === "TIME") {
    const min = parseTime(text);
    if (min === null) return "請輸入正確時間格式（例如 20:55）";
    session.startMin = min;
    session.page = 1;
    session.state = "RESULT";
    return await fetchResult(session, key);
  }

  if (session.state === "RESULT" && text === "後面") {
    session.page++;
    return render(session);
  }

  return null;
};

async function fetchResult(session, key) {
  const originId = stationMap[session.origin];
  const destId = stationMap[session.dest];

  if (!originId || !destId) {
    clearSession(key);
    return "找不到站名，請重新查詢";
  }

  // 台灣日期（避免 UTC 問題）
  const today = new Date()
    .toLocaleDateString("zh-TW", { timeZone: "Asia/Taipei" })
    .replace(/\//g, "-");

  let data;
  try {
    data = await getHSRTimetable(originId, destId, today);
  } catch (e) {
    console.error("HSR API error:", e.message);
    return "🚄 無法取得高鐵時刻表";
  }

  console.log("[HSR] raw data length:", data?.length);

  const trips = data
    .map(item => {
      const s = item.StopTimes;
      const o = s.find(x => x.StationID === originId);
      const d = s.find(x => x.StationID === destId);
      if (!o || !d) return null;
      return {
        dep: o.DepartureTime,
        arr: d.ArrivalTime,
        min: toMinutes(o.DepartureTime)
      };
    })
    .filter(t => t && t.min >= session.startMin)
    .sort((a, b) => a.min - b.min);

  console.log("[HSR] filtered trips:", trips.length);

  if (!trips.length) return "🚄 該時間之後沒有班次";

  session.trips = trips;
  return render(session);
}

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
