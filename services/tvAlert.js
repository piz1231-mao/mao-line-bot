const { GoogleAuth } = require("google-auth-library");
const { google } = require("googleapis");
const fs = require("fs");
const { buildTVFlex } = require("./tv.flex");

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
    .map(r => (r[1] || "").trim())
    .filter(id => id.startsWith("U") || id.startsWith("C"));

  console.log("📤 TV 推播 ID 清單：", ids);
  return ids;
}

// ======================================================
// 工具函式（全部防呆：只吃字串）
// ======================================================
function extractPriceFromText(text) {
  if (typeof text !== "string") return null;
  const m = text.match(/price\s*=\s*(\d+(\.\d+)?)/i);
  return m ? Number(m[1]) : null;
}

function extractSLFromText(text) {
  if (typeof text !== "string") return null;
  const m = text.match(/sl\s*=\s*(\d+(\.\d+)?)/i);
  return m ? m[1] : null;
}

function extractTimeframeFromText(text) {
  if (typeof text !== "string") return null;
  const m = text.match(/tf\s*=\s*([^|\s]+)/i);
  return m ? m[1].toUpperCase() : null;
}

// ======================================================
// TradingView → LINE（最終封板版）
// ======================================================
module.exports = async function tvAlert(client, alertContent, payload = {}) {
  console.log("🧪 tvAlert 函式執行");

  // ----------------------------------------------------
  // 通知名單
  // ----------------------------------------------------
  const ids = await getNotifyList();
  if (!ids.length) {
    console.warn("⚠️ 通知名單為空，略過推播");
    return;
  }

  // ----------------------------------------------------
  // 強制把訊息轉成「安全字串」
  // ----------------------------------------------------
  let safeText = "";

  if (typeof alertContent === "string") {
    safeText = alertContent;
  } else if (alertContent && typeof alertContent === "object") {
    safeText = JSON.stringify(alertContent);
  } else {
    safeText = "";
  }

  const sourceText =
    safeText ||
    payload.message ||
    payload.alert ||
    "";

  console.log("📝 解析用文字：", sourceText);

  // ----------------------------------------------------
  // 方向
  // ----------------------------------------------------
  const direction =
    /BUY/i.test(sourceText) ? "買進" :
    /SELL/i.test(sourceText) ? "賣出" :
    "—";

  // ----------------------------------------------------
  // 價格
  // ----------------------------------------------------
  const priceText =
    typeof payload.price === "number"
      ? payload.price
      : extractPriceFromText(sourceText) ?? "—";

  // ----------------------------------------------------
  // 停損
  // ----------------------------------------------------
  const rawSL = extractSLFromText(sourceText);
  let slPriceText = "—";

  if (rawSL) {
    const slValue = Number(rawSL);
    slPriceText = !isNaN(slValue)
      ? String(Math.round(slValue))
      : "解析錯誤";
  }

  // ----------------------------------------------------
  // 週期
  // ----------------------------------------------------
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
    // 🟢 優先送 Flex 名牌
    await client.pushMessage(
      id,
      buildTVFlex({
        symbol: "台指期",
        direction,
        timeframe: tfDisplay,
        entry: priceText,
        stop: slPriceText
      })
    );
    console.log("✅ TV Flex 已推播：", id);

  } catch (err) {
    // 🔴 Flex 失敗 → 回退原本文字（保命）
    console.warn("⚠️ Flex 失敗，改送文字", id);

    await client.pushMessage(id, msg);
  }
}
