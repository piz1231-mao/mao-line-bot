const { getSession, clearSession } = require("../sessions/sessionStore");
const { getHSRTimetable } = require("../services/tdx");
const stationMap = require("../utils/hsrStations");

// ==============================
// 工具：解析時間輸入 HH:mm
// ==============================
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

// ==============================
// 🚄 高鐵主處理器（穩定版）
// ==============================
module.exports = async function handleHSR(event) {
  // ✅ 非文字訊息，一律不處理（照片、貼圖、影片）
  if (event.message.type !== "text") return null;

  const text = event.message.text.trim();
  const userId = event.source.userId;

  // 🔑 session 綁定對話空間
  const sourceId =
    event.source.type === "group"
      ? event.source.groupId
      : event.source.type === "room"
      ? event.source.roomId
      : event.source.userId;

  const sessionKey = `${userId}:${sourceId}`;
  const session = getSession(sessionKey);

  // ==============================
  // 🔴 強制中斷指令
  // ==============================
  if (["取消", "結束", "離開"].includes(text)) {
    clearSession(sessionKey);
    return "🚄 已結束高鐵查詢";
  }

  // ==============================
  // 入口
  // ==============================
  if (text === "查高鐵") {
    session.state = "HSR_DIRECTION";
    session.page = 1;
    return "🚄 查高鐵\n請選擇方向：\n北上 / 南下";
  }

  // 沒在高鐵流程中就不理
  if (!session.state?.startsWith("HSR_")) return null;

  // ==============================
  // 方向
  // ==============================
  if (session.state === "HSR_DIRECTION") {
    if (text === "北上") session.direction = "NORTH";
    else if (text === "南下") session.direction = "SOUTH";
    else return "請回覆：北上 或 南下";

    session.state = "HSR_STATION";
    return "🚄 請輸入起訖站\n格式：左營到台中";
  }

  // ==============================
  // 站名
  // ==============================
  if (session.state === "HSR_STATION") {
    if (!text.includes("到")) {
      return "站名格式錯誤，請輸入：左營到台中";
    }

    const [from, to] = text.split("到");
    session.origin = from.trim();
    session.destination = to.trim();
    session.state = "HSR_TIME";

    return "🚄 請輸入時間（例如 20:00）\n未輸入則查最近 2 小時";
  }

  // ==============================
  // 時間
  // ==============================
  if (session.state === "HSR_TIME") {
    const parsedTime = parseTimeInput(text);
    session.startTime = parsedTime ? parsedTime : new Date();
    session.state = "HSR_RESULT";

    return await fetchAndRender(session, sessionKey);
  }

  // ==============================
  // 分頁
  // ==============================
  if (
    session.state === "HSR_RESULT" &&
    ["後面", "下一頁", "看後面"].includes(text)
  ) {
    session.page++;
    return renderResult(session);
  }

  return null;
};

// ==============================
// 呼叫 TDX + 過濾時間
// ==============================
async function fetchAndRender(session, sessionKey) {
  const originId = stationMap[session.origin];
  const destId = stationMap[session.destination];

  if (!originId || !destId) {
    clearSession(sessionKey);
    return "找不到站名，請重新輸入查高鐵";
  }

  const today = new Date().toISOString().slice(0, 10);
  let data;

  try {
    data = await getHSRTimetable(originId, destId, today);
  } catch (e) {
    console.error("HSR API error:", e.message);
    return "🚄 高鐵系統忙碌中，請稍後再試";
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

// ==============================
// 顯示結果
// ==============================
function renderResult(session) {
  const pageSize = 8;
  const start = (session.page - 1) * pageSize;
  const end = start + pageSize;
  const list = session.trips.slice(start, end);

  if (!list.length) {
    return "🚄 該時段沒有班次，請嘗試其他時間";
  }

  let msg =
`🚄 高鐵｜${session.origin} → ${session.destination}
🕒 ${fmt(session.startTime)}–${fmt(
    new Date(session.startTime.getTime() + 2 * 60 * 60 * 1000)
  )}
（共 ${session.trips.length} 班）

`;

  list.forEach((t, i) => {
    msg += `${start + i + 1}️⃣ ${t.dep} 出發｜${t.arr} 抵達\n`;
  });

  if (end < session.trips.length) {
    msg += "\n輸入「後面」查看後續班次\n輸入「取消」結束查詢";
  }

  return msg;
}

function fmt(d) {
  return d.toTimeString().slice(0, 5);
}
