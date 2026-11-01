(() => {
  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  const pixelRatio = window.devicePixelRatio || 1;

  canvas.width = W * pixelRatio;
  canvas.height = H * pixelRatio;
  canvas.style.width = `${W}px`;
  canvas.style.height = `${H}px`;
  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

  const scoreEl = document.getElementById('score');
  const livesEl = document.getElementById('lives');
  const difficultyEl = document.getElementById('difficulty');
  const startScreen = document.getElementById('start-screen');
  const gameoverScreen = document.getElementById('gameover-screen');
  const finalScoreEl = document.getElementById('final-score');
  const startButton = document.getElementById('start-button');
  const restartButton = document.getElementById('restart-button');

  const PLAYER_SIZE = 32;
  const ENEMY_SIZE = 32;
  const PLAYER_HIT_RADIUS = 11;
  const ENEMY_HIT_RADIUS = 14;
  const PLAYER_BULLET_RADIUS = 5;
  const ENEMY_BULLET_RADIUS = 5;
  const PLAYER_SPEED = 240; // pixels per second
  const PLAYER_BULLET_SPEED = 420;
  const PLAYER_SHOOT_INTERVAL = 300; // milliseconds
  const INVINCIBLE_DURATION = 1500;
  const DIFFICULTY_INTERVAL = 15000;
  const MAX_DIFFICULTY_LEVEL = 8;

  const keys = new Set();

  let state = 'start'; // 'start' | 'playing' | 'gameover'
  let player, playerBullets, enemies, enemyBullets;
  let score = 0;
  let elapsedTime = 0;
  let difficultyLevel = 0;
  let shootCooldown = 0;
  let enemySpawnTimer = 0;
  let lastTimestamp = null;
  let lastHudSecond = -1;

  function resetGame() {
    player = {
      x: W / 2 - PLAYER_SIZE / 2,
      y: H - 80,
      size: PLAYER_SIZE,
      lives: 3,
      invincible: 0,
    };
    playerBullets = [];
    enemies = [];
    enemyBullets = [];
    score = 0;
    elapsedTime = 0;
    difficultyLevel = 0;
    shootCooldown = 0;
    enemySpawnTimer = 0;
    lastHudSecond = -1;
    keys.clear();
    updateHud();
  }

  function updateHud() {
    scoreEl.textContent = `Score: ${score}`;
    livesEl.textContent = `Life: ${'❤️'.repeat(Math.max(player.lives, 0))}`;
    difficultyEl.textContent =
      `Lv. ${difficultyLevel + 1} / ${Math.floor(elapsedTime / 1000)}s`;
  }

  function getDifficulty() {
    return {
      spawnInterval: Math.max(1160 - difficultyLevel * 130, 330),
      enemySpeed: 90 + difficultyLevel * 18,
      enemyBulletSpeed: 180 + difficultyLevel * 24,
      enemyShootInterval: Math.max(1600 - difficultyLevel * 140, 500),
    };
  }

  function spawnEnemy() {
    let x = Math.random() * (W - ENEMY_SIZE);
    for (let attempt = 0; attempt < 8; attempt++) {
      const overlaps = enemies.some((enemy) => Math.abs(enemy.x - x) < ENEMY_SIZE);
      if (!overlaps) break;
      x = Math.random() * (W - ENEMY_SIZE);
    }

    enemies.push({
      x,
      y: -ENEMY_SIZE,
      size: ENEMY_SIZE,
      shootCooldown: getDifficulty().enemyShootInterval * (0.75 + Math.random() * 0.5),
    });
  }

  function handleInput(deltaSeconds, deltaMs) {
    let dx = 0;
    let dy = 0;
    if (keys.has('ArrowLeft') || keys.has('KeyA')) dx--;
    if (keys.has('ArrowRight') || keys.has('KeyD')) dx++;
    if (keys.has('ArrowUp') || keys.has('KeyW')) dy--;
    if (keys.has('ArrowDown') || keys.has('KeyS')) dy++;

    if (dx || dy) {
      const length = Math.hypot(dx, dy);
      player.x += (dx / length) * PLAYER_SPEED * deltaSeconds;
      player.y += (dy / length) * PLAYER_SPEED * deltaSeconds;
    }

    player.x = Math.max(0, Math.min(W - player.size, player.x));
    player.y = Math.max(0, Math.min(H - player.size, player.y));

    if (keys.has('Space') && shootCooldown <= 0) {
      playerBullets.push({
        x: player.x + player.size / 2,
        y: player.y,
      });
      shootCooldown = PLAYER_SHOOT_INTERVAL;
    }
    shootCooldown = Math.max(0, shootCooldown - deltaMs);
  }

  function updateEntities(deltaSeconds, deltaMs) {
    const diff = getDifficulty();

    enemySpawnTimer += deltaMs;
    if (enemySpawnTimer >= diff.spawnInterval) {
      enemySpawnTimer -= diff.spawnInterval;
      spawnEnemy();
    }

    playerBullets.forEach((b) => (b.y -= PLAYER_BULLET_SPEED * deltaSeconds));
    playerBullets = playerBullets.filter((b) => b.y > -10);

    enemies.forEach((e) => {
      e.y += diff.enemySpeed * deltaSeconds;
      e.shootCooldown -= deltaMs;
      if (e.shootCooldown <= 0 && e.y > 0) {
        const cx = e.x + e.size / 2;
        const cy = e.y + e.size / 2;
        const dx = player.x + player.size / 2 - cx;
        const dy = player.y + player.size / 2 - cy;
        const dist = Math.hypot(dx, dy) || 1;
        enemyBullets.push({
          x: cx,
          y: cy,
          vx: (dx / dist) * diff.enemyBulletSpeed,
          vy: (dy / dist) * diff.enemyBulletSpeed,
        });
        e.shootCooldown =
          diff.enemyShootInterval * (0.75 + Math.random() * 0.5);
      }
    });
    enemies = enemies.filter((e) => e.y < H + e.size);

    enemyBullets.forEach((b) => {
      b.x += b.vx * deltaSeconds;
      b.y += b.vy * deltaSeconds;
    });
    enemyBullets = enemyBullets.filter(
      (b) => b.x > -20 && b.x < W + 20 && b.y > -20 && b.y < H + 20
    );

    player.invincible = Math.max(0, player.invincible - deltaMs);
  }

  function circleHit(ax, ay, ar, bx, by, br) {
    return Math.hypot(ax - bx, ay - by) < ar + br;
  }

  function handleCollisions() {
    // player bullets vs enemies
    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i];
      const ecx = e.x + e.size / 2;
      const ecy = e.y + e.size / 2;
      for (let j = playerBullets.length - 1; j >= 0; j--) {
        const b = playerBullets[j];
        if (circleHit(ecx, ecy, ENEMY_HIT_RADIUS, b.x, b.y, PLAYER_BULLET_RADIUS)) {
          enemies.splice(i, 1);
          playerBullets.splice(j, 1);
          score += 10;
          updateHud();
          break;
        }
      }
    }

    if (player.invincible <= 0) {
      const pcx = player.x + player.size / 2;
      const pcy = player.y + player.size / 2;

      for (let i = enemies.length - 1; i >= 0; i--) {
        const e = enemies[i];
        if (
          circleHit(
            pcx,
            pcy,
            PLAYER_HIT_RADIUS,
            e.x + e.size / 2,
            e.y + e.size / 2,
            ENEMY_HIT_RADIUS
          )
        ) {
          enemies.splice(i, 1);
          damagePlayer();
          return;
        }
      }

      for (let i = enemyBullets.length - 1; i >= 0; i--) {
        const b = enemyBullets[i];
        if (circleHit(pcx, pcy, PLAYER_HIT_RADIUS, b.x, b.y, ENEMY_BULLET_RADIUS)) {
          enemyBullets.splice(i, 1);
          damagePlayer();
          return;
        }
      }
    }
  }

  function damagePlayer() {
    player.lives--;
    player.invincible = INVINCIBLE_DURATION;
    updateHud();
    if (player.lives <= 0) {
      endGame();
    }
  }

  function endGame() {
    state = 'gameover';
    finalScoreEl.textContent = `Score: ${score}`;
    gameoverScreen.classList.remove('hidden');
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);

    ctx.font = `${PLAYER_SIZE}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';

    if (player.invincible <= 0 || Math.floor(elapsedTime / 100) % 2 === 0) {
      ctx.fillText('🚀', player.x + player.size / 2, player.y + player.size / 2);
    }

    ctx.font = `${ENEMY_SIZE}px sans-serif`;
    enemies.forEach((e) => {
      ctx.fillText('👾', e.x + e.size / 2, e.y + e.size / 2);
    });

    ctx.fillStyle = '#7fe0ff';
    playerBullets.forEach((b) => {
      ctx.beginPath();
      ctx.arc(b.x, b.y, PLAYER_BULLET_RADIUS, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.fillStyle = '#ff6b6b';
    enemyBullets.forEach((b) => {
      ctx.beginPath();
      ctx.arc(b.x, b.y, ENEMY_BULLET_RADIUS, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  function loop(timestamp) {
    const deltaMs =
      lastTimestamp === null ? 0 : Math.min(timestamp - lastTimestamp, 50);
    lastTimestamp = timestamp;

    if (state === 'playing') {
      elapsedTime += deltaMs;
      difficultyLevel = Math.min(
        Math.floor(elapsedTime / DIFFICULTY_INTERVAL),
        MAX_DIFFICULTY_LEVEL
      );
      const currentSecond = Math.floor(elapsedTime / 1000);
      if (currentSecond !== lastHudSecond) {
        lastHudSecond = currentSecond;
        updateHud();
      }

      handleInput(deltaMs / 1000, deltaMs);
      updateEntities(deltaMs / 1000, deltaMs);
      handleCollisions();
      draw();
    }
    requestAnimationFrame(loop);
  }

  window.addEventListener('keydown', (e) => {
    if (state === 'playing') {
      keys.add(e.code);
      if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
    }
  });
  window.addEventListener('keyup', (e) => {
    keys.delete(e.code);
  });
  window.addEventListener('blur', () => keys.clear());

  startButton.addEventListener('click', () => {
    resetGame();
    startScreen.classList.add('hidden');
    gameoverScreen.classList.add('hidden');
    state = 'playing';
  });

  restartButton.addEventListener('click', () => {
    resetGame();
    gameoverScreen.classList.add('hidden');
    state = 'playing';
  });

  resetGame();
  requestAnimationFrame(loop);
})();
