/* ------------------------------------------------------------------
   0 to Shipped — Resume Parser
   No backend. We accept a PDF, run a short "analysis" animation, then
   report a mock score against the chosen role's skill set.
   ------------------------------------------------------------------ */

/* The skills each role expects. Add or edit freely. */
const ROLES = {
  fullstack: {
    name: 'Full-Stack Developer',
    skills: ['JavaScript', 'TypeScript', 'React', 'Node.js', 'Express', 'SQL',
             'PostgreSQL', 'REST API', 'Git', 'Docker', 'Testing', 'CSS'],
  },
  frontend: {
    name: 'Front-End Developer',
    skills: ['HTML', 'CSS', 'JavaScript', 'TypeScript', 'React', 'Accessibility',
             'Responsive Design', 'Webpack', 'Git', 'Testing'],
  },
  backend: {
    name: 'Back-End Developer',
    skills: ['Node.js', 'Python', 'SQL', 'PostgreSQL', 'MongoDB', 'REST API',
             'Docker', 'Redis', 'Git', 'Testing', 'System Design'],
  },
  data: {
    name: 'Data Engineer',
    skills: ['Python', 'SQL', 'Pandas', 'Airflow', 'Spark', 'ETL', 'PostgreSQL',
             'Docker', 'AWS', 'Git'],
  },
};

const LOADER_STEPS = [
  'Reading PDF…',
  'Extracting text…',
  'Matching skills…',
  'Scoring…',
];

const $ = (id) => document.getElementById(id);
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const dropzone    = $('dropzone');
const fileInput   = $('file-input');
const roleSelect  = $('role-select');
const fileError   = $('file-error');
const results     = $('results');
const loader      = $('loader');
const loaderStep  = $('loader-step');
const progressBar = $('progress-bar');

/* ------------------------------------------------ upload interactions */

dropzone.addEventListener('click', () => fileInput.click());

/* A div that acts like a button needs the keyboard to work too. */
dropzone.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    fileInput.click();
  }
});

fileInput.addEventListener('change', () => {
  if (fileInput.files.length) handleFile(fileInput.files[0]);
});

/* dragover MUST be cancelled, or the browser opens the file instead. */
['dragenter', 'dragover'].forEach((type) => {
  dropzone.addEventListener(type, (e) => {
    e.preventDefault();
    dropzone.classList.add('is-dragging');
  });
});

['dragleave', 'drop'].forEach((type) => {
  dropzone.addEventListener(type, (e) => {
    e.preventDefault();
    dropzone.classList.remove('is-dragging');
  });
});

dropzone.addEventListener('drop', (e) => {
  const file = e.dataTransfer.files[0];
  if (file) handleFile(file);
});

/* ------------------------------------------------------------ the flow */

function handleFile(file) {
  if (!isPdf(file)) {
    showError(`"${file.name}" isn't a PDF. Pick a .pdf file to continue.`);
    return;
  }
  clearError();
  analyzeFile(file);
}

function isPdf(file) {
  return file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
}

function showError(message) {
  fileError.textContent = message;
  fileError.hidden = false;
}

function clearError() {
  fileError.hidden = true;
  fileError.textContent = '';
}

function setProgress(percent, label) {
  progressBar.style.width = percent + '%';
  loaderStep.textContent = label;
}

async function analyzeFile(file) {
  loader.hidden = false;
  setProgress(10, LOADER_STEPS[0]);

  /* The animation is cosmetic — the score itself is computed instantly.
     await wait() is what paces it, so the steps are readable. */
  await wait(450);
  setProgress(40, LOADER_STEPS[1]);
  await wait(450);
  setProgress(70, LOADER_STEPS[2]);
  await wait(450);
  setProgress(100, LOADER_STEPS[3]);
  await wait(350);

  loader.hidden = true;
  renderReport(file, mockReport(file, roleSelect.value));
}

/* ------------------------------------------------------- mock analysis */

/* FNV-1a. Small, fast, and always gives the same number for the same text. */
function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/*
  Seeded by the file's name + size, so the SAME resume always earns the
  SAME score. If this were Math.random(), a second upload would show a
  different number and look like a bug.
*/
function mockReport(file, roleKey) {
  const role = ROLES[roleKey];
  const seed = hashString(file.name + ':' + file.size);

  /* Aim for roughly 45-85% of the skills being present. */
  const target = Math.round(role.skills.length * (0.45 + ((seed % 41) / 100)));

  /* Walk the list with a seed-driven stride, so it isn't always the
     first N skills — any skill can land on either side. */
  const picked = [];
  const seen = new Set();
  const stride = 1 + (seed % 3);
  let i = seed % role.skills.length;

  while (picked.length < target && seen.size < role.skills.length) {
    if (!seen.has(i)) {
      seen.add(i);
      if ((hashString(seed + ':' + i) % 100) < 82) picked.push(role.skills[i]);
    }
    i = (i + stride) % role.skills.length;
  }

  const found = picked;
  const missing = role.skills.filter((s) => !picked.includes(s));

  return {
    roleName: role.name,
    found,
    missing,
    score: Math.round((found.length / role.skills.length) * 100),
  };
}

function verdictFor(score) {
  if (score >= 85) return 'Strong match — you clear the bar.';
  if (score >= 65) return 'Good match — a few gaps to close.';
  if (score >= 40) return 'Partial match — worth some polish.';
  return 'Weak match — start with the core skills.';
}

/* ------------------------------------------------------------ rendering */

function renderReport(file, report) {
  $('result-file').textContent = file.name;
  $('role-name').textContent = report.roleName;
  $('found-count').textContent = report.found.length;
  $('total-count').textContent = report.found.length + report.missing.length;
  $('found-badge').textContent = report.found.length;
  $('missing-badge').textContent = report.missing.length;
  $('score-verdict').textContent = verdictFor(report.score);

  fillChips($('found-list'), report.found, 'chip-yes', 'None found');
  fillChips($('missing-list'), report.missing, 'chip-no', 'Nothing missing');

  results.hidden = false;

  /* Animate the ring 0 -> score. Writing the custom property is all it
     takes; the conic-gradient in styles.css reads it. */
  const ring = $('score-ring');
  const value = $('score-value');

  ring.style.setProperty('--score', 0);
  value.textContent = '0';

  requestAnimationFrame(() => {
    ring.style.setProperty('--score', report.score);
    countUp(value, report.score);
  });

  results.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function fillChips(list, skills, className, emptyText) {
  list.innerHTML = '';

  if (!skills.length) {
    const li = document.createElement('li');
    li.className = 'chip chip-empty';
    li.textContent = emptyText;
    list.appendChild(li);
    return;
  }

  for (const skill of skills) {
    const li = document.createElement('li');
    li.className = `chip ${className}`;
    li.textContent = skill;
    list.appendChild(li);
  }
}

/* Count 0 -> to, easing out so it settles rather than stopping dead. */
function countUp(el, to) {
  const duration = 700;
  const start = performance.now();

  function frame(now) {
    const t = Math.min((now - start) / duration, 1);
    el.textContent = Math.round(to * (1 - Math.pow(1 - t, 3)));
    if (t < 1) requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}

/* ---------------------------------------------------------------- reset */

$('reset-btn').addEventListener('click', () => {
  results.hidden = true;
  fileInput.value = '';
  clearError();
  window.scrollTo({ top: 0, behavior: 'smooth' });
});
