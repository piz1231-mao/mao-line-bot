const sessions = {};

function getSession(key) {
  if (!sessions[key]) sessions[key] = {};
  return sessions[key];
}

function clearSession(key) {
  delete sessions[key];
}

module.exports = { getSession, clearSession };
