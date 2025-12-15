const { GoogleAuth } = require("google-auth-library");
const { google } = require("googleapis");
const fs = require("fs");

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
    .map(r => r[1])
    .filter(Boolean);
}

// ======================================================
// 從 alert 文字中抓 price=xxxx
// ======================================================
function extractPriceFromText(text) {
  if (!text) return null;
  const m = text.match(/price\s*=\s*(\d+(\.\d+)?)/i);
  return m ? Number(m[1]) : null;
}

// ======================================================
// TradingView → LINE 主函式（除錯版）
// ======================================================
module.exports = async function tvAlert(client, alertContent, payload = {}) {
  const ids = await getNotifyList();

  // ---------- 原始內容 ----------
  const text =
    typeof alertContent === "string"
      ? alertContent
      : "";

  // 🔥🔥🔥 關鍵除錯輸出（不要刪）
  console.log("🧪 RAW alertContent =", alertContent);
  console.log("🧪 TEXT =", text);
  console.log("🧪 PAYLOAD =", payload);

  // ---------- 方向 ----------
  const direction =
    /BUY/i.test(text) ? "買進" :
    /SELL/i.test(text) ? "賣出" :
    "—";

  // ---------- 價格 ----------
  const extractedPrice = extractPriceFromText(text);

  console.log("🧪 extractedPrice =", extractedPrice);

  const priceText =
    typeof payload.price === "number"
      ? payload.price
      : extractedPrice ?? "—";

  console.log("🧪 final priceText =", priceText);

  // ======================================================
  // LINE 訊息（定稿好看版）
  // ======================================================
  const msg = {
    type: "text",
    text:
      `📢 毛怪祕書｜TradingView 訊號\n` +
      `━━━━━━━━━━━\n` +
      `📦 商品：台指期\n` +
      `📈 方向：${direction}\n` +
      `🕒 週期：5 分 K\n` +
      `📊 條件：分數通過\n` +
      `💰 價格：${priceText}`
  };

  // ---------- 發送 ----------
  for (const id of ids) {
    try {
      await client.pushMessage(id, msg);
      console.log("✅ 已通知：", id);
    } catch (err) {
      console.error("❌ 通知失敗：", id, err?.originalError || err);
    }
  }
};
