/** Countdown UI after AI gallery image generation. */

export function showAIGenerationTimer(app) {
  const timer = document.getElementById('aiGenerationTimer');
  const countdown = document.getElementById('aiTimerCountdown');

  if (!timer || !countdown) return;

  timer.style.display = 'flex';

  let timeLeft = 10;
  countdown.textContent = timeLeft;

  if (app.aiGenerationTimerInterval) {
    clearInterval(app.aiGenerationTimerInterval);
  }

  app.aiGenerationTimerInterval = setInterval(() => {
    timeLeft -= 1;
    countdown.textContent = timeLeft;

    if (timeLeft <= 0) {
      clearInterval(app.aiGenerationTimerInterval);
      app.aiGenerationTimerInterval = null;
      hideAIGenerationTimer(app);
    }
  }, 1000);
}

export function hideAIGenerationTimer(app) {
  const timer = document.getElementById('aiGenerationTimer');
  if (timer) {
    timer.style.display = 'none';
  }

  if (app.aiGenerationTimerInterval) {
    clearInterval(app.aiGenerationTimerInterval);
    app.aiGenerationTimerInterval = null;
  }
}
