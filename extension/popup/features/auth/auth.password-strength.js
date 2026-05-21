/** Password strength UI for sign-up and new-password modals. */

export function updatePasswordStrength(app, password) {
  const strengthBar = document.querySelector('.strength-bar');
  if (!strengthBar) return;

  let strength = 0;

  const hasLength = password.length >= 8;
  const hasLowercase = /[a-z]/.test(password);
  const hasUppercase = /[A-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);

  updateRequirement(app, 'req-length', hasLength);
  updateRequirement(app, 'req-lowercase', hasLowercase);
  updateRequirement(app, 'req-uppercase', hasUppercase);
  updateRequirement(app, 'req-number', hasNumber);
  updateRequirement(app, 'req-special', hasSpecial);

  if (hasLength) strength += 20;
  if (hasLowercase) strength += 20;
  if (hasUppercase) strength += 20;
  if (hasNumber) strength += 20;
  if (hasSpecial) strength += 20;

  strengthBar.style.width = `${strength}%`;

  if (strength < 60) {
    strengthBar.style.background = '#EF4444';
  } else if (strength < 100) {
    strengthBar.style.background = '#F59E0B';
  } else {
    strengthBar.style.background = '#10B981';
  }
}

export function updateRequirement(_app, elementId, isValid) {
  const element = document.getElementById(elementId);
  if (!element) return;

  const icon = element.querySelector('.requirement-icon');
  if (isValid) {
    element.classList.add('valid');
    if (icon) icon.textContent = '\u2713';
  } else {
    element.classList.remove('valid');
    if (icon) icon.textContent = '\u2717';
  }
}

export function validatePassword(password) {
  const hasLength = password.length >= 8;
  const hasLowercase = /[a-z]/.test(password);
  const hasUppercase = /[A-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);

  return hasLength && hasLowercase && hasUppercase && hasNumber && hasSpecial;
}

export function updateNewPasswordStrength(app, password) {
  const strengthBar = document.querySelector('#newPasswordStrength .strength-bar');
  if (!strengthBar) return;

  let strength = 0;

  const hasLength = password.length >= 8;
  const hasLowercase = /[a-z]/.test(password);
  const hasUppercase = /[A-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);

  updateRequirement(app, 'new-req-length', hasLength);
  updateRequirement(app, 'new-req-lowercase', hasLowercase);
  updateRequirement(app, 'new-req-uppercase', hasUppercase);
  updateRequirement(app, 'new-req-number', hasNumber);
  updateRequirement(app, 'new-req-special', hasSpecial);

  if (hasLength) strength += 20;
  if (hasLowercase) strength += 20;
  if (hasUppercase) strength += 20;
  if (hasNumber) strength += 20;
  if (hasSpecial) strength += 20;

  strengthBar.style.width = `${strength}%`;

  if (strength < 60) {
    strengthBar.style.background = '#EF4444';
  } else if (strength < 100) {
    strengthBar.style.background = '#F59E0B';
  } else {
    strengthBar.style.background = '#10B981';
  }
}

export function checkPasswordMatch() {
  const newPassword = document.getElementById('newPassword')?.value || '';
  const confirmPassword = document.getElementById('confirmNewPassword')?.value || '';
  const matchHint = document.getElementById('passwordMatchHint');

  if (!matchHint) return;

  if (confirmPassword.length > 0) {
    if (newPassword === confirmPassword) {
      matchHint.textContent = 'Passwords match';
      matchHint.style.color = '#10B981';
      matchHint.style.display = 'block';
    } else {
      matchHint.textContent = 'Passwords do not match';
      matchHint.style.color = '#DC2626';
      matchHint.style.display = 'block';
    }
  } else {
    matchHint.style.display = 'none';
  }
}
