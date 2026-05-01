const SERVICE = 'hermes-quickstart';

let keytar;
try {
  keytar = require('keytar');
} catch (err) {
  keytar = null;
}

async function set(account, value) {
  if (!keytar) throw new Error('keytar not available — install dependencies and rebuild');
  if (!value) return { ok: false, reason: 'empty value' };
  await keytar.setPassword(SERVICE, account, value);
  return { ok: true };
}

async function get(account) {
  if (!keytar) return null;
  return keytar.getPassword(SERVICE, account);
}

async function remove(account) {
  if (!keytar) return false;
  return keytar.deletePassword(SERVICE, account);
}

module.exports = { set, get, remove, SERVICE };
