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
    .map(r => (r[1] || "").trim())
    .filter(id => id.startsWith("U") || id.startsWith("C"));
}

// ======================================================
// 工具：從文字抓資料
// ======================================================
function extract(text, regex) {
  if (typeof text !== "string") return null;
  const m = text.match(regex);
  return m ? m[1] : null;
}

// ======================================================
// TradingView → LINE（文字穩定版）
// ======================================================
module.exports = async function tvAlert(client, alertContent, payload = {}) {
  console.log("🧪 tvAlert triggered");

  const ids = await getNotifyList();
  if (!ids.length) return;

  // 安全文字
  let sourceText = "";
  if (typeof alertContent === "string") sourceText = alertContent;
  else if (alertContent && typeof alertContent === "object")
    sourceText = JSON.stringify(alertContent);

  // 方向
  const direction =
    /BUY/i.test(sourceText) ? "買進" :
    /SELL/i.test(sourceText) ? "賣出" :
    "—";

  // 價格
  const price =
    typeof payload.price === "number"
      ? payload.price
      : extract(sourceText, /price\s*=\s*(\d+(\.\d+)?)/i) || "—";

  // 停損
  const sl =
    extract(sourceText, /sl\s*=\s*(\d+(\.\d+)?)/i) || "—";

  // 週期
  const tfRaw = extract(sourceText, /tf\s*=\s*([A-Za-z0-9]+)/i);
  let tf = "未指定";
  if (tfRaw) {
    if (/^\d+$/.test(tfRaw)) tf = `${tfRaw} 分 K`;
    else if (tfRaw === "D") tf = "日 K";
    else if (tfRaw === "W") tf = "週 K";
    else tf = tfRaw;
  }

  const msg = {
    type: "text",
    text:
      `📢 毛怪秘書出明牌\n` +
      `━━━━━━━━━━━\n` +
      `📦 商品：台指期\n` +
      `📈 方向：${direction}\n` +
      `🕒 週期：${tf}\n` +
      `📊 條件：分數通過\n` +
      `💰 進場價：${price}\n` +
      `🛡️ 停損價：${sl}`
  };

  for (const id of ids) {
    try {
      await client.pushMessage(id, msg);
      console.log("✅ 推播成功：", id);
    } catch (err) {
      console.error("❌ 推播失敗：", id, err.message);
    }
  }
};
