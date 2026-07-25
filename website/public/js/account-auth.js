(function () {
  'use strict';

  const SUPABASE_URL = 'https://blpngeeqcegquiydreyu.supabase.co';
  const SUPABASE_ANON_KEY = [
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
    'eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJscG5nZWVxY2VncXVpeWRyZXl1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE5MzkyOTAsImV4cCI6MjA3NzUxNTI5MH0',
    'eRuh8Eu66wyAMNu0tRyc9LCGVRp7Dhm_87BiQhnRY2o'
  ].join('.');

  function showBootError(message) {
    const errorMessage = document.getElementById('errorMessage');
    if (!errorMessage) return;
    errorMessage.textContent = message;
    errorMessage.style.display = 'block';
  }

  if (!window.supabase || typeof window.supabase.createClient !== 'function') {
    showBootError('Sign-in is temporarily unavailable. Please refresh the page.');
    return;
  }

  const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  window.addEventListener('load', async () => {
    // Confirm-signup / magic-link land here with hash tokens; pick up session then clean URL.
    const hashParams = new URLSearchParams((window.location.hash || '').replace(/^#/, ''));
    const authType = hashParams.get('type');
    const { data: { session } } = await sb.auth.getSession();
    if (session) {
      showDashboard(session.user);
      if (authType === 'signup' || authType === 'email') {
        showSettingsStatus(
          'Email verified. Open the PasteCraft extension and sign in with this account.',
          'success'
        );
      }
      if (window.location.hash) {
        history.replaceState(null, '', window.location.pathname + window.location.search);
      }
    }
  });

  document.getElementById('signInForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();

    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const errorMessage = document.getElementById('errorMessage');

    try {
      const { data, error } = await sb.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (errorMessage) errorMessage.style.display = 'none';
      showDashboard(data.user);
    } catch (error) {
      if (errorMessage) {
        errorMessage.textContent = error.message;
        errorMessage.style.display = 'block';
      }
    }
  });

  async function showDashboard(user) {
    document.getElementById('authContainer').style.display = 'none';
    document.getElementById('dashboard').classList.add('active');
    document.getElementById('userName').textContent = `Welcome back, ${user.email.split('@')[0]}!`;
    document.getElementById('userEmail').textContent = user.email;

    try {
      const { data: { user: freshUser } } = await sb.auth.getUser();
      const activeUser = freshUser || user;
      const optIn = !!(activeUser.user_metadata && activeUser.user_metadata.marketing_opt_in);
      const checkbox = document.getElementById('marketingOptIn');
      if (checkbox) checkbox.checked = optIn;
    } catch (_) {
      // Ignore metadata refresh failures.
    }

    try {
      const { data: subscription } = await sb
        .from('user_subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (subscription) {
        const tier = subscription.subscription_tier.toUpperCase();
        const badge = document.getElementById('subscriptionBadge');
        badge.textContent = tier;
        badge.className = `subscription-badge ${tier.toLowerCase()}`;

        const hasUnlimitedAI = subscription.has_unlimited_ai === true;
        const expiresAt = subscription.ai_access_expires_at;
        const hasCouponAccess = hasUnlimitedAI || (expiresAt && new Date(expiresAt) > new Date());

        if (hasCouponAccess) {
          let couponCode = 'ACTIVE';
          try {
            const { data: redemption } = await sb
              .from('coupon_redemptions')
              .select('coupon_code_id')
              .eq('user_id', user.id)
              .limit(1)
              .single();

            if (redemption && redemption.coupon_code_id) {
              const { data: coupon } = await sb
                .from('coupon_codes')
                .select('code')
                .eq('id', redemption.coupon_code_id)
                .single();

              if (coupon && coupon.code) {
                couponCode = coupon.code;
              }
            }

            const couponNotif = document.getElementById('couponNotification');
            const couponBadge = document.getElementById('couponCodeBadge');
            const upgradeBtn = document.getElementById('upgradeButton');

            if (couponNotif && couponBadge) {
              couponBadge.textContent = couponCode;
              couponNotif.classList.add('show');

              if (hasUnlimitedAI && upgradeBtn) {
                upgradeBtn.style.display = 'none';
              }

              document.getElementById('subscriptionStatus').textContent =
                hasUnlimitedAI
                  ? 'You have Lifetime Unlimited AI access!'
                  : `You have AI access until ${new Date(expiresAt).toLocaleDateString()}`;
            }
          } catch (redemptionError) {
            console.error('Error fetching coupon redemption:', redemptionError);
          }
        } else if (tier === 'PREMIUM') {
          document.getElementById('subscriptionStatus').textContent =
            'You have full access to all premium features.';
        } else if (tier === 'BASIC') {
          document.getElementById('subscriptionStatus').textContent =
            'You have cloud sync and storage-backed access on the Basic plan.';
        }
      }

      loadUserStats(user.id);
    } catch (error) {
      console.error('Error loading dashboard:', error);
    }
  }

  async function loadUserStats(userId) {
    const totalClipsEl = document.getElementById('totalClips');
    const totalCategoriesEl = document.getElementById('totalCategories');
    const totalArchivedEl = document.getElementById('totalArchived');

    if (totalClipsEl) totalClipsEl.textContent = '…';
    if (totalCategoriesEl) totalCategoriesEl.textContent = '…';
    if (totalArchivedEl) totalArchivedEl.textContent = '…';

    const [clipsRes, categoriesRes, archivedRes] = await Promise.allSettled([
      sb.from('clips').select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .is('deleted_at', null),
      sb.from('categories').select('*', { count: 'exact', head: true })
        .eq('user_id', userId),
      sb.from('archived_clips').select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
    ]);

    const getCount = (res) => {
      if (res.status !== 'fulfilled') return '—';
      const { count, error } = res.value || {};
      if (error || typeof count !== 'number') return '—';
      return count.toLocaleString();
    };

    if (totalClipsEl) totalClipsEl.textContent = getCount(clipsRes);
    if (totalCategoriesEl) totalCategoriesEl.textContent = getCount(categoriesRes);
    if (totalArchivedEl) totalArchivedEl.textContent = getCount(archivedRes);
  }

  function showSettingsStatus(message, type) {
    const element = document.getElementById('settingsStatus');
    if (!element) return;
    element.style.display = 'block';
    element.textContent = message;
    if (type === 'success') element.style.color = '#68d391';
    else if (type === 'error') element.style.color = '#feb2b2';
    else element.style.color = 'var(--text-soft)';
  }

  function showTransientStatus(elementId, message, type) {
    const element = document.getElementById(elementId);
    if (!element) return;
    element.style.display = 'block';
    element.textContent = message;
    if (type === 'success') element.style.color = '#68d391';
    else if (type === 'error') element.style.color = '#feb2b2';
    else element.style.color = 'var(--text-soft)';
  }

  document.getElementById('forgotPasswordBtn')?.addEventListener('click', async () => {
    const emailInput = document.getElementById('email');
    const email = (emailInput?.value || '').trim();
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!email || !emailPattern.test(email)) {
      showTransientStatus('forgotPasswordStatus', 'Enter your email above, then click Forgot password.', 'error');
      emailInput?.focus();
      return;
    }

    try {
      showTransientStatus('forgotPasswordStatus', 'Sending reset link...', 'info');
      const { error } = await sb.auth.resetPasswordForEmail(email, {
        redirectTo: 'https://pastecraft.com/reset-password'
      });
      if (error) throw error;
      showTransientStatus('forgotPasswordStatus', `Reset link sent to ${email}. Check your inbox.`, 'success');
    } catch (error) {
      showTransientStatus('forgotPasswordStatus', error?.message || 'Could not send reset link.', 'error');
    }
  });

  document.getElementById('sendMagicLinkBtn')?.addEventListener('click', async () => {
    const emailInput = document.getElementById('email');
    const email = (emailInput?.value || '').trim();

    if (!email) {
      showTransientStatus('magicLinkStatus', 'Enter your email address above first.', 'error');
      emailInput?.focus();
      return;
    }

    try {
      showTransientStatus('magicLinkStatus', 'Sending sign-in link...', 'info');
      const { error } = await sb.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: 'https://pastecraft.com/account',
          shouldCreateUser: false
        }
      });
      if (error) throw error;
      showTransientStatus('magicLinkStatus', `Link sent to ${email}. Check your inbox.`, 'success');
    } catch (error) {
      showTransientStatus('magicLinkStatus', error?.message || 'Could not send sign-in link.', 'error');
    }
  });

  document.getElementById('changeEmailBtn')?.addEventListener('click', async () => {
    const input = document.getElementById('newEmailInput');
    const newEmail = (input?.value || '').trim().toLowerCase();
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!newEmail || !emailPattern.test(newEmail)) {
      showTransientStatus('emailChangeStatus', 'Enter a valid email address.', 'error');
      input?.focus();
      return;
    }

    try {
      const { data: { user } } = await sb.auth.getUser();
      if (!user) {
        showTransientStatus('emailChangeStatus', 'Please sign in again.', 'error');
        return;
      }
      if (user.email && user.email.toLowerCase() === newEmail) {
        showTransientStatus('emailChangeStatus', 'That is already your current email.', 'error');
        return;
      }

      showTransientStatus('emailChangeStatus', 'Sending confirmation link...', 'info');
      const { error } = await sb.auth.updateUser({ email: newEmail });
      if (error) throw error;

      showTransientStatus(
        'emailChangeStatus',
        `Confirmation sent to ${newEmail}. Your email changes only after you click the link.`,
        'success'
      );
      if (input) input.value = '';
    } catch (error) {
      showTransientStatus('emailChangeStatus', error?.message || 'Could not update email.', 'error');
    }
  });

  document.getElementById('sendPasswordResetBtn')?.addEventListener('click', async () => {
    try {
      const { data: { user } } = await sb.auth.getUser();
      if (!user?.email) {
        showSettingsStatus('Please sign in again.', 'error');
        return;
      }

      showSettingsStatus('Sending password reset email...', 'info');
      const { error } = await sb.auth.resetPasswordForEmail(user.email, {
        redirectTo: 'https://pastecraft.com/reset-password'
      });
      if (error) throw error;

      showSettingsStatus('Password reset email sent. Open the link in your email to set a new password on the PasteCraft website.', 'success');
    } catch (error) {
      showSettingsStatus(error?.message || 'Could not send reset email.', 'error');
    }
  });

  document.getElementById('savePreferencesBtn')?.addEventListener('click', async () => {
    try {
      const checkbox = document.getElementById('marketingOptIn');
      const optIn = !!checkbox?.checked;

      showSettingsStatus('Saving preferences...', 'info');
      const { error } = await sb.auth.updateUser({
        data: { marketing_opt_in: optIn }
      });
      if (error) throw error;

      showSettingsStatus('Preferences saved.', 'success');
    } catch (error) {
      showSettingsStatus(error?.message || 'Could not save preferences.', 'error');
    }
  });

  async function signOut() {
    try {
      document.getElementById('dashboard')?.classList.remove('active');
      document.getElementById('authContainer').style.display = 'grid';
    } catch (_) {}

    try {
      await sb.auth.signOut({ scope: 'local' });
    } catch (_) {
      try {
        await sb.auth.signOut();
      } catch (_) {}
    }

    try {
      const globalSignOut = sb.auth.signOut({ scope: 'global' });
      await Promise.race([globalSignOut, new Promise((resolve) => setTimeout(resolve, 1500))]);
    } catch (_) {}
  }

  document.getElementById('signOutBtn')?.addEventListener('click', signOut);
  document.getElementById('upgradeButton')?.addEventListener('click', () => {
    window.location.href = '/pricing';
  });
  window.signOut = signOut;
})();
