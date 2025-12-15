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
// 從文字中抓 price=xxxx
// ======================================================
function extractPriceFromText(text) {
  if (!text) return null;
  // 匹配 price= 後的數字 (可包含小數點)
  const m = text.match(/price\s*=\s*(\d+(\.\d+)?)/i);
  return m ? Number(m[1]) : null;
}

// ======================================================
// 【新增】從文字中抓取週期 tf=X
// ======================================================
function extractTimeframeFromText(text) {
  if (!text) return null;
  // 匹配 tf= 後的數字或字串 (例如 tf=5, tf=60, tf=D)
  const m = text.match(/tf\s*=\s*([^|\s]+)/i);
  return m ? m[1].toUpperCase() : null;
}


// ======================================================
// TradingView → LINE（最終定稿）
// ======================================================
module.exports = async function tvAlert(client, alertContent, payload = {}) {
  const ids = await getNotifyList();

  // ----------------------------------------------------
  // 統一訊息來源（最關鍵）
  // ----------------------------------------------------
  const sourceText =
    (typeof alertContent === "string" && alertContent) ||
    payload?.message ||
    payload?.alert ||
    "";

  // ----------------------------------------------------
  // 方向判斷
  // ----------------------------------------------------
  const direction =
    /BUY/i.test(sourceText) ? "買進" :
    /SELL/i.test(sourceText) ? "賣出" :
    "—";

  // ----------------------------------------------------
  // 價格判斷
  // ----------------------------------------------------
  const priceText =
    typeof payload.price === "number"
      ? payload.price
      : extractPriceFromText(sourceText) ?? "—";
      
  // ----------------------------------------------------
  // 【新增】週期判斷
  // ----------------------------------------------------
  // 抓取tf=的值 (例如: "5", "3", "D", "60")
  const rawTimeframe = extractTimeframeFromText(sourceText);

  // 轉換週期顯示格式
  let tfDisplay = "未指定";
  if (rawTimeframe) {
    if (rawTimeframe.match(/^\d+$/)) { // 判斷是否為數字（分鐘K）
      tfDisplay = `${rawTimeframe} 分 K`;
    } else if (rawTimeframe === "D") {
      tfDisplay = "日 K";
    } else if (rawTimeframe === "W") {
      tfDisplay = "週 K";
    } else if (rawTimeframe.match(/^[0-9]+[A-Z]$/)) { // 匹配 TradingView 格式 60T/D/W
        tfDisplay = rawTimeframe;
    } else { // 預設使用原始值
      tfDisplay = rawTimeframe;
    }
  }


  // ----------------------------------------------------
  // LINE 訊息（動態週期定稿版）
  // ----------------------------------------------------
  const msg = {
    type: "text",
    text:
      `📢 毛怪祕書｜TradingView 訊號\n` +
      `━━━━━━━━━━━\n` +
      `📦 商品：台指期\n` +
      `📈 方向：${direction}\n` +
      `🕒 週期：${tfDisplay}\n` + // <--- 已修改為動態週期
      `📊 條件：分數通過\n` +
      `💰 價格：${priceText}`
  };

  // ----------------------------------------------------
  // 發送 LINE
  // ----------------------------------------------------
  for (const id of ids) {
    try {
      await client.pushMessage(id, msg);
    } catch (err) {
      console.error("LINE 推播失敗：", id, err?.originalError || err);
    }
  }
};
