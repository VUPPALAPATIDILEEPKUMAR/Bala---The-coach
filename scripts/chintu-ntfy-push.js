// chintu-ntfy-push.js
// C47: ntfy.sh Level 3 alert push
//
// DRY-RUN by default — no network call without explicit env vars.
// LIVE only when ALL of these are set:
//   CHINTU_CONNECTOR_APPROVAL_PHRASE=go
//   CHINTU_NTFY_TOPIC=<your-topic>
//
// SAFETY INVARIANTS (permanent):
//   - No health values in notification body (no score, no HRV, no symptoms)
//   - Dry-run exits 0 and prints JSON — no network call made
//   - Topic is NEVER logged, stored in files, or committed
//   - Sends to ntfy.sh/<topic> only — no other endpoints
//   - Request times out after 8 seconds

'use strict';
const https = require('https');

const APPROVAL = process.env.CHINTU_CONNECTOR_APPROVAL_PHRASE || '';
const TOPIC    = process.env.CHINTU_NTFY_TOPIC || '';
const DRY_RUN  = (APPROVAL !== 'go') || !TOPIC;

// Safe message — no health data values, no score numbers, no symptoms
const TITLE   = 'Chintu OS';
const MESSAGE = 'Chintu check-in ready. Open your BALA guide when you have a moment.';
const PRIORITY = 3; // ntfy priority: 1=min 2=low 3=default 4=high 5=urgent

function exit(code, result) {
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  process.exit(code);
}

if (DRY_RUN) {
  exit(0, {
    mode:    'dry-run',
    topic:   TOPIC || '(not set)',
    title:   TITLE,
    message: MESSAGE,
    priority: PRIORITY,
    sent:    false,
    reason:  !TOPIC
      ? 'CHINTU_NTFY_TOPIC not set. Set it to your ntfy.sh topic name.'
      : 'CHINTU_CONNECTOR_APPROVAL_PHRASE is not "go". Set it to enable live push.'
  });
}

// Live push
const body = JSON.stringify({ topic: TOPIC, title: TITLE, message: MESSAGE, priority: PRIORITY });
const req  = https.request(
  {
    hostname: 'ntfy.sh',
    path:     '/',
    method:   'POST',
    headers:  {
      'Content-Type':   'application/json',
      'Content-Length': Buffer.byteLength(body)
    }
  },
  (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
      const ok = res.statusCode >= 200 && res.statusCode < 300;
      exit(ok ? 0 : 1, {
        mode:         'live',
        topic:        TOPIC,
        title:        TITLE,
        message:      MESSAGE,
        priority:     PRIORITY,
        sent:         ok,
        httpStatus:   res.statusCode,
        responseBody: data.trim().slice(0, 200)
      });
    });
  }
);

req.on('error', (e) => {
  exit(1, { mode: 'live', topic: TOPIC, sent: false, error: e.message });
});

req.setTimeout(8000, () => {
  req.destroy();
  exit(1, { mode: 'live', topic: TOPIC, sent: false, error: 'timeout after 8000ms' });
});

req.write(body);
req.end();
