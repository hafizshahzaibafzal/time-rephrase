/* ============================================
   TimeRephrase — app.js
   Time Summarization & Human-Like Rephrasing
   ============================================ */

// ─── State ────────────────────────────────────────────────────────────────────
const state = {
  currentSummarizeMode: 'quick',
  currentRephraseMode: 'casual',
  history: [],
  totalProcessed: 0,
  totalChars: 0,
  totalSaved: 0,
};

// ─── Tab Switching ─────────────────────────────────────────────────────────────
function switchTab(tab, el) {
  // Deactivate all panels + links
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
  // Activate target
  document.getElementById(`tab-${tab}`).classList.add('active');
  if (el) el.classList.add('active');
  // Refresh history view
  if (tab === 'history') renderHistory();
}

// ─── Mode Toggle ───────────────────────────────────────────────────────────────
function setMode(tool, mode, btn) {
  if (tool === 'summarize') state.currentSummarizeMode = mode;
  else state.currentRephraseMode = mode;
  btn.closest('.mode-toggle').querySelectorAll('.mode-btn')
     .forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

// ─── Char Count ────────────────────────────────────────────────────────────────
function updateCharCount(tool) {
  const val = document.getElementById(`${tool}-input`).value;
  document.getElementById(`${tool}-char-count`).textContent = `${val.length} chars`;
}

// ─── Clear Field ───────────────────────────────────────────────────────────────
function clearField(id) {
  document.getElementById(id).value = '';
  if (id === 'summarize-input') updateCharCount('summarize');
  if (id === 'rephrase-input') updateCharCount('rephrase');
}

// ─── Examples ─────────────────────────────────────────────────────────────────
const EXAMPLES = {
  summarize: `The project kickoff meeting lasted 2 hours and 45 minutes, during which the team discussed roadmap and sprint planning. After a 30-minute lunch break, development work began at 1:00 PM. Task A took 1 hour 20 minutes, Task B was completed in 45 minutes, and Task C required 2 hours 5 minutes. The team had a 15-minute standup at 4:30 PM. In total, the project has been running for 3 months and 12 days, with approximately 420 hours of logged engineering time across all contributors.`,

  rephrase: `Duration: 02:45:30\nStart timestamp: 1970-01-01T09:00:00Z\nUser session lasted 3600 seconds. Idle timeout: 1800s. ETA: T+72h. Deployment window: 15:00-17:00 UTC+5. Build duration: PT4H32M. Next review scheduled: +P14D from now. Estimated TTL: 86400 seconds.`,
};

function loadExample(tool) {
  const el = document.getElementById(`${tool}-input`);
  el.value = EXAMPLES[tool];
  updateCharCount(tool);
  showToast('Example loaded');
}

// ─── API Call ──────────────────────────────────────────────────────────────────
async function callClaude(systemPrompt, userPrompt) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });
  if (!response.ok) throw new Error(`API error: ${response.status}`);
  const data = await response.json();
  return data.content.map(b => b.text || '').join('');
}

// ─── Show Loading ──────────────────────────────────────────────────────────────
function showLoading(elId, msg = 'Analyzing...') {
  document.getElementById(elId).innerHTML = `
    <div class="loading-spinner">
      <div class="spinner"></div>
      <span class="spinner-text">${msg}</span>
    </div>`;
}

// ─── Render Output ─────────────────────────────────────────────────────────────
function renderOutput(elId, html) {
  document.getElementById(elId).innerHTML = `<div class="output-result">${html}</div>`;
}

// ─── SUMMARIZE ─────────────────────────────────────────────────────────────────
async function runSummarize() {
  const input = document.getElementById('summarize-input').value.trim();
  if (!input) { showToast('Please enter some text to summarize'); return; }

  const mode = state.currentSummarizeMode;
  const includeBreakdown = document.getElementById('sum-include-breakdown').checked;
  const showTotals = document.getElementById('sum-show-totals').checked;
  const humanTone = document.getElementById('sum-human-tone').checked;

  const btn = document.querySelector('#tab-summarize .btn-primary');
  btn.classList.add('loading');
  btn.textContent = '⧖ Analyzing...';

  showLoading('summarize-output', 'Processing time data...');

  const modeInstructions = {
    quick: 'Give a concise, punchy summary in 2–4 sentences.',
    detailed: 'Give a thorough, structured breakdown with headings for different time aspects.',
    narrative: 'Write a flowing narrative paragraph as if telling a story about the time periods involved.',
  };

  const systemPrompt = `You are a time summarization expert. Your job is to analyze text containing time expressions, durations, timestamps, and time-related data, then produce a clear, intelligent summary.

Rules:
- Extract all time values (durations, timestamps, periods, countdowns)
- Calculate totals where relevant
- ${modeInstructions[mode]}
- ${includeBreakdown ? 'Include a breakdown of individual time components.' : 'Do not include a detailed breakdown.'}
- ${showTotals ? 'Always show total/aggregate time.' : ''}
- ${humanTone ? 'Use a warm, conversational tone — like explaining to a friend.' : 'Use a clear, professional tone.'}
- Format your response as HTML using <p>, <ul>, <li> tags. Use <span class="highlight">value</span> to highlight key numbers. Use <span class="section-label">Label</span> for section headings. Use <div class="total-box">Total: ...</div> for aggregate totals.
- Be accurate with time arithmetic.`;

  try {
    const text = await callClaude(systemPrompt, `Summarize the time information in this text:\n\n${input}`);
    renderOutput('summarize-output', text);

    // Show meta tags
    document.getElementById('summarize-meta').style.display = 'flex';
    document.getElementById('summarize-time-range').textContent = `Mode: ${mode}`;
    document.getElementById('summarize-total').textContent = `${input.length} chars → summarized`;
    document.getElementById('summarize-reduction').textContent = `${Math.round((1 - text.length / input.length) * 100)}% reduction`;

    updateStats(input.length);
    showToast('Summary complete!');
  } catch (err) {
    renderOutput('summarize-output', `<p style="color:var(--rust)">Error: ${err.message}</p>`);
    showToast('API error — check console');
  } finally {
    btn.classList.remove('loading');
    btn.innerHTML = '<span class="btn-icon">⧖</span> Summarize Time';
  }
}

// ─── REPHRASE ──────────────────────────────────────────────────────────────────
async function runRephrase() {
  const input = document.getElementById('rephrase-input').value.trim();
  if (!input) { showToast('Please enter text to rephrase'); return; }

  const mode = state.currentRephraseMode;
  const showVariants = document.getElementById('reph-show-variants').checked;
  const keepContext = document.getElementById('reph-keep-context').checked;
  const addEmotion = document.getElementById('reph-add-emotion').checked;

  const btn = document.querySelector('#tab-rephrase .btn-primary');
  btn.classList.add('loading');
  btn.textContent = '✦ Rephrasing...';

  showLoading('rephrase-output', 'Humanizing text...');

  const modeInstructions = {
    casual: 'Rephrase in a casual, everyday conversational style as if talking to a friend.',
    formal: 'Rephrase in a polished, professional, formal tone suitable for business reports.',
    storytelling: 'Rephrase in an engaging storytelling style — vivid, evocative, narrative.',
  };

  const systemPrompt = `You are a linguistic expert specializing in transforming robotic, technical, or machine-generated time expressions into natural, human-readable language.

Rules:
- Convert all timestamps (ISO, Unix, UTC offsets) to natural language
- Convert all duration codes (HH:MM:SS, PT4H30M, 86400s, T+72h) to human phrases
- ${modeInstructions[mode]}
- ${keepContext ? 'Preserve the full meaning and context of the original.' : 'Focus on the time expressions only.'}
- ${addEmotion ? 'Add subtle emotional coloring where appropriate (e.g., "a long grueling day", "just a quick moment").' : ''}
- ${showVariants ? 'After the main rephrasing, provide 2–3 alternate phrasings separated by the delimiter "---VARIANTS---", each on its own line starting with "• ".' : ''}
- Format your main output as HTML using <p> and <strong> for emphasis. Do not use markdown.
- Be creative and natural — avoid sounding like a robot.`;

  try {
    const raw = await callClaude(systemPrompt, `Rephrase this text into natural, human-readable language:\n\n${input}`);

    // Split variants if present
    const parts = raw.split('---VARIANTS---');
    const mainText = parts[0].trim();
    const variantsText = parts[1] ? parts[1].trim() : null;

    renderOutput('rephrase-output', mainText);

    // Variants
    const variantsEl = document.getElementById('rephrase-variants');
    const variantsList = document.getElementById('variants-list');
    if (showVariants && variantsText) {
      const variants = variantsText.split('\n').filter(l => l.trim().startsWith('•'));
      variantsList.innerHTML = variants.map(v =>
        `<div class="variant-item" onclick="useVariant(this)">${v.replace('•','').trim()}</div>`
      ).join('');
      variantsEl.style.display = variants.length ? 'block' : 'none';
    } else {
      variantsEl.style.display = 'none';
    }

    updateStats(input.length);
    showToast('Rephrasing complete!');
  } catch (err) {
    renderOutput('rephrase-output', `<p style="color:var(--rust)">Error: ${err.message}</p>`);
    showToast('API error — check console');
  } finally {
    btn.classList.remove('loading');
    btn.innerHTML = '<span class="btn-icon">✦</span> Rephrase Humanly';
  }
}

// Use a variant by clicking it
function useVariant(el) {
  const text = el.textContent;
  document.getElementById('rephrase-output').innerHTML =
    `<div class="output-result"><p>${text}</p></div>`;
  showToast('Variant selected');
}

// ─── COPY OUTPUT ───────────────────────────────────────────────────────────────
function copyOutput(elId) {
  const el = document.getElementById(elId);
  const text = el.innerText;
  if (!text || el.querySelector('.output-placeholder')) {
    showToast('Nothing to copy yet'); return;
  }
  navigator.clipboard.writeText(text).then(() => showToast('Copied to clipboard!'));
}

// ─── SAVE TO HISTORY ───────────────────────────────────────────────────────────
function saveToHistory(tool) {
  const outputEl = document.getElementById(`${tool}-output`);
  if (outputEl.querySelector('.output-placeholder') || outputEl.querySelector('.loading-spinner')) {
    showToast('Run a ' + tool + ' first'); return;
  }
  const content = outputEl.innerText.trim();
  if (!content) { showToast('Nothing to save'); return; }

  state.history.unshift({
    id: Date.now(),
    type: tool === 'summarize' ? 'sum' : 'rep',
    label: tool === 'summarize' ? 'Summarization' : 'Rephrasing',
    content,
    time: new Date().toLocaleTimeString(),
  });
  state.totalSaved++;
  updateStatDisplay();
  showToast('Saved to history ★');
}

// ─── RENDER HISTORY ────────────────────────────────────────────────────────────
function renderHistory() {
  const el = document.getElementById('history-list');
  if (!state.history.length) {
    el.innerHTML = `<div class="empty-history"><div class="empty-icon">◌</div><p>No history yet. Summarize or rephrase something and save it with ★</p></div>`;
    return;
  }
  el.innerHTML = state.history.map(item => `
    <div class="history-card" data-id="${item.id}">
      <div class="history-card-header">
        <span class="history-type ${item.type}">${item.label}</span>
        <span class="history-time">${item.time}</span>
      </div>
      <div class="history-content">${item.content.slice(0, 400)}${item.content.length > 400 ? '...' : ''}</div>
      <div class="history-actions">
        <button class="btn-ghost" onclick="copyHistoryItem(${item.id})">Copy</button>
        <button class="btn-ghost" onclick="deleteHistoryItem(${item.id})">Delete</button>
      </div>
    </div>
  `).join('');
}

function copyHistoryItem(id) {
  const item = state.history.find(h => h.id === id);
  if (item) navigator.clipboard.writeText(item.content).then(() => showToast('Copied!'));
}

function deleteHistoryItem(id) {
  state.history = state.history.filter(h => h.id !== id);
  state.totalSaved = Math.max(0, state.totalSaved - 1);
  updateStatDisplay();
  renderHistory();
  showToast('Deleted');
}

function clearHistory() {
  state.history = [];
  state.totalSaved = 0;
  updateStatDisplay();
  renderHistory();
  showToast('History cleared');
}

// ─── LIVE CALCULATOR ───────────────────────────────────────────────────────────
function liveCalc() {
  const input = document.getElementById('calc-input').value.trim();
  const result = document.getElementById('calc-result');
  if (!input) { result.textContent = '—'; return; }

  try {
    const totalMins = parseTimeExpression(input);
    if (totalMins === null) { result.textContent = '?'; return; }
    result.textContent = formatDuration(totalMins);
  } catch {
    result.textContent = '?';
  }
}

// Parse expressions like "1h 30m + 45m + 2h 15m"
function parseTimeExpression(expr) {
  let total = 0;
  const parts = expr.split(/[+,]/).map(s => s.trim());
  for (const part of parts) {
    const mins = parseToMinutes(part);
    if (mins === null) return null;
    total += mins;
  }
  return total;
}

function parseToMinutes(str) {
  str = str.toLowerCase().trim();
  let mins = 0;
  // HH:MM:SS or HH:MM
  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(str)) {
    const p = str.split(':').map(Number);
    if (p.length === 3) mins = p[0]*60 + p[1] + p[2]/60;
    else mins = p[0]*60 + p[1];
    return mins;
  }
  // hours + minutes
  const h = str.match(/(\d+(?:\.\d+)?)\s*h(?:r|our|rs|ours)?/);
  const m = str.match(/(\d+(?:\.\d+)?)\s*m(?:in|ins|inutes?)?(?!s)/);
  const s = str.match(/(\d+(?:\.\d+)?)\s*s(?:ec|ecs|econds?)?/);
  if (h) mins += parseFloat(h[1]) * 60;
  if (m) mins += parseFloat(m[1]);
  if (s) mins += parseFloat(s[1]) / 60;
  if (!h && !m && !s) {
    // bare number = minutes
    const n = parseFloat(str);
    if (!isNaN(n)) mins = n;
    else return null;
  }
  return mins;
}

function formatDuration(totalMins) {
  totalMins = Math.round(totalMins);
  if (totalMins === 0) return '0 min';
  const d = Math.floor(totalMins / 1440);
  const h = Math.floor((totalMins % 1440) / 60);
  const m = totalMins % 60;
  const parts = [];
  if (d) parts.push(`${d}d`);
  if (h) parts.push(`${h}h`);
  if (m) parts.push(`${m}m`);
  return parts.join(' ');
}

// ─── STATS ─────────────────────────────────────────────────────────────────────
function updateStats(charCount) {
  state.totalProcessed++;
  state.totalChars += charCount;
  updateStatDisplay();
}

function updateStatDisplay() {
  const fmt = n => n >= 1000 ? (n/1000).toFixed(1)+'k' : n;
  animateNumber('totalProcessed', state.totalProcessed);
  animateNumber('totalChars', state.totalChars, fmt);
  animateNumber('totalSaved', state.totalSaved);
}

function animateNumber(elId, target, formatter = n => n) {
  const el = document.getElementById(elId);
  const start = parseInt(el.textContent) || 0;
  const diff = target - start;
  if (diff === 0) return;
  const steps = 20;
  let step = 0;
  const interval = setInterval(() => {
    step++;
    const val = Math.round(start + diff * (step / steps));
    el.textContent = formatter(val);
    if (step >= steps) { el.textContent = formatter(target); clearInterval(interval); }
  }, 16);
}

// ─── TOAST ─────────────────────────────────────────────────────────────────────
let toastTimeout;
function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => el.classList.remove('show'), 2500);
}

// ─── INIT ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  updateStatDisplay();
  // Keyboard shortcut: Cmd/Ctrl+Enter to run
  document.addEventListener('keydown', e => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      const active = document.querySelector('.tab-panel.active');
      if (active?.id === 'tab-summarize') runSummarize();
      if (active?.id === 'tab-rephrase') runRephrase();
    }
  });
  // Prevent nav default behavior
  document.querySelectorAll('.nav-link').forEach(l => {
    l.addEventListener('click', e => e.preventDefault());
  });
});
