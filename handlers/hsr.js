// ======================================================
// 🚄 高鐵查詢 Handler（v1.0 最終定版）
// ======================================================

const { getSession, clearSession } = require("../sessions/sessionStore");
const { getSessionKey } = require("../utils/sessionKey");
const { getHSRAllTimetable } = require("../services/tdx");

console.log("✅ HSR handler loaded");

// ---------- 工具 ----------

// "21:30" or "21:30:00" → minutes
function toMinutes(t) {
  if (!t) return null;
  const parts = t.split(":").map(Number);
  if (parts.length < 2) return null;
  return parts[0] * 60 + parts[1];
}

// 使用者輸入時間
function parseInputTime(text) {
  const m = text.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

// ======================================================
// 主 Handler
// ======================================================
module.exports = async function handleHSR(event) {
  if (event.type !== "message" || event.message.type !== "text") {
    return null;
  }

  const text = event.message.text.trim();
  const key = getSessionKey(event);
  const session = getSession(key);

  // ======================================================
  // ✅ 正確入口鎖（關鍵）
  // - 尚未進入流程：只能用「查高鐵」
  // - 已進流程：全部交給 HSR 處理
  // ======================================================
  if (!session.state && text !== "查高鐵") {
    return null;
  }

  console.log("[HSR] event:", text);

  // ======================================================
  // 起手
  // ======================================================
  if (text === "查高鐵") {
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
  // 時間 → 查詢（查完即結束）
  // ======================================================
  if (session.state === "HSR_TIME") {
    const startMin = parseInputTime(text);
    if (startMin === null) {
      return "請輸入正確時間格式（例如 21:30）";
    }

    session.startMin = startMin;

    const result = await queryHSR(session);

    // 🔥 查完立刻清 session，避免後續對話被吃
    clearSession(key);

    return result;
  }

  return null;
};

// ======================================================
// 查詢高鐵（今天｜全線 → 自行篩選）
// ======================================================
async function queryHSR(session) {
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

  console.log("[HSR] raw trains:", trains.length);

  const trips = [];

  for (const train of trains) {
    const stops = train.StopTimes;
    if (!Array.isArray(stops)) continue;

    // ✅ 用站名比對（最穩定）
    const oIdx = stops.findIndex(
      s => s.StationName?.Zh_tw === session.origin
    );
    const dIdx = stops.findIndex(
      s => s.StationName?.Zh_tw === session.dest
    );

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

  let msg = `🚄 高鐵｜${session.origin} → ${session.dest}\n\n`;
  trips.slice(0, 8).forEach((t, i) => {
    msg += `${i + 1}️⃣ ${t.dep} → ${t.arr}\n`;
  });

  return msg;
}
