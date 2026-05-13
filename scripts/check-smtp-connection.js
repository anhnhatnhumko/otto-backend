'use strict';

// Simple connectivity check to SMTP hosts via TCP
// Usage: node scripts/check-smtp-connection.js

const net = require('net');
const hosts = [
  { host: process.env.SMTP_TEST_HOST || 'smtp.gmail.com', port: Number(process.env.SMTP_TEST_PORT) || 587, name: 'Gmail SMTP' },
  { host: process.env.SENDGRID_TEST_HOST || 'smtp.sendgrid.net', port: Number(process.env.SENDGRID_TEST_PORT) || 587, name: 'SendGrid SMTP' }
];
const TIMEOUT = Number(process.env.SMTP_TEST_TIMEOUT) || 8000;

function testConn({host, port, name}) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let resolved = false;

    const onError = (err) => {
      if (resolved) return;
      resolved = true;
      console.log(`[${name}] ${host}:${port} -> ERROR: ${err.message}`);
      socket.destroy();
      resolve({ host, port, ok: false, error: err.message });
    };

    socket.setTimeout(TIMEOUT, () => onError(new Error('Connection timeout')));
    socket.once('error', onError);

    socket.connect(port, host, () => {
      if (resolved) return;
      resolved = true;
      console.log(`[${name}] ${host}:${port} -> CONNECTED`);
      socket.end();
      resolve({ host, port, ok: true });
    });
  });
}

(async () => {
  console.log('SMTP connectivity test — timeout:', TIMEOUT, 'ms');
  for (const h of hosts) {
    try {
      // eslint-disable-next-line no-await-in-loop
      await testConn(h);
    } catch (err) {
      console.error('Unexpected error:', err && err.stack ? err.stack : err);
    }
  }
  console.log('Done.');
})();
