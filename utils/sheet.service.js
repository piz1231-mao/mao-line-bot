// utils/invoice.state.js
const invoiceState = new Map();

/**
 * 設定使用者進入發票登記模式
 */
function setInvoiceState(userId, text) {
  invoiceState.set(userId, {
    mode: "invoice",
    note: text,
    time: Date.now()
  });
}

/**
 * 取得使用者發票狀態
 */
function getInvoiceState(userId) {
  return invoiceState.get(userId);
}

/**
 * 清除狀態
 */
function clearInvoiceState(userId) {
  invoiceState.delete(userId);
}

module.exports = {
  setInvoiceState,
  getInvoiceState,
  clearInvoiceState
};
