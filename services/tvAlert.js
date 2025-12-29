const { GoogleAuth } = require("google-auth-library");
const { google } = require("googleapis");
const fs = require("fs");
const { buildTVFlex } = require("./tvAlert.flex");

// ======================================================
// Google Sheet 設定（TV 通知名單）
// ======================================================
const SPREADSHEET_ID = "11efjOhFI_bY-zaZZw9r00rLH7pV1cvZInSYLWIokKWk";
const SHEET_NAME = "TV通知名單";

// ======================================================
// Google Auth
// ======================================================
const credentials = JSON.parse(
  fs.readFileSync("/etc/secrets/google-credentials.json", "utf8")
);

const auth = new GoogleAuth({
  credentials,
  scopes: ["https://www.googleapis.com/auth/spreadsheets"]
});

// ======================================================
// 取得 LINE 通知名單（防爆，不會中斷）
// ======================================================
async function getNotifyListSafe() {
  try {
    const c = await auth.getClient();
    const sheets = google.sheets({ version: "v4", auth: c });

    const rows = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A2:B999`
    });

    return (rows.data.values || [])
      .map(r => (r[1] || "").trim())
      .filter(id => id.startsWith("U") || id.startsWith("C"));
  } catch (err) {
    console.error("❌ Google Sheets 讀取失敗：", err.message);
    return [];
  }
}

// ======================================================
// 工具：從字串抓參數（備援）
// ======================================================
function extract(text, key) {
  if (typeof text !== "string") return null;
  const m = text.match(new RegExp(`${key}=([^|\\s]+)`, "i"));
  return m ? m[1] : null;
}

// ======================================================
// 毛怪嘴砲（完全不影響送不送）
// ======================================================
function maoTalk({ tf, excess }) {
  const e = Number(excess) || 0;
  const isLTF = tf === "3";

  if (isLTF) {
    if (e <= 5)  return "子級有動靜，自己判斷 👀";
    if (e <= 10) return "子級開始有力道了";
    return "子級拉起來了，注意";
  } else {
    if (e <= 5)  return "主級條件成立";
    if (e <= 10) return "主級條件完整";
    return "主級力道很夠";
  }
}

// ======================================================
// TradingView → LINE（全送、不篩、最終版）
// ======================================================
module.exports = async function tvAlert(client, alertContent) {
  console.log("🧪 tvAlert triggered");

  // --------------------------------------------------
  // 1️⃣ 同時支援 JSON / 字串
  // --------------------------------------------------
  let payload = {};
  let text = "";

  if (typeof alertContent === "string") {
    text = alertContent;
  } else if (typeof alertContent === "object" && alertContent !== null) {
    payload = alertContent;
    text = JSON.stringify(alertContent);
  }

  console.log("📩 RAW ALERT:", text);

  // --------------------------------------------------
  // 2️⃣ 方向解析（⚠️ 不再作為擋訊號條件）
  // --------------------------------------------------
  let direction = null;

  if (/BUY/i.test(text))  direction = "買進";
  if (/SELL/i.test(text)) direction = "賣出";

  // 👉 完全解析不到也照送
  if (!direction) {
    console.warn("⚠️ 無法解析方向，標記為提醒仍送出");
    direction = "提醒";
  }

  // --------------------------------------------------
  // 3️⃣ 解析其他欄位（JSON 優先，沒有也不擋）
  // --------------------------------------------------
  const tfRaw  = payload.tf     || extract(text, "tf")     || "";
  const price  = payload.price  || extract(text, "price")  || "—";
  const sl     = payload.sl     || extract(text, "sl")     || "—";
  const excess = payload.excess || extract(text, "excess") || "0";

  const tfDisplay =
    /^\d+$/.test(tfRaw) ? `${tfRaw} 分 K`
    : tfRaw === "D"     ? "日 K"
    : tfRaw === "W"     ? "週 K"
    : "未指定";

  const talk = maoTalk({ tf: tfRaw, excess });

  const timeText = new Date().toLocaleTimeString("zh-TW", {
    timeZone: "Asia/Taipei",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });

  // --------------------------------------------------
  // 4️⃣ 取得 LINE 通知名單
  // --------------------------------------------------
  const ids = await getNotifyListSafe();
  if (!ids.length) {
    console.warn("⚠️ LINE 通知名單為空，略過推播");
    return;
  }

  // --------------------------------------------------
  // 5️⃣ 建立 Flex（永遠嘗試）
  // --------------------------------------------------
  let msg;
  try {
    msg = buildTVFlex({
      timeframe: tfDisplay,
      direction,
      talk,
      price,
      stopLoss: sl,
      timeText
    });
  } catch (err) {
    console.error("❌ Flex 建立失敗：", err.message);
    return;
  }

  // --------------------------------------------------
  // 6️⃣ 推播 LINE（一定送）
  // --------------------------------------------------
  for (const id of ids) {
    try {
      await client.pushMessage(id, msg);
      console.log("✅ TV 推播成功：", id);
    } catch (err) {
      console.error("❌ TV 推播失敗：", id);
      console.error("❌ LINE ERROR：", err.message);
      console.error("❌ PAYLOAD：", JSON.stringify(msg));
    }
  }
};
