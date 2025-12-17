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

app.get("/tv-alert", (req, res) => {
  console.log("🟡 GET /tv-alert 進來了（測試用）");
  res.status(200).send("OK");
});

// ======================================================
// 取得 LINE 通知名單（防呆完整版）
// ======================================================
async function getNotifyList() {
  const c = await auth.getClient();
  const sheets = google.sheets({ version: "v4", auth: c });

  const rows = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A2:B999`
  });

  const ids = (rows.data.values || [])
    .map(r => (r[1] || "").trim())          // 去空白
    .filter(id => id.startsWith("U") || id.startsWith("C")); // 只收合法 ID

  console.log("📤 TV 推播 ID 清單：", ids);

  return ids;
}

// ======================================================
// 工具：從文字中抓數值
// ======================================================
function extractPriceFromText(text) {
  if (!text) return null;
  const m = text.match(/price\s*=\s*(\d+(\.\d+)?)/i);
  return m ? Number(m[1]) : null;
}

function extractSLFromText(text) {
  if (!text) return null;
  const m = text.match(/sl\s*=\s*(\d+(\.\d+)?)/i);
  return m ? m[1] : null;
}

function extractTimeframeFromText(text) {
  if (!text) return null;
  const m = text.match(/tf\s*=\s*([^|\s]+)/i);
  return m ? m[1].toUpperCase() : null;
}

// ======================================================
// TradingView → LINE（防呆穩定版）
// ======================================================
module.exports = async function tvAlert(client, alertContent, payload = {}) {
  const ids = await getNotifyList();

  if (!ids.length) {
    console.warn("⚠️ TV 推播中止：通知名單為空");
    return;
  }

  // ----------------------------------------------------
  // 統一訊息來源
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

  const rawSL = extractSLFromText(sourceText);
  let slPriceText = "—";

  if (rawSL) {
    const slValue = Number(rawSL);
    slPriceText = !isNaN(slValue) ? String(Math.round(slValue)) : "解析錯誤";
  }

  const rawTF = extractTimeframeFromText(sourceText);
  let tfDisplay = "未指定";

  if (rawTF) {
    if (/^\d+$/.test(rawTF)) tfDisplay = `${rawTF} 分 K`;
    else if (rawTF === "D") tfDisplay = "日 K";
    else if (rawTF === "W") tfDisplay = "週 K";
    else tfDisplay = rawTF;
  }

  // ----------------------------------------------------
  // LINE 訊息
  // ----------------------------------------------------
  const msg = {
    type: "text",
    text:
      `📢 毛怪秘書｜TradingView 訊號\n` +
      `━━━━━━━━━━━\n` +
      `📦 商品：台指期\n` +
      `📈 方向：${direction}\n` +
      `🕒 週期：${tfDisplay}\n` +
      `📊 條件：分數通過\n` +
      `💰 進場價：${priceText}\n` +
      `🛡️ 停損價：${slPriceText}`
  };

  // ----------------------------------------------------
  // 發送 LINE（逐一推播，不互相影響）
// ----------------------------------------------------
  for (const id of ids) {
    try {
      await client.pushMessage(id, msg);
      console.log("✅ TV 訊號已推播：", id);
    } catch (err) {
      console.error(
        "❌ LINE 推播失敗：",
        id,
        err?.originalError?.message || err.message || err
      );
    }
  }
};
