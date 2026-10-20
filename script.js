'use strict';

const menuButton = document.querySelector('.menu-toggle');
const navigation = document.querySelector('#main-nav');
function setMenu(open) {
  menuButton.setAttribute('aria-expanded', String(open));
  menuButton.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
  navigation.classList.toggle('is-open', open);
}
menuButton.addEventListener('click', () => setMenu(menuButton.getAttribute('aria-expanded') !== 'true'));
navigation.addEventListener('click', (event) => {
  if (event.target.closest('a')) setMenu(false);
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && menuButton.getAttribute('aria-expanded') === 'true') {
    setMenu(false);
    menuButton.focus();
  }
});
window.matchMedia('(max-width: 850px)').addEventListener('change', () => setMenu(false));

const tabs = Array.from(document.querySelectorAll('[role="tab"]'));
function selectMilestone(tab) {
  tabs.forEach((item) => {
    const selected = item === tab;
    item.setAttribute('aria-selected', String(selected));
    item.tabIndex = selected ? 0 : -1;
    document.getElementById(item.getAttribute('aria-controls')).hidden = !selected;
  });
}
tabs.forEach((tab, index) => {
  tab.addEventListener('click', () => selectMilestone(tab));
  tab.addEventListener('keydown', (event) => {
    let next;
    if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
    if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = tabs.length - 1;
    if (next === undefined) return;
    event.preventDefault();
    selectMilestone(tabs[next]);
    tabs[next].focus();
  });
});

const briefForm = document.getElementById('brief-form');
const brandColor = document.getElementById('brand-color');
const briefError = document.getElementById('brief-error');
brandColor.addEventListener('input', () => {
  document.getElementById('color-value').textContent = brandColor.value.toUpperCase();
});
briefForm.addEventListener('change', () => {
  if (briefForm.querySelector('input[name="channel"]:checked')) briefError.hidden = true;
});
briefForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const data = new FormData(briefForm);
  const formats = data.getAll('channel');
  const languages = data.getAll('languages');
  if (!formats.length || !languages.length) {
    briefError.textContent = !languages.length ? 'Choose English, Ukrainian, or both.' : 'Select at least one format to preview your request.';
    briefError.hidden = false;
    briefForm.querySelector(!languages.length ? 'input[name="languages"]' : 'input[name="channel"]').focus();
    return;
  }
  const title = data.get('eventTitle').trim();
  const description = data.get('description').trim();
  if (!title || !description) {
    briefError.textContent = 'Add an event title and description with more than just spaces.';
    briefError.hidden = false;
    document.getElementById(!title ? 'event-title' : 'event-description').focus();
    return;
  }
  briefError.hidden = true;
  briefError.textContent = 'Select at least one format to preview your request.';
  const variants = Number(data.get('variants'));
  const count = formats.length * variants * languages.length;
  const payload = {
    event: { title, description, date: data.get('eventDate') },
    palette: [data.get('brandColor').toUpperCase(), '#E60036'],
    formats,
    languages,
    variantsPerFormat: variants,
    export: { type: 'ZIP' }
  };
  document.getElementById('result-title').textContent = `One brief. ${count} output${count === 1 ? '' : 's'}.`;
  document.getElementById('result-detail').textContent = `${formats.length} format${formats.length === 1 ? '' : 's'} × ${variants} variant${variants === 1 ? '' : 's'} × ${languages.length} language${languages.length === 1 ? '' : 's'} · Target: ZIP + project history`;
  const context = document.getElementById('result-context');
  context.hidden = false;
  context.textContent = `${title} · ${payload.event.date} · ${formats.join(', ')} · ${payload.palette.join(' / ')}`;
  document.getElementById('payload-json').textContent = JSON.stringify(payload, null, 2);
  document.getElementById('request-payload').hidden = false;
});

const checklistKey = 'creative-automation:readiness:v1';
const checks = Array.from(document.querySelectorAll('#project-checklist input'));
const checklistStatus = document.getElementById('checklist-status');
let storageAvailable = true;
try {
  const saved = JSON.parse(localStorage.getItem(checklistKey) || '[]');
  if (Array.isArray(saved)) checks.forEach((check) => { check.checked = saved.includes(check.value); });
} catch {
  storageAvailable = false;
}
function updateProgress(announce = false) {
  const completed = checks.filter((check) => check.checked);
  const number = document.getElementById('progress-number');
  number.replaceChildren(document.createTextNode(String(completed.length)));
  const total = document.createElement('span');
  total.textContent = `/${checks.length}`;
  number.append(total);
  document.getElementById('progress-ring').style.setProperty('--progress', `${completed.length / checks.length * 360}deg`);
  if (announce) {
    try {
      localStorage.setItem(checklistKey, JSON.stringify(completed.map((check) => check.value)));
      storageAvailable = true;
    } catch {
      storageAvailable = false;
    }
  }
  if (!storageAvailable) {
    checklistStatus.textContent = `${completed.length} of ${checks.length} complete. Browser storage is unavailable; progress lasts for this visit.`;
  } else if (announce) {
    checklistStatus.textContent = `${completed.length} of ${checks.length} complete. Progress saved in this browser.`;
  }
}
checks.forEach((check) => check.addEventListener('change', () => updateProgress(true)));
document.getElementById('reset-checklist').addEventListener('click', () => {
  checks.forEach((check) => { check.checked = false; });
  updateProgress(true);
});
updateProgress();
