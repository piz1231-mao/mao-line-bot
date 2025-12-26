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
// 🔧 工具（解析 TV 字串）
// ======================================================
function extractTF(text) {
  const m = text.match(/tf\s*=\s*([^|]+)/i);
  if (!m) return "未指定";
  const tf = m[1].trim();
  return /^\d+$/.test(tf) ? `${tf} 分 K` : tf;
}

function extractPrice(text) {
  const m = text.match(/price\s*=\s*(\d+(\.\d+)?)/i);
  return m ? m[1] : "—";
}

function extractSL(text) {
  const m = text.match(/sl\s*=\s*(\d+(\.\d+)?)/i);
  return m ? m[1] : "—";
}

function extractScore(text) {
  const m = text.match(/score\s*=\s*(\d+)\s*\(\+?(\d+)\)/i);
  if (!m) return null;
  return {
    score: Number(m[1]),
    excess: Number(m[2])
  };
}

// ======================================================
// 🧠 毛怪語氣判斷（只在 Bot）
// ======================================================
function getMaoTone(excess) {
  if (excess >= 15)
    return "🧠 毛怪直接跟你說：這分數還不進，是要對不起誰？";

  if (excess >= 10)
    return "😈 條件齊到靠北，錯過真的會捶心肝。";

  if (excess >= 5)
    return "👀 分數有過，先盯著看，很可能要發動。";

  return "🤏 剛過門檻，想搶可以，但風險自己吞。";
}

// ======================================================
// TradingView → LINE（定版）
// ======================================================
module.exports = async function tvAlert(client, alertContent) {
  console.log("🧪 tvAlert triggered");

  const ids = await getNotifyList();
  if (!ids.length) return;

  const sourceText =
    typeof alertContent === "string"
      ? alertContent
      : JSON.stringify(alertContent);

  // ---------- 方向 ----------
  const direction =
    /BUY/i.test(sourceText)
      ? "買進"
      : /SELL/i.test(sourceText)
      ? "賣出"
      : "—";

  // ---------- 基本資料 ----------
  const timeframe = extractTF(sourceText);
  const price = extractPrice(sourceText);
  const stopLoss = extractSL(sourceText);

  // ---------- 分數 ----------
  const scoreInfo = extractScore(sourceText);
  const tone = scoreInfo ? getMaoTone(scoreInfo.excess) : null;

  // ---------- Flex ----------
  const msg = buildTVFlex({
    product: "台指期",
    direction,
    timeframe,
    price,
    stopLoss,
    tone
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
