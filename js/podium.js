import { celebratePodium, resetPodiumCelebration } from './effects.js';
import { podiumGroups, departmentLabel } from './ranking.js';

// Both podiums share reveal, reset and tie handling.
export function createPodium({ stageId, buttonId, vectorsId, prefix = '', monthly = false }) {
  const stage = document.getElementById(stageId);
  const button = document.getElementById(buttonId);
  const vectors = document.getElementById(vectorsId);
  let groups = { 1: [], 2: [], 3: [] };
  let ranks = [];
  let step = 0;
  let timer = null;
  let signature = null;
  const id = (part, rank) => document.getElementById(`${prefix}${prefix ? part[0].toUpperCase() + part.slice(1) : part}${rank}`);

  function updateButton() {
    if (!button) return;
    button.disabled = ranks.length === 0;
    if (!ranks.length) button.textContent = 'HENÜZ PUANLI SONUÇ YOK';
    else if (step === ranks.length) button.textContent = 'SIFIRLA';
    else if (step === 0) button.textContent = `${monthly ? 'AYIN KAZANANLARINI' : 'KAZANANLARI'} AÇ (${ranks[step]}. SIRA)`;
    else button.textContent = `${ranks[step]}. SIRAYI GÖSTER`;
  }

  function reset() {
    clearTimeout(timer);
    resetPodiumCelebration();
    stage?.querySelectorAll('.pillar').forEach(el => el.classList.remove('raised'));
    stage?.querySelectorAll('.user-card').forEach(el => el.classList.remove('show'));
    if (vectors) vectors.className = 'bg-vectors';
    step = 0;
    updateButton();
  }

  function setData(rows = []) {
    const next = podiumGroups(rows);
    const nextSignature = JSON.stringify(next);
    if (nextSignature === signature) return;
    signature = nextSignature;
    groups = next;
    ranks = [3, 2, 1].filter(rank => groups[rank].length > 0);
    reset();
    [1, 2, 3].forEach(rank => {
      const members = groups[rank];
      const card = id('card', rank);
      const name = id('name', rank);
      const dept = id('dept', rank);
      const points = id('points', rank);
      const pillar = id('pillar', rank);
      const group = card?.closest('.pedestal-group');
      if (group) group.hidden = members.length === 0;
      card?.classList.toggle('shared-place', members.length > 1);
      if (name) {
        name.replaceChildren();
        members.forEach(member => {
          const person = document.createElement('span');
          person.className = 'podium-person';
          person.title = member.name;
          const parts = String(member.name || '').trim().split(/\s+/);
          const surname = parts.length > 1 ? parts.pop() : '';
          const givenName = document.createElement('span');
          givenName.className = 'podium-name-line';
          givenName.textContent = parts.join(' ');
          person.appendChild(givenName);
          if (surname) {
            const familyName = document.createElement('span');
            familyName.className = 'podium-name-line';
            familyName.textContent = ` ${surname}`;
            person.appendChild(familyName);
          }
          if (members.length > 1) {
            const department = document.createElement('small');
            department.textContent = departmentLabel(member.department) || '—';
            person.appendChild(department);
          }
          name.appendChild(person);
        });
      }
      if (dept) dept.textContent = members.length > 1 ? `Ortak ${rank}.lik · ${members.length} kişi` : departmentLabel(members[0]?.department);
      if (points) points.textContent = members.length ? `${members[0].points.toLocaleString('tr-TR')} P` : '—';
      if (pillar) pillar.textContent = String(rank);
    });
  }

  function reveal() {
    if (!ranks.length) return;
    if (step === ranks.length) { reset(); return; }
    const rank = ranks[step];
    id('pillar', rank)?.classList.add('raised');
    clearTimeout(timer);
    const visible = ranks.slice(0, step + 1);
    timer = setTimeout(() => {
      visible.forEach(place => id('card', place)?.classList.add('show'));
      if (rank === 1) celebratePodium();
    }, 350);
    if (vectors) vectors.className = `bg-vectors shift-step-${4 - rank}`;
    step++;
    updateButton();
  }

  updateButton();
  return { setData, reveal, reset };
}
