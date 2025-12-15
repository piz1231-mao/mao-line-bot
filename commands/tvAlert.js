const { GoogleAuth } = require("google-auth-library");
const { google } = require("googleapis");
const fs = require("fs");

// ======================================================
// Google Sheet 設定（TV 通知名單）
// 請確認這些 ID 設置正確
// ======================================================
const SPREADSHEET_ID = "11efjOhFI_bY-zaZZw9r00rLH7pV1cvZInSYLWIokKWk";
const SHEET_NAME = "TV通知名單";

// ======================================================
// Google Auth 設置
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
// 從文字中抓取數值型變數的工具函數
// ======================================================

// 抓取 price=xxxx
function extractPriceFromText(text) {
  if (!text) return null;
  const m = text.match(/price\s*=\s*(\d+(\.\d+)?)/i);
  return m ? Number(m[1]) : null;
}

// 抓取 sl=xxxx
function extractSLFromText(text) {
  if (!text) return null;
  // 匹配 sl= 後的數字 (可包含小數點)
  const m = text.match(/sl\s*=\s*(\d+(\.\d+)?)/i);
  return m ? m[1] : null; // 返回字串
}

// 抓取週期 tf=X
function extractTimeframeFromText(text) {
  if (!text) return null;
  // 匹配 tf= 後的數字或字串 (例如 tf=5, tf=60, tf=D)
  const m = text.match(/tf\s*=\s*([^|\s]+)/i);
  return m ? m[1].toUpperCase() : null;
}

// ======================================================
// TradingView → LINE（V1.8.2 最終定稿）
// ======================================================
module.exports = async function tvAlert(client, alertContent, payload = {}) {
  const ids = await getNotifyList();

  // ----------------------------------------------------
  // 統一訊息來源（從各種 Webhook 欄位中提取）
  // ----------------------------------------------------
  const sourceText =
    (typeof alertContent === "string" && alertContent) ||
    payload?.message ||
    payload?.alert ||
    "";

  // ----------------------------------------------------
  // 核心數據解析
  // ----------------------------------------------------
  const direction =
    /BUY/i.test(sourceText) ? "買進" :
    /SELL/i.test(sourceText) ? "賣出" :
    "—";

  const priceText =
    typeof payload.price === "number"
      ? payload.price
      : extractPriceFromText(sourceText) ?? "—";

  const slPriceText = extractSLFromText(sourceText) ?? "—"; // 解析停損價
    
  // ----------------------------------------------------
  // 週期格式化
  // ----------------------------------------------------
  const rawTimeframe = extractTimeframeFromText(sourceText);

  let tfDisplay = "未指定";
  if (rawTimeframe) {
    if (rawTimeframe.match(/^\d+$/)) { 
      tfDisplay = `${rawTimeframe} 分 K`;
    } else if (rawTimeframe === "D") {
      tfDisplay = "日 K";
    } else if (rawTimeframe === "W") {
      tfDisplay = "週 K";
    } else if (rawTimeframe.match(/^[0-9]+[A-Z]$/)) { 
        tfDisplay = rawTimeframe;
    } else { 
      tfDisplay = rawTimeframe;
    }
  }

  // ----------------------------------------------------
  // LINE 訊息構建
  // ----------------------------------------------------
  const msg = {
    type: "text",
    text:
      `📢 毛怪祕書｜TradingView 訊號\n` +
      `━━━━━━━━━━━\n` +
      `📦 商品：台指期\n` +
      `📈 方向：${direction}\n` +
      `🕒 週期：${tfDisplay}\n` + 
      `📊 條件：分數通過\n` +
      `💰 進場價：${priceText}\n` + 
      `🛡️ 停損價：${slPriceText}`
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
