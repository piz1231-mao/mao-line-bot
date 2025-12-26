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
// 取得 LINE 通知名單
// ======================================================
async function getNotifyList() {
  const c = await auth.getClient();
  const sheets = google.sheets({ version: "v4", auth: c });

  const rows = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A2:B999`
  });

  return (rows.data.values || [])
    .map(r => (r[1] || "").trim())
    .filter(id => id.startsWith("U") || id.startsWith("C"));
}

// ======================================================
// 工具：字串解析
// ======================================================
function extract(text, key) {
  if (typeof text !== "string") return null;
  const m = text.match(new RegExp(`${key}=([^|\\s]+)`, "i"));
  return m ? m[1] : null;
}

// ======================================================
// 🧠 毛怪嘴砲邏輯（依 excess + 週期）
// ======================================================
function maoTalk({ tf, excess }) {
  const e = Number(excess) || 0;
  const isLTF = tf === "3"; // 3 分 K 視為子級

  if (isLTF) {
    if (e <= 5)  return "有在動了啦，先看不要急 👀";
    if (e <= 10) return "這個開始有點樣子了，不看會後悔";
    return "3 分就這樣了，5 分不出我不信";
  } else {
    if (e <= 5)  return "條件過了，但不是那種一定要衝的";
    if (e <= 10) return "條件到齊，這種不進說不過去";
    return "這種你不進，盤後一定怪我";
  }
}

// ======================================================
// TradingView → LINE（定版）
// ======================================================
module.exports = async function tvAlert(client, alertContent) {
  console.log("🧪 tvAlert triggered");

  const ids = await getNotifyList();
  if (!ids.length) return;

  const text = String(alertContent || "");

  // ---------- 方向 ----------
  const direction =
    /BUY/i.test(text) ? "買進" :
    /SELL/i.test(text) ? "賣出" :
    "—";

  // ---------- 解析 TV 傳來的資料 ----------
  const tfRaw   = extract(text, "tf")     || "";
  const price   = extract(text, "price")  || "—";
  const sl      = extract(text, "sl")     || "—";
  const excess  = extract(text, "excess") || "0";

  // ---------- 週期顯示 ----------
  const tfDisplay =
    /^\d+$/.test(tfRaw) ? `${tfRaw} 分 K`
    : tfRaw === "D"     ? "日 K"
    : tfRaw === "W"     ? "週 K"
    : "未指定";

  // ---------- 毛怪嘴砲 ----------
  const talk = maoTalk({ tf: tfRaw, excess });

  // ---------- 時間（即時看到算你快） ----------
  const timeText = new Date().toLocaleTimeString("zh-TW", {
    hour: "2-digit",
    minute: "2-digit"
  });

  // ---------- Flex ----------
  const msg = buildTVFlex({
    timeframe: tfDisplay,
    direction,
    talk,
    price,
    stopLoss: sl,
    timeText
  });

  // ---------- 推播 ----------
  for (const id of ids) {
    try {
      await client.pushMessage(id, msg);
      console.log("✅ TV 推播成功：", id);
    } catch (err) {
      console.error("❌ TV 推播失敗：", id, err.message);
    }
  }
};
