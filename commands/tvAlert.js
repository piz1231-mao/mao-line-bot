const { GoogleAuth } = require("google-auth-library");
const { google } = require("googleapis");
const fs = require("fs");

// ======================================================
// Google Sheet 設定
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
// 取得 LINE 通知名單（防呆）
// ======================================================
async function getNotifyList() {
  const c = await auth.getClient();
  const sheets = google.sheets({ version: "v4", auth: c });

  const rows = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A2:B999`
  });

  const ids = (rows.data.values || [])
    .map(r => (r[1] || "").trim())
    .filter(id => id.startsWith("U") || id.startsWith("C"));

  console.log("📤 TV 推播 ID 清單：", ids);
  return ids;
}

// ======================================================
// 工具函式
// ======================================================
function extractPriceFromText(text) {
  const m = text?.match(/price\s*=\s*(\d+(\.\d+)?)/i);
  return m ? Number(m[1]) : null;
}

function extractSLFromText(text) {
  const m = text?.match(/sl\s*=\s*(\d+(\.\d+)?)/i);
  return m ? m[1] : null;
}

function extractTimeframeFromText(text) {
  const m = text?.match(/tf\s*=\s*([^|\s]+)/i);
  return m ? m[1].toUpperCase() : null;
}

// ======================================================
// TradingView → LINE
// ======================================================
module.exports = async function tvAlert(client, alertContent, payload = {}) {
  console.log("🧪 tvAlert 函式執行");

  const ids = await getNotifyList();
  if (!ids.length) {
    console.warn("⚠️ 通知名單為空，停止推播");
    return;
  }

  const sourceText =
    alertContent ||
    payload?.message ||
    payload?.alert ||
    "";

  const direction =
    /BUY/i.test(sourceText) ? "買進" :
    /SELL/i.test(sourceText) ? "賣出" : "—";

  const price =
    typeof payload.price === "number"
      ? payload.price
      : extractPriceFromText(sourceText) ?? "—";

  const rawSL = extractSLFromText(sourceText);
  const slPrice = rawSL ? String(Math.round(Number(rawSL))) : "—";

  const tfRaw = extractTimeframeFromText(sourceText);
  const tf =
    /^\d+$/.test(tfRaw) ? `${tfRaw} 分 K` :
    tfRaw === "D" ? "日 K" :
    tfRaw === "W" ? "週 K" :
    tfRaw || "未指定";

  const msg = {
    type: "text",
    text:
      `📢 毛怪秘書｜TradingView 訊號\n` +
      `━━━━━━━━━━━\n` +
      `📈 方向：${direction}\n` +
      `🕒 週期：${tf}\n` +
      `💰 進場價：${price}\n` +
      `🛡️ 停損價：${slPrice}`
  };

  for (const id of ids) {
    try {
      await client.pushMessage(id, msg);
      console.log("✅ LINE 已推播：", id);
    } catch (err) {
      console.error("❌ LINE 推播失敗：", id, err.message);
    }
  }
};
