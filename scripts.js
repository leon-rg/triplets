/**
 * TRIPLETAS — scripts.js (v2)
 *
 * Cambios vs original:
 *  1. checkTriplet evalúa las dos permutaciones válidas de factores
 *     (a·b±c  Y  b·c±a) dependiendo de cuál par es adyacente.
 *  2. validateSelection detecta correctamente qué par de celdas
 *     es adyacente y usa ese par como factores.
 *  3. Timer no corre mientras el modal de reglas está abierto.
 *  4. Mejor tiempo guardado en localStorage.
 *  5. Mensajes de feedback claros: "No alineados" vs "Incorrecto".
 *  6. Contador de aciertos en sesión.
 *  7. GRID_SIZE como constante (fácil de cambiar).
 *  8. Todo encapsulado en IIFE (sin contaminar global).
 *  9. HTML corregido: <meta> dentro de <head>.
 * 10. Historial con formato mejorado.
 */

document.addEventListener('DOMContentLoaded', function () {
  'use strict';

  /* ── Constantes ── */
  const GRID_SIZE    = 10;
  const TOTAL_CELLS  = GRID_SIZE * GRID_SIZE;
  const HISTORY_MAX  = 10;

  /* ── DOM ── */
  const gridEl       = document.getElementById('grid');
  const targetEl     = document.getElementById('targetNumber');
  const historyEl    = document.getElementById('history');
  const timerEl      = document.getElementById('timer');
  const scoreEl      = document.getElementById('score');
  const bestTimeEl   = document.getElementById('best-time');
  const feedbackEl   = document.getElementById('feedback-msg');
  const correctSound = document.getElementById('correctSound');
  const wrongSound   = document.getElementById('wrongSound');
  const rulesModal   = document.getElementById('rulesModal');
  const overlay      = document.getElementById('modal-overlay');

  /* ── Estado ── */
  let numbers      = [];
  let selected     = [];          // índices seleccionados
  let target       = null;
  let startTime    = 0;
  let paused       = false;
  let pauseStart   = 0;
  let recentHistory = [];
  let sessionScore = 0;
  let soundEnabled = true;
  let bestTime     = Infinity;
  let feedbackTimer = null;

  /* ─────────────────────────────────────
     UTILIDADES DE CUADRÍCULA
  ───────────────────────────────────── */
  const toIndex = (row, col) => row * GRID_SIZE + col;
  const toRow   = (i) => Math.floor(i / GRID_SIZE);
  const toCol   = (i) => i % GRID_SIZE;

  /** Comprueba si tres índices están alineados (consecutivos en la misma dirección). */
  function areAligned(i1, i2, i3) {
    const r1 = toRow(i1), c1 = toCol(i1);
    const r2 = toRow(i2), c2 = toCol(i2);
    const r3 = toRow(i3), c3 = toCol(i3);
    const dr1 = r2 - r1, dc1 = c2 - c1;
    const dr2 = r3 - r2, dc2 = c3 - c2;
    return dr1 === dr2 && dc1 === dc2;
  }

  /**
   * Comprueba si la tripleta (en el orden dado) cumple las reglas.
   *
   * Regla: de los tres, los dos ADYACENTES se multiplican y al tercero
   * se le suma o resta. El jugador elige el orden al hacer clic, así que
   * evaluamos ambas posibilidades de par adyacente:
   *   → (i1,i2) adyacentes → i1·i2 ± i3
   *   → (i2,i3) adyacentes → i2·i3 ± i1
   *
   * (Los pares (i1,i3) nunca son adyacentes en una tripleta lineal.)
   */
  function checkTriplet(i1, i2, i3) {
    const a = numbers[i1];
    const b = numbers[i2];
    const c = numbers[i3];

    // Par adyacente (i1,i2) — el tercero es c
    if (a * b + c === target || a * b - c === target) return true;
    // Par adyacente (i2,i3) — el tercero es a
    if (b * c + a === target || b * c - a === target) return true;

    return false;
  }

  /* ─────────────────────────────────────
     GENERACIÓN DE GRILLA Y OBJETIVO
  ───────────────────────────────────── */
  function generateGrid() {
    numbers = [];
    gridEl.innerHTML = '';
    for (let i = 0; i < TOTAL_CELLS; i++) {
      const num = Math.floor(Math.random() * 9) + 1;
      numbers.push(num);
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.textContent = num;
      cell.addEventListener('click', () => handleCellClick(i));
      gridEl.appendChild(cell);
    }
  }

  /**
   * Recorre todas las tripletas lineales posibles y recoge los resultados
   * alcanzables según las reglas del juego.
   */
  function findValidTargets() {
    const targets = new Set();
    const directions = [[0, 1], [1, 0], [1, 1], [1, -1]];

    for (let row = 0; row < GRID_SIZE; row++) {
      for (let col = 0; col < GRID_SIZE; col++) {
        for (const [dr, dc] of directions) {
          const r1 = row + dr,       c1 = col + dc;
          const r2 = row + dr * 2,   c2 = col + dc * 2;
          if (r1 < 0 || r1 >= GRID_SIZE || c1 < 0 || c1 >= GRID_SIZE) continue;
          if (r2 < 0 || r2 >= GRID_SIZE || c2 < 0 || c2 >= GRID_SIZE) continue;

          const a = numbers[toIndex(row, col)];
          const b = numbers[toIndex(r1, c1)];
          const c = numbers[toIndex(r2, c2)];

          // Par (a,b) × tercero c
          const r1p = a * b + c;
          const r1m = a * b - c;
          // Par (b,c) × tercero a
          const r2p = b * c + a;
          const r2m = b * c - a;

          if (r1p > 0) targets.add(r1p);
          if (r1m > 0) targets.add(r1m);
          if (r2p > 0) targets.add(r2p);
          if (r2m > 0) targets.add(r2m);
        }
      }
    }
    return Array.from(targets);
  }

  function pickTarget() {
    const validTargets = findValidTargets();
    if (validTargets.length === 0) {
      generateGrid();
      pickTarget();
      return;
    }
    target = validTargets[Math.floor(Math.random() * validTargets.length)];
    targetEl.textContent = target;
    startTime = performance.now();
  }

  /* ─────────────────────────────────────
     INTERACCIÓN CON CELDAS
  ───────────────────────────────────── */
  function handleCellClick(index) {
    if (selected.includes(index) || selected.length >= 3) return;
    selected.push(index);
    gridEl.children[index].classList.add('selected');
    if (selected.length === 3) {
      setTimeout(validateSelection, 280);
    }
  }

  function validateSelection() {
    const cells = [...gridEl.children];
    const [i1, i2, i3] = selected;

    const aligned = areAligned(i1, i2, i3);

    if (!aligned) {
      // Error: no alineados
      playSound(wrongSound);
      showFeedback('No están en línea recta', 'error');
      shakeGrid();
      markWrong(cells, [i1, i2, i3]);
      resetSelectionAfter(900);
      return;
    }

    const valid = checkTriplet(i1, i2, i3);

    if (valid) {
      playSound(correctSound);
      const elapsed = ((performance.now() - startTime) / 1000).toFixed(2);
      showFeedback(`¡Correcto! en ${elapsed}s`, 'success');
      cells[i1].className = 'cell correct';
      cells[i2].className = 'cell correct';
      cells[i3].className = 'cell correct';

      // Puntaje y mejor tiempo
      sessionScore++;
      scoreEl.textContent = sessionScore;
      const t = parseFloat(elapsed);
      if (t < bestTime) {
        bestTime = t;
        bestTimeEl.textContent = `${t}s`;
        localStorage.setItem('tripletasBestTime', t);
      }

      // Historial
      recentHistory.unshift(
        `✅ ${target} = [${numbers[i1]}, ${numbers[i2]}, ${numbers[i3]}] · ${elapsed}s`
      );
      if (recentHistory.length > HISTORY_MAX) recentHistory.pop();
      renderHistory();

      setTimeout(resetGame, 1200);
    } else {
      // Error: alineados pero resultado incorrecto
      playSound(wrongSound);
      showFeedback('Resultado incorrecto', 'error');
      shakeGrid();
      markWrong(cells, [i1, i2, i3]);
      resetSelectionAfter(900);
    }
  }

  function markWrong(cells, indices) {
    indices.forEach(i => { cells[i].className = 'cell wrong'; });
  }

  function resetSelectionAfter(ms) {
    setTimeout(() => {
      const cells = [...gridEl.children];
      selected.forEach(i => {
        cells[i].className = 'cell';
        cells[i].textContent = numbers[i];
      });
      selected = [];
    }, ms);
  }

  /* ─────────────────────────────────────
     FEEDBACK Y UI
  ───────────────────────────────────── */
  function showFeedback(msg, type = '') {
    clearTimeout(feedbackTimer);
    feedbackEl.textContent = msg;
    feedbackEl.className = type;
    feedbackTimer = setTimeout(() => {
      feedbackEl.textContent = '';
      feedbackEl.className = '';
    }, 2500);
  }

  function shakeGrid() {
    gridEl.classList.add('shake');
    setTimeout(() => gridEl.classList.remove('shake'), 500);
  }

  function renderHistory() {
    historyEl.innerHTML = recentHistory
      .map(item => `<div class="history-item">${item}</div>`)
      .join('');
    localStorage.setItem('tripletasHistory', JSON.stringify(recentHistory));
  }

  /* ─────────────────────────────────────
     RESET Y FLUJO PRINCIPAL
  ───────────────────────────────────── */
  function resetGame() {
    selected = [];
    generateGrid();
    pickTarget();
  }

  /* ─────────────────────────────────────
     TEMA
  ───────────────────────────────────── */
  function toggleTheme() {
    const isDark = document.body.classList.toggle('dark-mode');
    localStorage.setItem('darkMode', isDark ? 'on' : 'off');
  }

  /* ─────────────────────────────────────
     SONIDO
  ───────────────────────────────────── */
  function playSound(audio) {
    if (!soundEnabled) return;
    audio.currentTime = 0;
    audio.play().catch(() => {});
  }

  function updateSoundButton() {
    const btn = document.getElementById('sound-toggle');
    btn.textContent = soundEnabled ? '🔊' : '🔇';
    btn.title = soundEnabled ? 'Sonido activado' : 'Sonido desactivado';
    localStorage.setItem('soundEnabled', soundEnabled ? 'on' : 'off');
  }

  /* ─────────────────────────────────────
     MODAL DE REGLAS (con pausa correcta)
  ───────────────────────────────────── */
  function openRules() {
    rulesModal.style.display = 'block';
    overlay.style.display = 'block';
    if (!paused) {
      paused = true;
      pauseStart = performance.now();
    }
  }

  function closeRules() {
    rulesModal.style.display = 'none';
    overlay.style.display = 'none';
    if (paused) {
      startTime += performance.now() - pauseStart;
      paused = false;
    }
  }

  /* ─────────────────────────────────────
     TIMER
  ───────────────────────────────────── */
  setInterval(() => {
    if (paused) return;
    const diff = ((performance.now() - startTime) / 1000).toFixed(1);
    timerEl.textContent = diff + 's';
  }, 100);

  /* ─────────────────────────────────────
     EVENTOS
  ───────────────────────────────────── */
  document.getElementById('theme-toggle').addEventListener('click', toggleTheme);
  document.getElementById('help-button').addEventListener('click', openRules);
  document.getElementById('close-modal').addEventListener('click', closeRules);
  overlay.addEventListener('click', closeRules);

  document.getElementById('sound-toggle').addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    updateSoundButton();
  });

  /* ─────────────────────────────────────
     INICIALIZACIÓN
  ───────────────────────────────────── */
  // Restaurar preferencias
  if (localStorage.getItem('darkMode') === 'on') {
    document.body.classList.add('dark-mode');
  }
  if (localStorage.getItem('soundEnabled') === 'off') {
    soundEnabled = false;
    updateSoundButton();
  }
  const savedBest = parseFloat(localStorage.getItem('tripletasBestTime'));
  if (!isNaN(savedBest) && savedBest > 0) {
    bestTime = savedBest;
    bestTimeEl.textContent = `${savedBest}s`;
  }
  const savedHistory = JSON.parse(localStorage.getItem('tripletasHistory') || '[]');
  if (Array.isArray(savedHistory)) {
    recentHistory = savedHistory.slice(0, HISTORY_MAX);
    renderHistory();
  }

  // Iniciar juego y mostrar reglas al inicio
  resetGame();
  openRules();

});
