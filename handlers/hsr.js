const { getSession, resetSession } = require("../sessions/sessionStore");

// ==============================
// 高鐵主處理器
// ==============================
module.exports = function handleHSR(event) {
  const userId = event.source.userId;
  const text = event.message.text.trim();
  const session = getSession(userId);

  // ========= 入口 =========
  if (text === "查高鐵") {
    session.state = "HSR_DIRECTION";
    session.page = 1;
    return "🚄 查高鐵\n請選擇方向：\n北上 / 南下";
  }

  // 非高鐵流程，直接略過
  if (!session.state || !session.state.startsWith("HSR_")) {
    return null;
  }

  // ========= 方向 =========
  if (session.state === "HSR_DIRECTION") {
    if (text === "北上") {
      session.direction = "NORTH";
    } else if (text === "南下") {
      session.direction = "SOUTH";
    } else {
      return "請回覆：北上 或 南下";
    }

    session.state = "HSR_STATION";
    return "🚄 請輸入起訖站\n格式：A到B\n例如：台中到台北";
  }

  // ========= 站名 =========
  if (session.state === "HSR_STATION") {
    if (!text.includes("到")) {
      return "站名格式錯誤，請輸入：台中到台北";
    }

    const [from, to] = text.split("到");
    session.origin = from.trim();
    session.destination = to.trim();
    session.state = "HSR_TIME";

    return "🚄 要查什麼時間？\n未指定則查接下來 2 小時";
  }

  // ========= 時間（先用預設） =========
  if (session.state === "HSR_TIME") {
    session.startTime = new Date(); // 先固定現在
    session.state = "HSR_RESULT";

    // ⚠️ 先用假資料，確認流程
    session.trips = mockTrips();
    session.page = 1;

    return renderResult(session);
  }

  // ========= 分頁 =========
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
// 回覆格式
// ==============================
function renderResult(session) {
  const pageSize = 8;
  const start = (session.page - 1) * pageSize;
  const end = start + pageSize;
  const pageTrips = session.trips.slice(start, end);

  let msg = `🚄 高鐵｜${session.origin} → ${session.destination}\n`;
  msg += `接下來 2 小時內可搭班次（共 ${session.trips.length} 班）\n\n`;

  pageTrips.forEach((t, i) => {
    msg += `${start + i + 1}️⃣ ${t.dep} 出發｜${t.arr} 抵達\n`;
  });

  if (end < session.trips.length) {
    msg += "\n▶︎ 查看後面班次";
  }

  return msg;
}

// ==============================
// 假資料（下一步會換掉）
// ==============================
function mockTrips() {
  return Array.from({ length: 14 }, (_, i) => ({
    dep: `15:${String(i * 5).padStart(2, "0")}`,
    arr: `16:${String(i * 5).padStart(2, "0")}`
  }));
}
