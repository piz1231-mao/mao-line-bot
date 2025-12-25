// ======================================================
// 🚄 高鐵查詢 Handler（最終穩定版｜可中斷狀態機）
// ======================================================

const { getSession, clearSession } = require("../sessions/sessionStore");
const { getSessionKey } = require("../utils/sessionKey");
const { getHSRAllTimetable } = require("../services/tdx");

console.log("✅ HSR handler loaded");

// ------------------------------------------------------
// utils
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

function todayYYYYMMDD() {
  return new Date()
    .toLocaleDateString("zh-TW", { timeZone: "Asia/Taipei" })
    .split("/")
    .map(v => v.padStart(2, "0"))
    .join("-");
}

// ------------------------------------------------------
// 非高鐵指令前綴（逃生用）
// ------------------------------------------------------
const NON_HSR_PREFIX = [
  "天氣",
  "查天氣",
  "待辦",
  "待辦：",
  "股 ",
  "查股票",
  "查業績",
  "大哥您好"
];

// ------------------------------------------------------
// 主 Handler
// ------------------------------------------------------
module.exports = async function handleHSR(event) {
  if (event.type !== "message") return null;
  if (event.message.type !== "text") return null;
  if (event.source.type !== "user") return null; // 私訊限定

  const text = event.message.text.trim();
  const key = getSessionKey(event);
  let session = getSession(key);

  console.log("[HSR]", {
    input: text,
    state: session.state,
    inHSR: session.inHSR
  });

  // ====================================================
  // 🔥 逃生機制（最關鍵）
  // 只要在 HSR 狀態中，輸入非高鐵指令 → 立刻放人
  // ====================================================
  if (session.inHSR) {
    const isNonHSR = NON_HSR_PREFIX.some(p => text.startsWith(p));
    if (isNonHSR && text !== "查高鐵") {
      console.log("🧯 HSR escape → clear session");
      clearSession(key);
      return null;
    }
  }

  // ====================================================
  // 起手
  // ====================================================
  if (text === "查高鐵") {
    clearSession(key);
    session = getSession(key);
    session.inHSR = true;
    session.state = "DIR";
    session.lastActive = Date.now();
    return "🚄 查高鐵\n請選擇方向：\n北上 / 南下";
  }

  // ====================================================
  // 非高鐵流程直接略過
  // ====================================================
  if (!session.inHSR) return null;

  // ====================================================
  // 軟 timeout（防止卡死，不鎖人）
  // ====================================================
  if (session.lastActive && Date.now() - session.lastActive > 3 * 60 * 1000) {
    console.log("⏱ HSR session timeout → clear");
    clearSession(key);
    return null;
  }

  session.lastActive = Date.now();

  // ====================================================
  // 狀態機
  // ====================================================
  switch (session.state) {
    case "DIR":
      if (!text.includes("北上") && !text.includes("南下")) {
        return "請選擇方向：北上 或 南下";
      }
      session.dir = text;
      session.state = "STATION";
      return "🚄 請輸入起訖站\n例如：左營到台中";

    case "STATION":
      if (!text.includes("到")) {
        return "格式錯誤，請輸入：左營到台中";
      }
      const [o, d] = text.split("到").map(s => s.trim());
      session.origin = o;
      session.dest = d;
      session.state = "TIME";
      return `🚄 從 ${o} 到 ${d}\n請輸入出發時間（例如 21:30）`;

    case "TIME":
      const startMin = parseTime(text);
      if (startMin === null) {
        return "時間格式錯誤，請輸入例如 21:30";
      }

      session.startMin = startMin;
      const result = await queryHSR(session);
      clearSession(key);
      return result;

    default:
      clearSession(key);
      return null;
  }
};

// ======================================================
// 查詢高鐵
// ======================================================
async function queryHSR(session) {
  try {
    const date = todayYYYYMMDD();
    const trains = await getHSRAllTimetable(date);

    if (!Array.isArray(trains)) {
      return "🚄 暫時無法取得高鐵時刻表";
    }

    const oName = session.origin.replace("站", "");
    const dName = session.dest.replace("站", "");
    const trips = [];

    for (const t of trains) {
      const stops = t.StopTimes;
      if (!stops) continue;

      const oIdx = stops.findIndex(s => s.StationName?.Zh_tw.includes(oName));
      const dIdx = stops.findIndex(s => s.StationName?.Zh_tw.includes(dName));
      if (oIdx === -1 || dIdx === -1 || oIdx >= dIdx) continue;

      const dep = stops[oIdx].DepartureTime;
      const arr = stops[dIdx].ArrivalTime;
      if (toMinutes(dep) < session.startMin) continue;

      trips.push({
        trainNo: t.TrainNo || "",
        dep: dep.slice(0, 5),
        arr: arr.slice(0, 5),
        depMin: toMinutes(dep)
      });
    }

    trips.sort((a, b) => a.depMin - b.depMin);

    if (!trips.length) return "🚄 該時間之後沒有可搭乘班次";

    let msg = `🚄 高鐵時刻表\n${session.origin} → ${session.dest}\n━━━━━━━━━━\n`;
    trips.slice(0, 8).forEach(t => {
      msg += `\n🚆 ${t.trainNo}\n🕒 ${t.dep} → ${t.arr}\n`;
    });

    return msg;
  } catch (err) {
    console.error("[HSR] query error:", err);
    return "🚄 查詢發生錯誤，請稍後再試";
  }
}
