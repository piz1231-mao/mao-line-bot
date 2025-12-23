// ======================================================
// 🚄 高鐵查詢 Handler（最終更新封版）
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

// ======================================================
// 主 Handler
// ======================================================
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
  // 起手
  // ====================================================
  if (text === "查高鐵") {
    clearSession(key);
    session = getSession(key); // 重新取得乾淨 session
    session.inHSR = true;
    session.state = "DIR";
    return "🚄 查高鐵\n請選擇方向：\n北上 / 南下";
  }

  // ====================================================
  // 流程外直接忽略
  // ====================================================
  if (!session.inHSR) {
    return null;
  }

  // ====================================================
  // 狀態機
  // ====================================================
  switch (session.state) {
    // ---------- DIR ----------
    case "DIR":
      if (!text.includes("北上") && !text.includes("南下")) {
        return "請選擇方向：北上 或 南下";
      }
      session.dir = text;
      session.state = "STATION";
      return "🚄 請輸入起訖站\n例如：左營到台中";

    // -------- STATION --------
    case "STATION":
      if (!text.includes("到")) {
        return "格式錯誤，請輸入：左營到台中";
      }
      const [o, d] = text.split("到").map(s => s.trim());
      session.origin = o;
      session.dest = d;
      session.state = "TIME";
      return `🚄 從 ${o} 到 ${d}\n請輸入出發時間（例如 21:30）`;

    // ---------- TIME ----------
    case "TIME":
      const startMin = parseTime(text);
      if (startMin === null) {
        return "時間格式錯誤，請輸入例如 21:30";
      }

      session.startMin = startMin;
      const result = await queryHSR(session);

      clearSession(key); // 查完一定清
      return result;

    default:
      clearSession(key);
      return null;
  }
};

// ======================================================
// 查詢高鐵（站名模糊比對 + 車次相容）
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

      const oIdx = stops.findIndex(s =>
        s.StationName?.Zh_tw.includes(oName)
      );
      const dIdx = stops.findIndex(s =>
        s.StationName?.Zh_tw.includes(dName)
      );

      if (oIdx === -1 || dIdx === -1 || oIdx >= dIdx) continue;

      const dep = stops[oIdx].DepartureTime;
      const arr = stops[dIdx].ArrivalTime;

      if (toMinutes(dep) < session.startMin) continue;

      const trainNo =
        t.TrainNo ??
        t.trainNo ??
        t.TrainCode ??
        t.DailyTrainInfo?.TrainNo ??
        "";

      trips.push({
        trainNo,
        dep: dep.slice(0, 5),
        arr: arr.slice(0, 5),
        depMin: toMinutes(dep)
      });
    }

    trips.sort((a, b) => a.depMin - b.depMin);

    console.log("[HSR] filtered trips:", trips.length);

    if (trips.length === 0) {
      return "🚄 該時間之後沒有可搭乘班次";
    }

  let msg = `🚄 高鐵時刻表\n${session.origin} → ${session.dest}\n`;
msg += `━━━━━━━━━━\n`;

trips.slice(0, 8).forEach(t => {
  if (t.trainNo) {
    msg += `\n🚆 ${t.trainNo}\n🕒 ${t.dep} → ${t.arr}\n`;
  } else {
    msg += `\n🕒 ${t.dep} → ${t.arr}\n`;
  }
});

    return msg;

  } catch (err) {
    console.error("[HSR] query error:", err);
    return "🚄 查詢發生錯誤，請稍後再試";
  }
}
