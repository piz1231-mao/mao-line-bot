// sessions/sessionStore.js
const sessions = {};

function getSession(sessionKey) {
  if (!sessions[sessionKey]) {
    sessions[sessionKey] = {};
  }
  return sessions[sessionKey];
}

function clearSession(sessionKey) {
  delete sessions[sessionKey];
}

module.exports = {
  getSession,
  clearSession
};
