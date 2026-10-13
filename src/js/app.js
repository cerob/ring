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
    const response = await fetch('/feedback_ring.pl');
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
    
    // Show code in details
    document.getElementById('prolog-code').textContent = prologCode;
    
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

function generate() {
  const output = document.getElementById('output');
  const input = document.getElementById('names').value;
  const names = parseNames(input);
  
  if (names.length < 2) {
    output.textContent = 'Need at least 2 names.';
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
    
    // Query for random ring
    const query = swipl.prolog.query('random_feedback_ring(R)');
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

document.addEventListener('DOMContentLoaded', () => {
  init();
  document.getElementById('generate').addEventListener('click', generate);
});
