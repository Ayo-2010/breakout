'use strict';

const WIDTH = 480;
const HEIGHT = 640;
const COLS = 8;
const ROWS = 6;
const BRICK_TOP = 78;
const BRICK_HEIGHT = 24;
const BRICK_GAP = 7;
const BRICK_MARGIN = 23;
const BRICK_WIDTH = (WIDTH - BRICK_MARGIN * 2 - BRICK_GAP * (COLS - 1)) / COLS;
const PADDLE_WIDTH = 84;
const PADDLE_HEIGHT = 14;
const PADDLE_Y = HEIGHT - 54;
const BALL_RADIUS = 7;
const TOTAL_LEVELS = 3;

const BRICK_STYLES = [
  { top: '#ff8fb6', bottom: '#ff4f8b', shine: '#ffd0df' },
  { top: '#ffb489', bottom: '#ff7b45', shine: '#ffe0d0' },
  { top: '#ffe08b', bottom: '#ffc53f', shine: '#fff3c8' },
  { top: '#9aefad', bottom: '#5bd778', shine: '#d6ffe0' },
  { top: '#8bd7ff', bottom: '#4db6f5', shine: '#d8f2ff' },
  { top: '#c9a7ff', bottom: '#9b6dff', shine: '#ebdfff' }
];

const canvas = document.getElementById('canvas');
const scoreEl = document.getElementById('score');
const highScoreEl = document.getElementById('highScore');
const livesEl = document.getElementById('lives');
const levelEl = document.getElementById('level');
const startBtn = document.getElementById('startBtn');
const pauseBtn = document.getElementById('pauseBtn');
const overlay = document.getElementById('overlay');
const overlayText = document.getElementById('overlayText');
const overlayNote = document.getElementById('overlayNote');
const playAgainBtn = document.getElementById('playAgainBtn');

let ctx = setupCanvas(canvas, WIDTH, HEIGHT);
let state = 'idle';
let score = 0;
let lives = 3;
let level = 1;
let highScore = loadHighScore();
let bricks = [];
let particles = [];
let serveDelay = 0;
let lastTime = 0;
let pointerActive = false;
let pointerTarget = WIDTH / 2;

const keys = { left: false, right: false };

const paddle = {
  x: WIDTH / 2 - PADDLE_WIDTH / 2,
  y: PADDLE_Y,
  width: PADDLE_WIDTH,
  height: PADDLE_HEIGHT,
  speed: 580
};

const ball = {
  x: WIDTH / 2,
  y: PADDLE_Y - BALL_RADIUS - 3,
  vx: 0,
  vy: 0,
  radius: BALL_RADIUS,
  speed: 325
};

const sparkles = Array.from({ length: 38 }, () => ({
  x: Math.random() * WIDTH,
  y: Math.random() * HEIGHT,
  radius: 0.5 + Math.random() * 1.4,
  alpha: 0.08 + Math.random() * 0.22
}));

function setupCanvas(element, width, height) {
  const ratio = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
  element.width = Math.round(width * ratio);
  element.height = Math.round(height * ratio);
  const context = element.getContext('2d');
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  return context;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function loadHighScore() {
  try {
    const stored = Number(localStorage.getItem('breakout.candy.highScore'));
    return Number.isFinite(stored) && stored > 0 ? Math.floor(stored) : 0;
  } catch (error) {
    return 0;
  }
}

function saveHighScore(value) {
  try {
    localStorage.setItem('breakout.candy.highScore', String(value));
  } catch (error) {
    return;
  }
}

function commitHighScore() {
  if (score > highScore) {
    highScore = score;
    saveHighScore(highScore);
  }
}

function updateHud() {
  scoreEl.textContent = score.toLocaleString();
  highScoreEl.textContent = Math.max(highScore, score).toLocaleString();
  livesEl.textContent = '♥'.repeat(Math.max(0, lives)) + '♡'.repeat(Math.max(0, 3 - lives));
  livesEl.setAttribute('aria-label', lives + ' lives');
  levelEl.textContent = level + ' / ' + TOTAL_LEVELS;
}

function buildBricks() {
  bricks = [];
  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      bricks.push({
        x: BRICK_MARGIN + col * (BRICK_WIDTH + BRICK_GAP),
        y: BRICK_TOP + row * (BRICK_HEIGHT + BRICK_GAP),
        width: BRICK_WIDTH,
        height: BRICK_HEIGHT,
        row,
        alive: true
      });
    }
  }
}

function speedForLevel() {
  return 325 + (level - 1) * 58;
}

function resetBall(delay) {
  ball.x = paddle.x + paddle.width / 2;
  ball.y = PADDLE_Y - BALL_RADIUS - 3;
  ball.vx = 0;
  ball.vy = 0;
  ball.speed = speedForLevel();
  serveDelay = delay === undefined ? 0.9 : delay;
}

function launchBall() {
  const angle = -Math.PI / 2 + (Math.random() * 0.66 - 0.33);
  ball.vx = Math.cos(angle) * ball.speed;
  ball.vy = Math.sin(angle) * ball.speed;
}

function startGame() {
  commitHighScore();
  state = 'playing';
  score = 0;
  lives = 3;
  level = 1;
  particles = [];
  paddle.x = WIDTH / 2 - PADDLE_WIDTH / 2;
  pointerTarget = WIDTH / 2;
  pointerActive = false;
  keys.left = false;
  keys.right = false;
  buildBricks();
  resetBall(0.9);
  updateHud();
  overlay.hidden = true;
  pauseBtn.disabled = false;
  pauseBtn.textContent = 'Pause';
  pauseBtn.setAttribute('aria-pressed', 'false');
  startBtn.textContent = 'Restart';
  lastTime = performance.now();
}

function endGame(won) {
  state = won ? 'won' : 'lost';
  pauseBtn.disabled = true;
  pauseBtn.textContent = 'Pause';
  startBtn.textContent = 'New game';
  commitHighScore();
  updateHud();
  overlayText.textContent = won ? 'You win!' : 'Out of lives';
  overlayNote.textContent = won
    ? 'All three levels cleared · Score ' + score.toLocaleString()
    : 'Score ' + score.toLocaleString() + ' · High ' + highScore.toLocaleString();
  overlay.hidden = false;
  playAgainBtn.focus();
}

function advanceLevel() {
  score += 250;
  if (level >= TOTAL_LEVELS) {
    updateHud();
    endGame(true);
    return;
  }
  level += 1;
  buildBricks();
  paddle.x = WIDTH / 2 - PADDLE_WIDTH / 2;
  resetBall(1.15);
  updateHud();
}

function loseLife() {
  lives -= 1;
  updateHud();
  if (lives <= 0) {
    endGame(false);
    return;
  }
  paddle.x = WIDTH / 2 - PADDLE_WIDTH / 2;
  resetBall(1);
}

function togglePause() {
  if (state === 'playing') {
    state = 'paused';
    pauseBtn.textContent = 'Resume';
    pauseBtn.setAttribute('aria-pressed', 'true');
  } else if (state === 'paused') {
    state = 'playing';
    pauseBtn.textContent = 'Pause';
    pauseBtn.setAttribute('aria-pressed', 'false');
    lastTime = performance.now();
  }
}

function updatePlayer(delta) {
  if (keys.left || keys.right) {
    pointerActive = false;
    let direction = 0;
    if (keys.left) {
      direction -= 1;
    }
    if (keys.right) {
      direction += 1;
    }
    paddle.x += direction * paddle.speed * delta;
  } else if (pointerActive) {
    const center = paddle.x + paddle.width / 2;
    const shift = pointerTarget - center;
    const maxMove = 1150 * delta;
    paddle.x += clamp(shift, -maxMove, maxMove);
  }
  paddle.x = clamp(paddle.x, 10, WIDTH - paddle.width - 10);
}

function spawnParticles(brick) {
  const centerX = brick.x + brick.width / 2;
  const centerY = brick.y + brick.height / 2;
  const style = BRICK_STYLES[brick.row];
  for (let i = 0; i < 8; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 55 + Math.random() * 170;
    const life = 0.35 + Math.random() * 0.38;
    particles.push({
      x: centerX,
      y: centerY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 35,
      size: 2.5 + Math.random() * 4,
      life,
      maxLife: life,
      color: Math.random() < 0.5 ? style.top : style.bottom
    });
  }
}

function updateParticles(delta) {
  for (let i = particles.length - 1; i >= 0; i -= 1) {
    const particle = particles[i];
    particle.life -= delta;
    if (particle.life <= 0) {
      particles.splice(i, 1);
      continue;
    }
    particle.vy += 430 * delta;
    particle.x += particle.vx * delta;
    particle.y += particle.vy * delta;
  }
}

function hitBrick(brick, previousX, previousY) {
  const nearestX = clamp(ball.x, brick.x, brick.x + brick.width);
  const nearestY = clamp(ball.y, brick.y, brick.y + brick.height);
  const dx = ball.x - nearestX;
  const dy = ball.y - nearestY;
  if (dx * dx + dy * dy > ball.radius * ball.radius) {
    return false;
  }

  brick.alive = false;
  score += 10;
  spawnParticles(brick);

  if (previousY + ball.radius <= brick.y) {
    ball.y = brick.y - ball.radius;
    ball.vy = -Math.abs(ball.vy);
  } else if (previousY - ball.radius >= brick.y + brick.height) {
    ball.y = brick.y + brick.height + ball.radius;
    ball.vy = Math.abs(ball.vy);
  } else if (previousX + ball.radius <= brick.x) {
    ball.x = brick.x - ball.radius;
    ball.vx = -Math.abs(ball.vx);
  } else if (previousX - ball.radius >= brick.x + brick.width) {
    ball.x = brick.x + brick.width + ball.radius;
    ball.vx = Math.abs(ball.vx);
  } else if (Math.abs(ball.vy) > Math.abs(ball.vx)) {
    ball.vy *= -1;
  } else {
    ball.vx *= -1;
  }

  const remaining = bricks.some((item) => item.alive);
  if (!remaining) {
    advanceLevel();
  } else {
    updateHud();
  }
  return true;
}

function stepBall(delta) {
  const previousX = ball.x;
  const previousY = ball.y;

  ball.x += ball.vx * delta;
  ball.y += ball.vy * delta;

  if (ball.x - ball.radius < 0) {
    ball.x = ball.radius;
    ball.vx = Math.abs(ball.vx);
  } else if (ball.x + ball.radius > WIDTH) {
    ball.x = WIDTH - ball.radius;
    ball.vx = -Math.abs(ball.vx);
  }

  if (ball.y - ball.radius < 0) {
    ball.y = ball.radius;
    ball.vy = Math.abs(ball.vy);
  }

  if (ball.y - ball.radius > HEIGHT) {
    loseLife();
    return false;
  }

  if (
    ball.vy > 0 &&
    ball.y + ball.radius >= PADDLE_Y &&
    ball.y - ball.radius <= PADDLE_Y + PADDLE_HEIGHT &&
    ball.x + ball.radius >= paddle.x &&
    ball.x - ball.radius <= paddle.x + paddle.width
  ) {
    ball.y = PADDLE_Y - ball.radius - 1;
    const relative = clamp(
      (ball.x - (paddle.x + paddle.width / 2)) / (paddle.width / 2),
      -1,
      1
    );
    const angle = relative * 1.05;
    ball.vx = Math.sin(angle) * ball.speed;
    ball.vy = -Math.cos(angle) * ball.speed;
  }

  for (let i = 0; i < bricks.length; i += 1) {
    const brick = bricks[i];
    if (brick.alive && hitBrick(brick, previousX, previousY)) {
      break;
    }
  }

  return true;
}

function updateBall(delta) {
  if (serveDelay > 0) {
    serveDelay -= delta;
    ball.x = paddle.x + paddle.width / 2;
    ball.y = PADDLE_Y - ball.radius - 3;
    if (serveDelay <= 0) {
      serveDelay = 0;
      launchBall();
    }
    return;
  }

  const distance = Math.hypot(ball.vx, ball.vy) * delta;
  const steps = Math.max(1, Math.ceil(distance / 5));
  const stepDelta = delta / steps;
  for (let i = 0; i < steps; i += 1) {
    if (!stepBall(stepDelta)) {
      return;
    }
    if (state !== 'playing' || serveDelay > 0) {
      return;
    }
  }
}

function roundedRectPath(context, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + width, y, x + width, y + height, r);
  context.arcTo(x + width, y + height, x, y + height, r);
  context.arcTo(x, y + height, x, y, r);
  context.arcTo(x, y, x + width, y, r);
  context.closePath();
}

function drawBackground() {
  const background = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  background.addColorStop(0, '#2c1a6d');
  background.addColorStop(0.48, '#1c0f4b');
  background.addColorStop(1, '#120a35');
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  const glow = ctx.createRadialGradient(WIDTH / 2, 90, 10, WIDTH / 2, 90, 260);
  glow.addColorStop(0, 'rgba(255, 107, 157, 0.13)');
  glow.addColorStop(1, 'rgba(255, 107, 157, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, WIDTH, 330);

  for (let i = 0; i < sparkles.length; i += 1) {
    const sparkle = sparkles[i];
    ctx.fillStyle = 'rgba(255, 255, 255, ' + sparkle.alpha + ')';
    ctx.beginPath();
    ctx.arc(sparkle.x, sparkle.y, sparkle.radius, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.save();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.055)';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 12]);
  ctx.beginPath();
  ctx.moveTo(12, PADDLE_Y - 24);
  ctx.lineTo(WIDTH - 12, PADDLE_Y - 24);
  ctx.stroke();
  ctx.restore();
}

function drawBricks() {
  for (let i = 0; i < bricks.length; i += 1) {
    const brick = bricks[i];
    if (!brick.alive) {
      continue;
    }
    const style = BRICK_STYLES[brick.row];
    const gradient = ctx.createLinearGradient(0, brick.y, 0, brick.y + brick.height);
    gradient.addColorStop(0, style.top);
    gradient.addColorStop(1, style.bottom);
    ctx.save();
    ctx.shadowColor = 'rgba(9, 3, 30, 0.35)';
    ctx.shadowBlur = 5;
    ctx.shadowOffsetY = 3;
    roundedRectPath(ctx, brick.x, brick.y, brick.width, brick.height, 8);
    ctx.fillStyle = gradient;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    ctx.strokeStyle = 'rgba(17, 7, 50, 0.28)';
    ctx.lineWidth = 1;
    ctx.stroke();
    roundedRectPath(ctx, brick.x + 5, brick.y + 4, brick.width - 10, 4, 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.33)';
    ctx.fill();
    ctx.restore();
  }
}

function drawPaddle() {
  ctx.save();
  ctx.shadowColor = 'rgba(255, 107, 157, 0.75)';
  ctx.shadowBlur = 18;
  const gradient = ctx.createLinearGradient(0, paddle.y, 0, paddle.y + paddle.height);
  gradient.addColorStop(0, '#fffdf7');
  gradient.addColorStop(0.5, '#ffe0ea');
  gradient.addColorStop(1, '#ff8fb6');
  roundedRectPath(ctx, paddle.x, paddle.y, paddle.width, paddle.height, 7);
  ctx.fillStyle = gradient;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(29, 14, 71, 0.42)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  roundedRectPath(ctx, paddle.x + 8, paddle.y + 4, paddle.width - 16, 3, 2);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
  ctx.fill();
  ctx.restore();
}

function drawBall() {
  ctx.save();
  ctx.shadowColor = 'rgba(255, 241, 180, 0.95)';
  ctx.shadowBlur = 22;
  const gradient = ctx.createRadialGradient(
    ball.x - 2,
    ball.y - 3,
    1,
    ball.x,
    ball.y,
    ball.radius
  );
  gradient.addColorStop(0, '#fffdf0');
  gradient.addColorStop(0.55, '#ffe08b');
  gradient.addColorStop(1, '#ffb84d');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawParticles() {
  for (let i = 0; i < particles.length; i += 1) {
    const particle = particles[i];
    ctx.globalAlpha = Math.max(0, particle.life / particle.maxLife);
    ctx.fillStyle = particle.color;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawMessage(title, subtitle) {
  ctx.save();
  ctx.fillStyle = 'rgba(17, 8, 47, 0.76)';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fffdf7';
  ctx.font = '900 30px Nunito, sans-serif';
  ctx.fillText(title, WIDTH / 2, HEIGHT / 2 - 12);
  ctx.fillStyle = '#ffd166';
  ctx.font = '800 11px Nunito, sans-serif';
  ctx.fillText(subtitle, WIDTH / 2, HEIGHT / 2 + 25);
  ctx.restore();
}

function drawServeHint() {
  if (serveDelay <= 0) {
    return;
  }
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = 'rgba(255, 223, 132, 0.9)';
  ctx.font = '900 22px Nunito, sans-serif';
  ctx.fillText('LEVEL ' + level, WIDTH / 2, HEIGHT / 2 - 8);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.52)';
  ctx.font = '800 10px Nunito, sans-serif';
  ctx.fillText('GET READY', WIDTH / 2, HEIGHT / 2 + 20);
  ctx.restore();
}

function draw() {
  drawBackground();
  drawBricks();
  drawParticles();
  drawPaddle();
  drawBall();
  if (serveDelay > 0 && state === 'playing') {
    drawServeHint();
  }
  if (state === 'paused') {
    drawMessage('PAUSED', 'PRESS P OR SPACE TO RESUME');
  } else if (state === 'idle') {
    drawMessage('READY?', 'PRESS START GAME TO PLAY');
  }
}

function frame(now) {
  if (!lastTime) {
    lastTime = now;
  }
  const delta = Math.min((now - lastTime) / 1000, 1 / 30);
  lastTime = now;
  if (state === 'playing') {
    updatePlayer(delta);
    updateParticles(delta);
    updateBall(delta);
  }
  draw();
  requestAnimationFrame(frame);
}

function updatePointer(event) {
  const rect = canvas.getBoundingClientRect();
  if (rect.width === 0) {
    return;
  }
  const x = (event.clientX - rect.left) * (WIDTH / rect.width);
  pointerTarget = clamp(x, 0, WIDTH);
  pointerActive = true;
}

canvas.addEventListener('pointermove', (event) => {
  if (state === 'playing') {
    updatePointer(event);
  }
});

canvas.addEventListener('pointerdown', (event) => {
  if (state === 'playing') {
    updatePointer(event);
  }
});

startBtn.addEventListener('click', startGame);
pauseBtn.addEventListener('click', togglePause);
playAgainBtn.addEventListener('click', startGame);

document.addEventListener('keydown', (event) => {
  if ((event.code === 'KeyP' || event.code === 'Space') && (state === 'playing' || state === 'paused')) {
    event.preventDefault();
    togglePause();
    return;
  }
  if (event.code === 'ArrowLeft' || event.code === 'KeyA') {
    if (state === 'playing' || state === 'paused') {
      event.preventDefault();
    }
    if (state === 'playing') {
      keys.left = true;
      pointerActive = false;
    }
  } else if (event.code === 'ArrowRight' || event.code === 'KeyD') {
    if (state === 'playing' || state === 'paused') {
      event.preventDefault();
    }
    if (state === 'playing') {
      keys.right = true;
      pointerActive = false;
    }
  }
});

document.addEventListener('keyup', (event) => {
  if (event.code === 'ArrowLeft' || event.code === 'KeyA') {
    keys.left = false;
  } else if (event.code === 'ArrowRight' || event.code === 'KeyD') {
    keys.right = false;
  }
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden && state === 'playing') {
    togglePause();
  }
});

window.addEventListener('resize', () => {
  ctx = setupCanvas(canvas, WIDTH, HEIGHT);
  draw();
});

window.addEventListener('pagehide', commitHighScore);

buildBricks();
updateHud();
draw();
requestAnimationFrame(frame);
