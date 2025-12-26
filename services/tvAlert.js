const { GoogleAuth } = require("google-auth-library");
const { google } = require("googleapis");
const fs = require("fs");
const buildTVFlex = require("./tvAlert.flex");

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
// 工具（全部防呆）
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
// TradingView → LINE（定版）
// ======================================================
module.exports = async function tvAlert(client, alertContent, payload = {}) {
  console.log("🧪 tvAlert triggered");

  const ids = await getNotifyList();
  if (!ids.length) return;

  // ---------- 安全文字 ----------
  let sourceText = "";
  if (typeof alertContent === "string") sourceText = alertContent;
  else if (alertContent && typeof alertContent === "object")
    sourceText = JSON.stringify(alertContent);

  // ---------- 方向 ----------
  const direction =
    /BUY/i.test(sourceText) ? "買進" :
    /SELL/i.test(sourceText) ? "賣出" :
    "—";

  // ---------- 價格 ----------
  const priceText =
    typeof payload.price === "number"
      ? payload.price
      : extractPriceFromText(sourceText) ?? "—";

  // ---------- 停損 ----------
  const rawSL = extractSLFromText(sourceText);
  let slPriceText = "—";
  if (rawSL) {
    const n = Number(rawSL);
    slPriceText = !isNaN(n) ? String(Math.round(n)) : "解析錯誤";
  }

  // ---------- 週期（⚠️ tfDisplay 一定先定義） ----------
  const rawTF = extractTimeframeFromText(sourceText);
  let tfDisplay = "未指定";

  if (rawTF) {
    if (/^\d+$/.test(rawTF)) tfDisplay = `${rawTF} 分 K`;
    else if (rawTF === "D") tfDisplay = "日 K";
    else if (rawTF === "W") tfDisplay = "週 K";
    else tfDisplay = rawTF;
  }

  // ---------- Flex ----------
  let msg;
  try {
    msg = buildTVFlex({
      product: "台指期",
      direction,
      timeframe: tfDisplay,
      price: priceText,
      stopLoss: slPriceText
    });
  } catch (e) {
    console.warn("⚠️ Flex 失敗，退回文字版", e.message);
  }

  // ---------- 文字 fallback ----------
  if (!msg) {
    msg = {
      type: "text",
      text:
        `📢 毛怪秘書出明牌\n` +
        `━━━━━━━━━━━\n` +
        `📦 商品：台指期\n` +
        `📈 方向：${direction}\n` +
        `🕒 週期：${tfDisplay}\n` +
        `📊 條件：分數通過\n` +
        `💰 進場價：${priceText}\n` +
        `🛡️ 停損價：${slPriceText}`
    };
  }

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
