const { createHmac, timingSafeEqual } = require('node:crypto');
function sign(value, key) {
  const data = Buffer.from(JSON.stringify({ ...value, expires: Date.now() + 15 * 60_000 })).toString('base64url');
  return data + '.' + createHmac('sha256', key).update(data).digest('base64url');
}
function verify(ticket, key) {
  if (typeof ticket !== 'string' || ticket.length > 6000) throw Error('Invalid ticket');
  const [data, sig] = ticket.split('.');
  const expected = createHmac('sha256', key).update(data || '').digest();
  const actual = Buffer.from(sig || '', 'base64url');
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw Error('Invalid ticket');
  const value = JSON.parse(Buffer.from(data, 'base64url').toString());
  if (!(value.expires > Date.now())) throw Error('Expired ticket');
  return value;
}
module.exports = { sign, verify };
