const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { convertForPayPal } = require('../server/services/currencyConversion');

test('converts JMD booking totals to USD before constructing PayPal payments', () => {
  const oldRate = process.env.PAYPAL_JMD_PER_USD;
  process.env.PAYPAL_JMD_PER_USD = '160';
  try {
    assert.deepEqual(convertForPayPal(600, 'JMD'), {
      sourceAmount: 600,
      sourceCurrency: 'JMD',
      usdAmount: 3.75,
      jmdPerUsd: 160
    });
  } finally {
    if (oldRate === undefined) delete process.env.PAYPAL_JMD_PER_USD;
    else process.env.PAYPAL_JMD_PER_USD = oldRate;
  }
});

test('leaves existing USD prices unchanged', () => {
  assert.equal(convertForPayPal(12.5, 'USD').usdAmount, 12.5);
});

test('completed booking status sends the fulfilled email once per transition', () => {
  const route = fs.readFileSync(path.join(__dirname, '../server/routes/v1/bookings.js'), 'utf8');
  assert.match(route, /status === 'completed' && previousStatus !== 'completed'/);
  assert.match(route, /sendBookingCompletedEmail\(result, req\.tenant\)/);
});
