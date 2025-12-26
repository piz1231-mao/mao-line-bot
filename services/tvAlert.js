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
// 工具（全部防呆）
// ======================================================
function extractNumber(text, key) {
  if (typeof text !== "string") return null;
  const m = text.match(new RegExp(`${key}\\s*=\\s*(-?\\d+(\\.\\d+)?)`, "i"));
  return m ? Number(m[1]) : null;
}

function extractTimeframeFromText(text) {
  if (typeof text !== "string") return null;
  const m = text.match(/tf\s*=\s*([^|\s]+)/i);
  return m ? m[1].toUpperCase() : null;
}

// ======================================================
// 🧠 毛怪語氣核心（只在這裡調）
// ======================================================
function getMaoTalk(tf, excess) {
  const isChild = Number(tf) <= 3;

  if (isChild) {
    if (excess < 5)  return "🤨 有動靜而已，先看";
    if (excess < 10) return "😏 3分K在敲門，可以盯";
    return "😈 3分K拉成這樣，主力在熱身";
  } else {
    if (excess < 5)  return "🙂 剛過門檻，保守一點";
    if (excess < 10) return "🔥 條件齊了，可以進";
    return "🤬 這分數不進，是要等法會？";
  }
}

function getLevel(excess) {
  if (excess >= 15) return "STRONG";
  if (excess >= 8)  return "CONFIRM";
  return "WATCH";
}

// ======================================================
// TradingView → LINE（定版＋分數語氣）
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

  // ---------- 基本數值 ----------
  const price  = extractNumber(sourceText, "price") ?? "—";
  const slRaw  = extractNumber(sourceText, "sl");
  const score  = extractNumber(sourceText, "score");
  const excess = extractNumber(sourceText, "excess") ?? 0;

  const slPriceText =
    typeof slRaw === "number" && !isNaN(slRaw)
      ? String(Math.round(slRaw))
      : "—";

  // ---------- 週期 ----------
  const rawTF = extractTimeframeFromText(sourceText);
  let tfDisplay = "未指定";
  let tfNumber = null;

  if (rawTF) {
    if (/^\d+$/.test(rawTF)) {
      tfNumber = Number(rawTF);
      tfDisplay = `${rawTF} 分 K`;
    } else if (rawTF === "D") tfDisplay = "日 K";
    else if (rawTF === "W") tfDisplay = "週 K";
    else tfDisplay = rawTF;
  }

  // ---------- 毛怪判斷 ----------
  const maoTalk = score !== null
    ? getMaoTalk(tfNumber ?? 999, excess)
    : "📊 條件通過";

  const level = score !== null ? getLevel(excess) : "WATCH";

  // ---------- Flex ----------
  let msg;
  try {
    msg = buildTVFlex({
      product: "台指期",
      direction,
      timeframe: tfDisplay,
      price,
      stopLoss: slPriceText,
      score,
      excess,
      talk: maoTalk,
      level
    });
  } catch (e) {
    console.warn("⚠️ Flex 失敗，退回文字版", e.message);
  }

  // ---------- 文字 fallback（保留原風格） ----------
  if (!msg) {
    msg = {
      type: "text",
      text:
        `📢 毛怪秘書出明牌\n` +
        `━━━━━━━━━━━\n` +
        `📦 商品：台指期\n` +
        `📈 方向：${direction}\n` +
        `🕒 週期：${tfDisplay}\n` +
        `📊 分數：${score ?? "通過"}（+${excess}）\n` +
        `💰 進場價：${price}\n` +
        `🛡️ 停損價：${slPriceText}\n\n` +
        maoTalk
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
