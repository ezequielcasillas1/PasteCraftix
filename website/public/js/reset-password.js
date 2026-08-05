/**
 * Password reset page logic.
 * External file required: CSP on /reset-password* is script-src 'self' (blocks inline).
 */
(function () {
  'use strict';

  const SUPABASE_URL = 'https://blpngeeqcegquiydreyu.supabase.co';
  const SUPABASE_ANON_KEY = [
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
    'eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJscG5nZWVxY2VncXVpeWRyZXl1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE5MzkyOTAsImV4cCI6MjA3NzUxNTI5MH0',
    'eRuh8Eu66wyAMNu0tRyc9LCGVRp7Dhm_87BiQhnRY2o'
  ].join('.');

  const resetTitle = document.getElementById('resetTitle');
  const resetCopy = document.getElementById('resetCopy');
  const resetEyebrow = document.getElementById('resetEyebrow');
  const resetStatus = document.getElementById('resetStatus');
  const resetForm = document.getElementById('resetForm');
  const resetSuccess = document.getElementById('resetSuccess');
  const newPasswordInput = document.getElementById('newPassword');
  const confirmPasswordInput = document.getElementById('confirmPassword');
  const charCount = document.getElementById('passwordCharCount');
  const strengthLabel = document.getElementById('passwordStrengthLabel');
  const strengthBar = document.querySelector('#passwordStrength .strength-bar');
  const matchHint = document.getElementById('passwordMatchHint');
  const submitBtn = document.getElementById('resetSubmitBtn');

  function showBootError(message) {
    if (resetEyebrow) resetEyebrow.textContent = 'Reset unavailable';
    if (resetTitle) resetTitle.textContent = 'Password reset is temporarily unavailable.';
    if (resetCopy) resetCopy.textContent = 'Please refresh the page or request a new reset email.';
    if (resetStatus) {
      resetStatus.textContent = message;
      resetStatus.className = 'status-banner error';
      resetStatus.hidden = false;
    }
    if (resetForm) resetForm.hidden = true;
  }

  if (!window.supabase || typeof window.supabase.createClient !== 'function') {
    showBootError('Sign-in library failed to load. Please refresh the page.');
    return;
  }

  if (!resetForm || !newPasswordInput || !confirmPasswordInput || !submitBtn) {
    showBootError('Password reset form failed to initialize.');
    return;
  }

  const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const state = {
    ready: false,
    submitting: false,
  };

  function evaluatePassword(password) {
    const hasLength = password.length >= 8;
    const hasLowercase = /[a-z]/.test(password);
    const hasUppercase = /[A-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);

    let strength = 0;
    if (hasLength) strength += 20;
    if (hasLowercase) strength += 20;
    if (hasUppercase) strength += 20;
    if (hasNumber) strength += 20;
    if (hasSpecial) strength += 20;

    return {
      hasLength,
      hasLowercase,
      hasUppercase,
      hasNumber,
      hasSpecial,
      strength,
      valid: hasLength && hasLowercase && hasUppercase && hasNumber && hasSpecial,
    };
  }

  function updateRequirement(id, met) {
    const item = document.getElementById(id);
    if (!item) return;
    item.classList.toggle('met', met);
    const icon = item.querySelector('.requirement-icon');
    if (icon) icon.textContent = met ? '✓' : '✗';
  }

  function setStatus(message, kind) {
    if (!resetStatus) return;
    resetStatus.textContent = message;
    resetStatus.className = `status-banner ${kind}`;
    resetStatus.hidden = false;
  }

  function updatePasswordUi() {
    const password = newPasswordInput.value;
    const confirmPassword = confirmPasswordInput.value;
    const result = evaluatePassword(password);

    if (charCount) charCount.textContent = `${password.length} characters`;

    if (strengthBar) {
      strengthBar.style.width = `${result.strength}%`;
      if (result.strength < 60) {
        strengthBar.style.background = '#ef4444';
        if (strengthLabel) strengthLabel.textContent = password.length ? 'Weak' : 'Waiting for input';
      } else if (result.strength < 100) {
        strengthBar.style.background = '#f59e0b';
        if (strengthLabel) strengthLabel.textContent = 'Almost there';
      } else {
        strengthBar.style.background = '#10b981';
        if (strengthLabel) strengthLabel.textContent = 'Strong';
      }
    }

    updateRequirement('req-length', result.hasLength);
    updateRequirement('req-lowercase', result.hasLowercase);
    updateRequirement('req-uppercase', result.hasUppercase);
    updateRequirement('req-number', result.hasNumber);
    updateRequirement('req-special', result.hasSpecial);

    if (matchHint) {
      if (confirmPassword.length > 0) {
        matchHint.hidden = false;
        if (password === confirmPassword) {
          matchHint.textContent = 'Passwords match';
          matchHint.className = 'input-hint match-ok';
        } else {
          matchHint.textContent = 'Passwords do not match';
          matchHint.className = 'input-hint match-bad';
        }
      } else {
        matchHint.hidden = true;
      }
    }

    submitBtn.disabled = !(
      state.ready &&
      !state.submitting &&
      result.valid &&
      confirmPassword.length > 0 &&
      password === confirmPassword
    );
  }

  function showInvalidLink(message) {
    state.ready = false;
    resetForm.hidden = true;
    if (resetSuccess) resetSuccess.hidden = true;
    if (resetEyebrow) resetEyebrow.textContent = 'Invalid reset link';
    if (resetTitle) resetTitle.textContent = 'This reset link is invalid or expired.';
    if (resetCopy) {
      resetCopy.textContent = 'Request a new password reset email from PasteCraft and try again.';
    }
    setStatus(message, 'error');
    updatePasswordUi();
  }

  function showReadyForm() {
    if (resetEyebrow) resetEyebrow.textContent = 'Ready to reset';
    if (resetTitle) resetTitle.textContent = 'Create your new password';
    if (resetCopy) {
      resetCopy.textContent = 'Use the password requirements below, then save your new password.';
    }
    setStatus('Recovery session confirmed. Enter your new password below.', 'success');
    resetForm.hidden = false;
    state.ready = true;
    updatePasswordUi();
  }

  async function bootstrapRecovery() {
    const searchParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams((window.location.hash || '').substring(1));
    const errorDescription =
      hashParams.get('error_description') || searchParams.get('error_description') || '';

    if (errorDescription) {
      showInvalidLink(errorDescription);
      return;
    }

    const accessToken = hashParams.get('access_token');
    const refreshToken = hashParams.get('refresh_token');
    const type = hashParams.get('type') || searchParams.get('type');
    const code = searchParams.get('code');

    try {
      if (code) {
        const { error } = await sb.auth.exchangeCodeForSession(code);
        if (error) {
          showInvalidLink(error.message || 'This recovery link could not start a password reset session.');
          return;
        }
        window.history.replaceState({}, document.title, window.location.pathname);
        showReadyForm();
        return;
      }

      if (type === 'recovery' && accessToken && refreshToken) {
        const { error } = await sb.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (error) {
          showInvalidLink(error.message || 'This recovery link could not start a password reset session.');
          return;
        }

        window.history.replaceState({}, document.title, window.location.pathname);
        showReadyForm();
        return;
      }

      const { data: { session } } = await sb.auth.getSession();
      if (session) {
        showReadyForm();
        return;
      }

      showInvalidLink('We could not verify the recovery token from this link.');
    } catch (error) {
      showInvalidLink(error?.message || 'Something went wrong while preparing the password reset form.');
    }
  }

  newPasswordInput.addEventListener('input', updatePasswordUi);
  confirmPasswordInput.addEventListener('input', updatePasswordUi);

  resetForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const password = newPasswordInput.value;
    const confirmPassword = confirmPasswordInput.value;
    const result = evaluatePassword(password);

    if (!result.valid || password !== confirmPassword) {
      updatePasswordUi();
      setStatus('Please satisfy every password rule before submitting.', 'error');
      return;
    }

    state.submitting = true;
    updatePasswordUi();
    setStatus('Updating your password...', 'info');

    try {
      const { error } = await sb.auth.updateUser({ password });
      if (error) throw error;

      try {
        await sb.auth.signOut({ scope: 'local' });
      } catch (_) {
        // Ignore local sign-out cleanup failures after successful password reset.
      }

      window.history.replaceState({}, document.title, window.location.pathname);
      if (resetEyebrow) resetEyebrow.textContent = 'Password updated';
      if (resetTitle) resetTitle.textContent = 'Your password has been changed';
      if (resetCopy) {
        resetCopy.textContent =
          'Return to the PasteCraft widget login screen and sign in with your new password.';
      }
      setStatus('Password updated successfully. You can return to PasteCraft now.', 'success');
      resetForm.hidden = true;
      if (resetSuccess) resetSuccess.hidden = false;
    } catch (error) {
      state.submitting = false;
      updatePasswordUi();
      setStatus(error?.message || 'Could not update your password.', 'error');
    }
  });

  bootstrapRecovery();
})();
