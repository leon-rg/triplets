const gridElement = document.getElementById('grid');
    const targetElement = document.getElementById('targetNumber');
    const historyElement = document.getElementById('history');
    const timerElement = document.getElementById('timer');
    const correctSound = document.getElementById('correctSound');
    const wrongSound = document.getElementById('wrongSound');

    let numbers = [];
    let selected = [];
    let target = null;
    let startTime = 0;
    let paused = false;
    let pauseStart = 0;
    let recentHistory = [];

    const getIndex = (row, col) => row * 10 + col;

    function generateGrid() {
      numbers = [];
      gridElement.innerHTML = '';
      for (let i = 0; i < 100; i++) {
        const num = Math.floor(Math.random() * 9) + 1;
        numbers.push(num);
        const cell = document.createElement('div');
        cell.className = 'cell';
        cell.textContent = num;
        cell.addEventListener('click', () => selectCell(i, cell));
        gridElement.appendChild(cell);
      }
    }

    function checkTriplet(i1, i2, i3) {
      const a = numbers[i1];
      const b = numbers[i2];
      const c = numbers[i3];
      return a * b + c === target || a * b - c === target;
    }

    function findValidTargets() {
      const targets = new Set();
      const directions = [[0, 1], [1, 0], [1, 1], [1, -1]];
      for (let row = 0; row < 10; row++) {
        for (let col = 0; col < 10; col++) {
          for (const [dr, dc] of directions) {
            const r1 = row + dr, c1 = col + dc;
            const r2 = row + dr * 2, c2 = col + dc * 2;
            if (r2 >= 0 && r2 < 10 && c2 >= 0 && c2 < 10 && r1 >= 0 && r1 < 10 && c1 >= 0 && c1 < 10) {
              const a = numbers[getIndex(row, col)];
              const b = numbers[getIndex(r1, c1)];
              const c = numbers[getIndex(r2, c2)];
              const result1 = a * b + c;
              const result2 = a * b - c;
              if (result1 > 0) targets.add(result1);
              if (result2 > 0) targets.add(result2);
            }
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
      targetElement.textContent = `Número objetivo: ${target}`;
      startTime = performance.now();
    }

    function selectCell(index, cellElement) {
      if (selected.includes(index) || selected.length >= 3) return;
      selected.push(index);
      cellElement.classList.add('selected');
      if (selected.length === 3) {
        setTimeout(() => validateSelection(), 300);
      }
    }

    function validateSelection() {
      const cells = [...gridElement.children];
      const [i1, i2, i3] = selected;
      const r1 = Math.floor(i1 / 10), c1 = i1 % 10;
      const r2 = Math.floor(i2 / 10), c2 = i2 % 10;
      const r3 = Math.floor(i3 / 10), c3 = i3 % 10;
      const dr1 = r2 - r1, dc1 = c2 - c1;
      const dr2 = r3 - r2, dc2 = c3 - c2;
      const isAligned = dr1 === dr2 && dc1 === dc2;
      const result = checkTriplet(i1, i2, i3);
      if (isAligned && result) {
        if (soundEnabled) correctSound.play();
        const timeTaken = ((performance.now() - startTime) / 1000).toFixed(2);
        [i1, i2, i3].forEach(i => cells[i].className = 'cell correct');
        recentHistory.unshift(`✅ ${target} con [${numbers[i1]}, ${numbers[i2]}, ${numbers[i3]}] en ${timeTaken}s`);
        if (recentHistory.length > 10) recentHistory.pop();
        renderHistory();
        setTimeout(resetGame, 1200);
      } else {
        if (soundEnabled) wrongSound.play();
        document.body.classList.add('shake');
        setTimeout(() => document.body.classList.remove('shake'), 500);
        [i1, i2, i3].forEach(i => cells[i].className = 'cell wrong');
        setTimeout(() => {
          [i1, i2, i3].forEach(i => {
            cells[i].className = 'cell';
            cells[i].textContent = numbers[i];
          });
          selected = [];
        }, 1000);
      }
    }

    function renderHistory() {
      historyElement.innerHTML = recentHistory.map(item => `<div>${item}</div>`).join('');
      localStorage.setItem('tripletasHistory', JSON.stringify(recentHistory));
    }

    function resetGame() {
      generateGrid();
      pickTarget();
      selected = [];
    }

    function toggleTheme() {
      const isDark = document.body.classList.toggle('dark-mode');
      localStorage.setItem('darkMode', isDark ? 'on' : 'off');
    }

    function toggleRules() {
      const modal = document.getElementById('rulesModal');
      const isVisible = modal.style.display === 'block';
      modal.style.display = isVisible ? 'none' : 'block';

      if (!isVisible) {
        paused = true;
        pauseStart = performance.now();
      } else {
        const pauseDuration = performance.now() - pauseStart;
        startTime += pauseDuration;
        paused = false;
      }
    }

    document.querySelector('.theme-toggle').addEventListener('click', toggleTheme);
    document.querySelector('.help-button').addEventListener('click', toggleRules);

    let soundEnabled = true;
    const soundToggle = document.getElementById('sound-toggle');
    function updateSoundButton() {
      soundToggle.textContent = soundEnabled ? '🔊' : '🔇';
      soundToggle.title = soundEnabled ? 'Sonido activado' : 'Sonido desactivado';
      localStorage.setItem('soundEnabled', soundEnabled ? 'on' : 'off');
    }
    soundToggle.addEventListener('click', () => {
      soundEnabled = !soundEnabled;
      updateSoundButton();
    });

    resetGame();
    toggleRules(); 

    if (localStorage.getItem('darkMode') === 'on') {
      document.body.classList.add('dark-mode');
    }
    if (localStorage.getItem('soundEnabled') === 'off') {
      soundEnabled = false;
      updateSoundButton();
    }
    const savedHistory = JSON.parse(localStorage.getItem('tripletasHistory') || '[]');
    if (Array.isArray(savedHistory)) {
      recentHistory = savedHistory.slice(0, 10);
      renderHistory();
    }

    setInterval(() => {
      if (paused) return;
      const now = performance.now();
      const diff = ((now - startTime) / 1000).toFixed(1);
      timerElement.textContent = `Tiempo: ${diff}s`;
    }, 100);