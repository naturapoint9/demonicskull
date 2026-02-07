// ============================================
//  DEMONICSKULL.COM - Web Server
//  "I am Murray! The all-powerful demonic server!"
// ============================================

const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;

const GUESTBOOK_HTML = path.join(__dirname, 'guestbook.html');
const INDEX_HTML = path.join(__dirname, 'index.html');
const ENTRIES_PER_PAGE = 10;

// --- Writable data directory (Vercel uses a read-only FS, /tmp is writable) ---
const IS_VERCEL = !!process.env.VERCEL;
const DATA_DIR = IS_VERCEL ? '/tmp' : __dirname;
const ENTRIES_FILE = path.join(DATA_DIR, 'guestbook-entries.json');
const COUNTER_FILE = path.join(DATA_DIR, 'counter.json');

// On Vercel cold start, copy seed data to /tmp if not already there
if (IS_VERCEL) {
  if (!fs.existsSync(ENTRIES_FILE)) {
    const seed = path.join(__dirname, 'guestbook-entries.json');
    if (fs.existsSync(seed)) {
      fs.copyFileSync(seed, ENTRIES_FILE);
    }
  }
  if (!fs.existsSync(COUNTER_FILE)) {
    const seed = path.join(__dirname, 'counter.json');
    if (fs.existsSync(seed)) {
      fs.copyFileSync(seed, COUNTER_FILE);
    }
  }
}

// ============================================
//  56K MODEM SIMULATOR
//  "Please wait while the page loads..."
//  *beeee brrrrr kssshhhh bong bong bong*
// ============================================
// Modem mode disabled on Vercel (serverless functions have a 10s timeout, can't stream slowly)
const MODEM_MODE = !IS_VERCEL && process.env.MODEM_MODE !== 'false';
const MODEM_BPS = 56000;                                // 56kbps modem (just like 1999)
const MODEM_BYTES_PER_SEC = Math.floor(MODEM_BPS / 8);  // ~7000 bytes/sec
const MODEM_LATENCY = 120;                               // 120ms initial latency per request
const CHUNK_INTERVAL = 50;                               // Drip a chunk every 50ms
const CHUNK_SIZE = Math.floor(MODEM_BYTES_PER_SEC * CHUNK_INTERVAL / 1000); // ~350 bytes per drip

function modemThrottle(req, res, next) {
  if (!MODEM_MODE) return next();

  // Allow ?turbo=1 to bypass throttling (for the webmaster)
  if (req.query.turbo === '1') return next();

  // Don't throttle redirects (POST-redirect-GET)
  const originalRedirect = res.redirect.bind(res);
  res.redirect = function() {
    // Restore original methods before redirecting
    res.write = originalWrite;
    res.end = originalEnd;
    return originalRedirect.apply(this, arguments);
  };

  const chunks = [];
  const originalWrite = res.write;
  const originalEnd = res.end;

  res.write = function(chunk, encoding) {
    if (chunk) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding || 'utf8'));
    }
    return true;
  };

  res.end = function(chunk, encoding) {
    if (chunk && chunk.length > 0) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding || 'utf8'));
    }

    const body = Buffer.concat(chunks);

    // Nothing to throttle
    if (body.length === 0) {
      return originalEnd.call(res);
    }

    // Simulate modem latency, then start dripping bytes
    let offset = 0;
    const drip = function() {
      const end = Math.min(offset + CHUNK_SIZE, body.length);
      originalWrite.call(res, body.slice(offset, end));
      offset = end;
      if (offset >= body.length) {
        originalEnd.call(res);
      } else {
        setTimeout(drip, CHUNK_INTERVAL);
      }
    };

    setTimeout(drip, MODEM_LATENCY);
  };

  next();
}

// Apply the modem throttle to ALL requests (the authentic experience)
app.use(modemThrottle);

// Cache control for modem mode: HTML pages always re-download,
// but images/CSS/static assets cache normally (like a real 90s browser)
if (MODEM_MODE) {
  app.use(function(req, res, next) {
    var url = req.url.split('?')[0];
    if (url === '/' || url.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
    next();
  });
}

// Parse form submissions (URL-encoded, the 1999 way)
app.use(express.urlencoded({ extended: false }));

// --- Helper: read entries from JSON file ---
function readEntries() {
  try {
    const data = fs.readFileSync(ENTRIES_FILE, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    return [];
  }
}

// --- Helper: write entries to JSON file ---
function writeEntries(entries) {
  fs.writeFileSync(ENTRIES_FILE, JSON.stringify(entries, null, 2), 'utf8');
}

// --- Helper: escape HTML to prevent XSS ---
function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// --- Helper: format a date the 90s way ---
function formatDate(date) {
  const d = new Date(date);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const year = d.getFullYear();
  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `${month}/${day}/${year} - ${hours}:${minutes} ${ampm}`;
}

// --- Helper: resolve the favorite game label ---
function favoriteLabel(value) {
  const map = {
    'somi': 'The Secret of Monkey Island',
    'mi2': 'Monkey Island 2: LeChuck\'s Revenge',
    'comi': 'The Curse of Monkey Island'
  };
  return map[value] || value || '';
}

// --- Helper: render a single guestbook entry as HTML ---
function renderEntry(entry) {
  const nameHtml = entry.url
    ? `<a href="${escapeHtml(entry.url)}">${escapeHtml(entry.name)}</a>`
    : escapeHtml(entry.name);

  const favHtml = entry.favorite
    ? `<br><span style="font-size: 10px; color: #888;">Favorite game: ${escapeHtml(entry.favorite)}</span>`
    : '';

  return `  <div class="gb-entry">
    <span class="gb-date">${escapeHtml(entry.date)}</span>
    <span class="gb-name">${nameHtml}</span>
    <div class="gb-message">
      ${escapeHtml(entry.message)}${favHtml}
    </div>
  </div>\n`;
}

// --- Helper: render pagination links ---
function renderPagination(totalEntries, currentPage) {
  const totalPages = Math.ceil(totalEntries / ENTRIES_PER_PAGE);
  if (totalPages <= 1) return '';

  const start = (currentPage - 1) * ENTRIES_PER_PAGE + 1;
  const end = Math.min(currentPage * ENTRIES_PER_PAGE, totalEntries);

  let html = `  <p style="text-align: center;">\n`;
  html += `    Showing entries ${start}-${end} of ${totalEntries} | `;

  for (let i = 1; i <= totalPages; i++) {
    if (i === currentPage) {
      html += `<b>Page ${i}</b> `;
    } else {
      html += `<a href="/guestbook.html?page=${i}">${i}</a> `;
    }
    if (i < totalPages) html += '| ';
  }

  if (currentPage < totalPages) {
    html += `| <a href="/guestbook.html?page=${currentPage + 1}">Next &raquo;</a>`;
  }

  html += `\n  </p>`;
  return html;
}

// --- Helper: read the visitor counter ---
function readCounter() {
  try {
    const data = fs.readFileSync(COUNTER_FILE, 'utf8');
    return JSON.parse(data).count || 0;
  } catch (err) {
    return 0;
  }
}

// --- Helper: increment and save the visitor counter ---
function incrementCounter() {
  const count = readCounter() + 1;
  fs.writeFileSync(COUNTER_FILE, JSON.stringify({ count: count }), 'utf8');
  return count;
}

// --- Helper: pad counter to 7 digits (classic hit counter style) ---
function formatCounter(count) {
  return String(count).padStart(7, '0');
}

// --- GET / and /index.html - Serve homepage with live visitor counter ---
app.get(['/', '/index.html'], (req, res) => {
  const count = incrementCounter();
  let html = fs.readFileSync(INDEX_HTML, 'utf8');
  html = html.replace('<!-- VISITOR_COUNT -->', formatCounter(count));
  res.send(html);
});

// --- GET /guestbook.html - Serve guestbook with dynamic entries ---
app.get('/guestbook.html', (req, res) => {
  const entries = readEntries();
  const totalEntries = entries.length;
  const totalPages = Math.ceil(totalEntries / ENTRIES_PER_PAGE) || 1;

  let page = parseInt(req.query.page) || 1;
  if (page < 1) page = 1;
  if (page > totalPages) page = totalPages;

  // Entries are stored oldest-first; show newest-first
  const reversed = [...entries].reverse();
  const start = (page - 1) * ENTRIES_PER_PAGE;
  const pageEntries = reversed.slice(start, start + ENTRIES_PER_PAGE);

  // Build entries HTML
  let entriesHtml = '';
  for (const entry of pageEntries) {
    entriesHtml += renderEntry(entry);
  }

  // Build pagination
  const paginationTop = `  <p>\n    Total entries: <b style="color:#cc7733;">${totalEntries}</b> |\n    Page: <b style="color:#cc7733;">${page}</b> of <b style="color:#cc7733;">${totalPages}</b>` +
    (page < totalPages ? ` |\n    <a href="/guestbook.html?page=${page + 1}">Next Page &raquo;</a>` : '') +
    `\n  </p>`;

  const paginationBottom = renderPagination(totalEntries, page);

  // Read the HTML template and inject dynamic content
  let html = fs.readFileSync(GUESTBOOK_HTML, 'utf8');
  html = html.replace('<!-- GUESTBOOK_PAGINATION_TOP -->', paginationTop);
  html = html.replace('<!-- GUESTBOOK_ENTRIES -->', entriesHtml);
  html = html.replace('<!-- GUESTBOOK_PAGINATION_BOTTOM -->', paginationBottom);

  res.send(html);
});

// --- POST /sign-guestbook - Handle form submission ---
app.post('/sign-guestbook', (req, res) => {
  const name = (req.body.name || '').trim();
  const message = (req.body.message || '').trim();
  const url = (req.body.url || '').trim();
  const favorite = req.body.favorite || '';

  // Validate required fields
  if (!name || !message) {
    res.status(400).send(
      '<html><body style="background:#000;color:#dd5500;font-family:Comic Sans MS,Verdana;text-align:center;padding:40px;">' +
      '<h2>Arrr! Something went wrong!</h2>' +
      '<p style="color:#ccc;">You must provide both a name and a message, ye scurvy dog!</p>' +
      '<p><a href="/guestbook.html" style="color:#6677cc;">Back to the Guestbook</a></p>' +
      '</body></html>'
    );
    return;
  }

  // Validate name and message length
  if (name.length > 50 || message.length > 1000) {
    res.status(400).send(
      '<html><body style="background:#000;color:#dd5500;font-family:Comic Sans MS,Verdana;text-align:center;padding:40px;">' +
      '<h2>Arrr! Too many words!</h2>' +
      '<p style="color:#ccc;">Keep your name under 50 characters and your message under 1000, matey!</p>' +
      '<p><a href="/guestbook.html" style="color:#6677cc;">Back to the Guestbook</a></p>' +
      '</body></html>'
    );
    return;
  }

  // Clean up URL
  let cleanUrl = '';
  if (url && url !== 'http://' && url !== 'https://') {
    cleanUrl = url;
  }

  const entry = {
    name: name,
    url: cleanUrl,
    message: message,
    favorite: favoriteLabel(favorite),
    date: formatDate(new Date())
  };

  const entries = readEntries();
  entries.push(entry);
  writeEntries(entries);

  // Redirect back to guestbook (POST-redirect-GET pattern, very proper)
  res.redirect('/guestbook.html');
});

// --- Serve all other static files ---
app.use(express.static(__dirname));

// --- Start the server (local dev only, Vercel uses the export) ---
if (!IS_VERCEL) {
  app.listen(PORT, () => {
    console.log('');
    console.log('  =============================================');
    console.log('   DEMONICSKULL.COM is now running!');
    console.log('   "I am Murray! The all-powerful demonic server!"');
    console.log('  =============================================');
    console.log('');
    console.log(`  Visit: http://localhost:${PORT}`);
    console.log('');
    if (MODEM_MODE) {
      console.log('  [56K MODEM MODE: ON]');
      console.log('  All responses throttled to 56kbps (~7 KB/s)');
      console.log('  Visitors will experience authentic 1999 load times!');
      console.log('  Tip: Add ?turbo=1 to any URL to bypass throttling');
      console.log('  Tip: Set MODEM_MODE=false to disable globally');
      console.log('');
    }
  });
}

// Export for Vercel serverless
module.exports = app;
