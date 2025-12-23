const { getSession, clearSession } = require("../sessions/sessionStore");
const { getSessionKey } = require("../utils/sessionKey");
const { getHSRTimetable } = require("../services/tdx");
const stationMap = require("../utils/hsrStations");

// HH:mm → 分鐘
function toMinutes(t) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

// 解析使用者輸入時間
function parseInputTime(text) {
  const m = text.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

module.exports = async function handleHSR(event) {
  if (event.message.type !== "text") return null;

  const text = event.message.text.trim();
  const sessionKey = getSessionKey(event);
  const session = getSession(sessionKey);

  // 取消 / 結束
  if (["取消", "結束"].includes(text)) {
    clearSession(sessionKey);
    return "🚄 已結束高鐵查詢";
  }

  // 起手
  if (text === "查高鐵") {
    session.state = "HSR_DIRECTION";
    return "🚄 查高鐵\n請選擇方向：\n北上 / 南下";
  }

  if (!session.state?.startsWith("HSR_")) return null;

  // 方向
  if (session.state === "HSR_DIRECTION") {
    if (!["北上", "南下"].includes(text)) {
      return "請回覆：北上 或 南下";
    }
    session.state = "HSR_STATION";
    return "🚄 請輸入起訖站\n例如：左營到台中";
  }

  // 起訖站
  if (session.state === "HSR_STATION") {
    if (!text.includes("到")) {
      return "格式錯誤，請輸入：左營到台中";
    }
    const [o, d] = text.split("到");
    session.origin = o.trim();
    session.destination = d.trim();
    session.state = "HSR_TIME";
    return "🚄 請輸入時間（例如 20:55）";
  }

  // 時間
  if (session.state === "HSR_TIME") {
    const min = parseInputTime(text);
    if (min === null) {
      return "請輸入正確時間格式，例如 20:55";
    }
    session.startMinutes = min;
    session.state = "HSR_RESULT";
    return await fetchAndRender(session, sessionKey);
  }

  // 下一頁
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

  // ⚠️ 關鍵修正：一定用台灣日期（不能用 toISOString）
  const today = new Date()
    .toLocaleDateString("zh-TW", { timeZone: "Asia/Taipei" })
    .replace(/\//g, "-");

  let data;
  try {
    data = await getHSRTimetable(originId, destId, today);
  } catch (err) {
    console.error("HSR API error:", err.message);
    return "🚄 無法取得高鐵時刻表";
  }

  // 只留下「使用者輸入時間之後」的班次
  const trips = data
    .map(item => {
      const s = item.StopTimes;
      const o = s.find(x => x.StationID === originId);
      const d = s.find(x => x.StationID === destId);
      if (!o || !d) return null;

      return {
        dep: o.DepartureTime,
        arr: d.ArrivalTime,
        depMin: toMinutes(o.DepartureTime)
      };
    })
    .filter(t => t && t.depMin >= session.startMinutes)
    .sort((a, b) => a.depMin - b.depMin);

  if (!trips.length) {
    return "🚄 該時間之後沒有班次";
  }

  session.trips = trips;
  session.page = 1;
  return render(session);
}

function render(session) {
  const pageSize = 8;
  const start = (session.page - 1) * pageSize;
  const list = session.trips.slice(start, start + pageSize);

  if (!list.length) return "沒有更多班次";

  let msg = `🚄 高鐵｜${session.origin} → ${session.destination}\n\n`;
  list.forEach((t, i) => {
    msg += `${start + i + 1}️⃣ ${t.dep} → ${t.arr}\n`;
  });

  if (start + pageSize < session.trips.length) {
    msg += "\n輸入「後面」查看後續班次";
  }

  return msg;
}
