const { getSession, clearSession } = require("../sessions/sessionStore");
const { getSessionKey } = require("../utils/sessionKey");
const { getHSRTimetable } = require("../services/tdx");
const stationMap = require("../utils/hsrStations");

function parseTime(text) {
  const m = text.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;

  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;

  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

module.exports = async function handleHSR(event) {
  if (event.message.type !== "text") return null;

  const text = event.message.text.trim();
  const sessionKey = getSessionKey(event);
  const session = getSession(sessionKey);

  if (["取消", "結束"].includes(text)) {
    clearSession(sessionKey);
    return "🚄 已結束高鐵查詢";
  }

  if (text === "查高鐵") {
    session.state = "HSR_DIRECTION";
    return "🚄 查高鐵\n請選擇方向：\n北上 / 南下";
  }

  if (!session.state?.startsWith("HSR_")) return null;

  if (session.state === "HSR_DIRECTION") {
    if (!["北上", "南下"].includes(text)) return "請回覆：北上 或 南下";
    session.direction = text;
    session.state = "HSR_STATION";
    return "🚄 請輸入起訖站\n例如：左營到台中";
  }

  if (session.state === "HSR_STATION") {
    if (!text.includes("到")) return "格式錯誤，請輸入：左營到台中";
    const [o, d] = text.split("到");
    session.origin = o.trim();
    session.destination = d.trim();
    session.state = "HSR_TIME";
    return "🚄 請輸入時間（例如 20:30）\n未輸入則查最近班次";
  }

  if (session.state === "HSR_TIME") {
    session.startTimeStr = parseTime(text) || "00:00";
    session.state = "HSR_RESULT";
    return await fetchAndRender(session, sessionKey);
  }

  if (session.state === "HSR_RESULT" && text === "後面") {
    session.page++;
    return render(session);
  }

  return null;
};

async function fetchAndRender(session, key) {
  const originId = stationMap[session.origin];
  const destId = stationMap[session.destination];

  if (!originId || !destId) {
    clearSession(key);
    return "找不到站名，請重新查詢";
  }

  const date = new Date().toISOString().slice(0, 10);

  let data;
  try {
    data = await getHSRTimetable(originId, destId, date);
  } catch {
    session.state = "HSR_TIME";
    return "🚄 系統忙碌中，請再輸入一次時間";
  }

  const trips = data
    .map(item => {
      const s = item.StopTimes;
      const o = s.find(x => x.StationID === originId);
      const d = s.find(x => x.StationID === destId);
      if (!o || !d) return null;
      return {
        dep: o.DepartureTime,
        arr: d.ArrivalTime
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.dep.localeCompare(b.dep));

  const startIndex =
    trips.findIndex(t => t.dep >= session.startTimeStr) ?? 0;

  session.trips = trips.slice(startIndex);
  session.page = 1;

  if (!session.trips.length) {
    return "🚄 今日已無可搭乘班次";
  }

  return render(session);
}

function render(session) {
  const size = 8;
  const start = (session.page - 1) * size;
  const list = session.trips.slice(start, start + size);

  if (!list.length) return "沒有更多班次";

  let msg = `🚄 高鐵｜${session.origin} → ${session.destination}\n\n`;
  list.forEach((t, i) => {
    msg += `${start + i + 1}️⃣ ${t.dep} → ${t.arr}\n`;
  });

  if (start + size < session.trips.length) {
    msg += "\n輸入「後面」查看後續班次";
  }

  return msg;
}
