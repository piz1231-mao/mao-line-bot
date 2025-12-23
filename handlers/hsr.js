const { getSession, clearSession } = require("../sessions/sessionStore");
const { getSessionKey } = require("../utils/sessionKey");
const { getHSRTimetable } = require("../services/tdx");
const stationMap = require("../utils/hsrStations");

function parseTimeInput(text) {
  const m = text.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;

  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;

  const d = new Date();
  d.setHours(h, min, 0, 0);
  return d;
}

module.exports = async function handleHSR(event) {
  if (event.message.type !== "text") return null;

  const text = event.message.text.trim();
  const sessionKey = getSessionKey(event);
  const session = getSession(sessionKey);

  // 中斷
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
    if (text !== "北上" && text !== "南下") {
      return "請回覆：北上 或 南下";
    }
    session.direction = text;
    session.state = "HSR_STATION";
    return "🚄 請輸入起訖站\n例如：左營到台中";
  }

  if (session.state === "HSR_STATION") {
    if (!text.includes("到")) {
      return "站名格式錯誤，請輸入：左營到台中";
    }
    const [from, to] = text.split("到");
    session.origin = from.trim();
    session.destination = to.trim();
    session.state = "HSR_TIME";
    return "🚄 請輸入時間（例如 20:30）\n未輸入則查最近 2 小時";
  }

  if (session.state === "HSR_TIME") {
    session.startTime = parseTimeInput(text) || new Date();
    session.state = "HSR_RESULT";
    return await fetchAndRender(session, sessionKey);
  }

  if (session.state === "HSR_RESULT" && text === "後面") {
    session.page++;
    return renderResult(session);
  }

  return null;
};

async function fetchAndRender(session, sessionKey) {
  const originId = stationMap[session.origin];
  const destId = stationMap[session.destination];

  if (!originId || !destId) {
    clearSession(sessionKey);
    return "找不到站名，請重新輸入「查高鐵」";
  }

  const today = new Date().toISOString().slice(0, 10);

  let data;
  try {
    data = await getHSRTimetable(originId, destId, today);
  } catch {
    session.state = "HSR_TIME";
    return "🚄 系統忙碌中，請再輸入一次時間";
  }

  const start = session.startTime;
  const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);

  session.trips = data
    .map(item => {
      const stops = item.StopTimes;
      return {
        dep: stops[0].DepartureTime,
        arr: stops[stops.length - 1].ArrivalTime
      };
    })
    .filter(t => {
      const d = new Date(`${today}T${t.dep}`);
      return d >= start && d <= end;
    });

  session.page = 1;
  return renderResult(session);
}

function renderResult(session) {
  const pageSize = 8;
  const start = (session.page - 1) * pageSize;
  const list = session.trips.slice(start, start + pageSize);

  if (!list.length) {
    return "🚄 該時段沒有班次";
  }

  let msg = `🚄 高鐵｜${session.origin} → ${session.destination}\n\n`;
  list.forEach((t, i) => {
    msg += `${start + i + 1}️⃣ ${t.dep} → ${t.arr}\n`;
  });

  if (start + pageSize < session.trips.length) {
    msg += "\n輸入「後面」查看後續班次";
  }

  return msg;
}
