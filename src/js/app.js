import hljs from 'highlight.js/lib/core';
import prolog from 'highlight.js/lib/languages/prolog';
import 'highlight.js/styles/github.css';

hljs.registerLanguage('prolog', prolog);

// Each lap replays the generator from the seed, so huge laps would freeze the tab.
const MAX_LAP = 10000;

let swipl = null;
let prologCode = '';

async function init() {
  const statusEl = document.getElementById('status');
  const generateBtn = document.getElementById('generate');
  
  statusEl.textContent = 'Loading SWI-Prolog WASM...';
  statusEl.className = 'loading';
  
  try {
    // SWIPL is loaded via script tag as global
    swipl = await SWIPL({ arguments: ['-q'] });
    
    // Load Prolog code
    const response = await fetch(`${import.meta.env.BASE_URL}feedback_ring.pl`);
    if (!response.ok) {
      throw new Error(`Failed to load Prolog source (${response.status})`);
    }
    prologCode = await response.text();
    
    // Write code to virtual filesystem and consult
    swipl.FS.writeFile('/feedback_ring.pl', prologCode);
    const consulted = swipl.prolog.call("consult('/feedback_ring.pl')");
    
    if (!consulted) {
      throw new Error('Failed to consult Prolog code');
    }
    
    statusEl.textContent = '';
    statusEl.className = '';
    generateBtn.disabled = false;
    
    const codeEl = document.getElementById('prolog-code');
    codeEl.textContent = prologCode;
    hljs.highlightElement(codeEl);
    
  } catch (err) {
    statusEl.textContent = 'Failed to load: ' + err.message;
    statusEl.className = 'error';
    console.error(err);
  }
}

function parseNames(input) {
  return input
    .split(/[,\n]/)
    .map(s => s.trim().toLowerCase().replace(/[^a-z0-9_]/g, ''))
    .filter(s => s.length > 0 && /^[a-z]/.test(s));
}

function formatRing(ring) {
  if (!ring || ring.length === 0) return '';
  const pairs = [];
  for (let i = 0; i < ring.length; i++) {
    const giver = ring[i];
    const receiver = ring[(i + 1) % ring.length];
    pairs.push(`${giver} -> ${receiver}`);
  }
  return pairs.join('\n');
}

function ringGoal() {
  const seedText = document.getElementById('seed').value.trim();
  const lapText = document.getElementById('lap').value.trim();

  if (seedText === '') {
    if (lapText !== '') {
      return { error: 'Lap requires a seed.' };
    }
    return { goal: 'random_feedback_ring(R)' };
  }
  if (!/^\d+$/.test(seedText)) {
    return { error: 'Seed must be a non-negative integer.' };
  }
  if (lapText === '') {
    return { goal: `seeded_random_feedback_ring(${seedText}, R)` };
  }

  const lap = /^\d+$/.test(lapText) ? Number(lapText) : NaN;
  if (!Number.isInteger(lap) || lap < 1 || lap > MAX_LAP) {
    return { error: `Lap must be an integer from 1 to ${MAX_LAP}.` };
  }
  return { goal: `seeded_random_feedback_ring(${seedText}, ${lap}, R)` };
}

function generate() {
  const output = document.getElementById('output');
  const input = document.getElementById('names').value;
  const names = parseNames(input);
  const { goal, error } = ringGoal();
  
  if (names.length < 2) {
    output.textContent = 'Need at least 2 names.';
    output.className = 'output error';
    return;
  }

  if (error) {
    output.textContent = error;
    output.className = 'output error';
    return;
  }
  
  output.className = 'output';
  
  try {
    // Clear old team
    swipl.prolog.call('retractall(team_member(_))');
    
    // Assert new team members
    for (const name of names) {
      swipl.prolog.call(`assertz(team_member(${name}))`);
    }
    
    // Query for random ring, seeded (and optionally lapped) when fields are filled
    const query = swipl.prolog.query(goal);
    const result = query.next();
    query.close();
    
    if (result && result.value && result.value.R) {
      // R is already an array of strings
      const ring = result.value.R;
      output.textContent = formatRing(ring);
    } else {
      output.textContent = 'No valid ring found. All pair combinations may be exhausted.';
    }
    
  } catch (err) {
    output.textContent = 'Error: ' + err.message;
    output.className = 'output error';
    console.error(err);
  }
}

function setupReveals() {
  for (const button of document.querySelectorAll('.reveal')) {
    button.addEventListener('click', () => {
      const content = document.getElementById(button.getAttribute('aria-controls'));
      content.hidden = false;
      button.remove();
      content.focus();
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  init();
  setupReveals();
  document.getElementById('generate').addEventListener('click', generate);
});
