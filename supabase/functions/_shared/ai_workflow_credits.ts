import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { requireNotBanned } from './security-gate.ts'
import {
  computeTotalRemaining,
  hasAiUsageEntitlement,
  planCreditDrain,
  readPurchasedBalance,
  type UserSubscriptionCreditRow,
} from './credit_packs.ts'
import type { AuthenticatedUserGate, TextCreditGate } from './ai_workflow_types.ts'
import { TEXT_CREDITS_CORS } from './ai_workflow_types.ts'

const AI_NAME_HOURLY_LIMIT = 20

const SUB_CREDIT_SELECT = [
  'user_id', 'subscription_tier', 'subscription_status',
  'has_unlimited_ai', 'ai_access_expires_at',
  'stripe_current_period_end',
  'ai_text_credits_limit', 'ai_text_credits_used', 'ai_text_credits_reset_at',
  'ai_purchased_credits_balance',
].join(',')

// Legacy flat-credit limits → weighted-credit limits (one-time migration)
const LEGACY_LIMIT_MAP = new Map<number, number>([
  [100, 4_000],
  [250, 35_000],
  [2500, 500_000],
  [10_000, 35_000],
  [100_000, 500_000],
])

type TextAllowancePolicy = {
  grant: number
  cap: number
}

type CreditPeriodState = {
  creditsUsed: number
  creditsLimit: number
  resetAtIso: string | null
  stripePeriodEndIso: string | null
  allowancePolicy: TextAllowancePolicy | null
}

type DecrementResult = {
  creditsRemaining: number | null
  creditsLimit: number | null
  creditsResetAt: string | null
  purchasedBalance: number | null
}

function textCreditsJson(
  body: Record<string, unknown>,
  status: number,
): Response {
  return new Response(JSON.stringify(body), {
    headers: { ...TEXT_CREDITS_CORS, 'Content-Type': 'application/json' },
    status,
  })
}

function parseBearerToken(authHeader: string | null): string {
  const raw = String(authHeader || '')
  const lower = raw.toLowerCase()
  if (!lower.startsWith('bearer ')) return ''
  return raw.slice(7).trim()
}

function resolveTextAllowancePolicy(resetAtIso: string | null): TextAllowancePolicy {
  try {
    if (!resetAtIso) return { grant: 35_000, cap: 35_000 }
    const resetMs = Date.parse(resetAtIso)
    if (!Number.isFinite(resetMs)) return { grant: 35_000, cap: 35_000 }
    const diffDays = (resetMs - Date.now()) / 86400000
    if (diffDays <= 10) return { grant: 4_000, cap: 20_000 }
    if (diffDays <= 40) return { grant: 35_000, cap: 35_000 }
    return { grant: 500_000, cap: 500_000 }
  } catch (_) {
    return { grant: 35_000, cap: 35_000 }
  }
}

function computeTextCreditsLimitFallback(resetAtIso: string | null): number {
  return resolveTextAllowancePolicy(resetAtIso).grant
}

function accrueWeeklyRolloverLimit(limit: number, used: number, grant: number, cap: number): number {
  const remaining = Math.max(0, Number(limit) - Math.max(0, Number(used)))
  return Math.min(cap, remaining + grant)
}

function createServiceClientOrError(): { supabase: any } | Response {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  if (!supabaseUrl || !serviceRoleKey) {
    return textCreditsJson({ error: 'Supabase env not configured' }, 500)
  }
  return { supabase: createClient(supabaseUrl, serviceRoleKey) }
}

async function authenticateBearerUser(req: Request): Promise<AuthenticatedUserGate | Response> {
  const clientOrErr = createServiceClientOrError()
  if (clientOrErr instanceof Response) return clientOrErr

  const token = parseBearerToken(req.headers.get('authorization'))
  if (!token) return textCreditsJson({ error: 'Unauthorized' }, 401)

  const { supabase } = clientOrErr
  const { data: userData, error: userErr } = await supabase.auth.getUser(token)
  const user = userData?.user || null
  if (userErr || !user) return textCreditsJson({ error: 'Unauthorized' }, 401)

  const banResponse = await requireNotBanned(user.id, supabase)
  if (banResponse) return banResponse

  return { user, userId: user.id, supabase }
}

function hasActiveCouponAiAccess(sub: UserSubscriptionCreditRow): boolean {
  const expiresAtMs = sub.ai_access_expires_at ? Date.parse(sub.ai_access_expires_at) : NaN
  return sub.has_unlimited_ai === true ||
    (Number.isFinite(expiresAtMs) && expiresAtMs > Date.now())
}

function isPaidPremiumTier(tier: string, status: string): boolean {
  return tier === 'premium' && (status === 'active' || status === 'past_due')
}

function toIsoOrNull(value: string | null | undefined): string | null {
  return value ? new Date(value).toISOString() : null
}

function readFiniteNumber(value: unknown, fallback = NaN): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function needsCouponResetSeed(hasCouponAiAccess: boolean, unlimited: boolean): boolean {
  return hasCouponAiAccess && !unlimited
}

function resolveInitialResetAt(
  sub: UserSubscriptionCreditRow,
  stripePeriodEndIso: string | null,
  hasCouponAiAccess: boolean,
  unlimited: boolean,
): string | null {
  const existing = toIsoOrNull(sub.ai_text_credits_reset_at) || stripePeriodEndIso
  if (existing) return existing
  if (!needsCouponResetSeed(hasCouponAiAccess, unlimited)) return null
  return new Date(Date.now() + 30 * 86400000).toISOString()
}

function resolveInitialCreditsLimit(opts: {
  unlimited: boolean
  isPaidTier: boolean
  hasCouponAiAccess: boolean
  resetAtIso: string | null
  rawLimit: number
}): number {
  if (Number.isFinite(opts.rawLimit) && opts.rawLimit > 0) return opts.rawLimit
  if (opts.unlimited) return Number.POSITIVE_INFINITY
  if (opts.isPaidTier || opts.hasCouponAiAccess) return computeTextCreditsLimitFallback(opts.resetAtIso)
  return 0
}

function initCreditPeriodState(
  sub: UserSubscriptionCreditRow,
  unlimited: boolean,
  isPaidTier: boolean,
  hasCouponAiAccess: boolean,
): CreditPeriodState {
  const stripePeriodEndIso = toIsoOrNull(sub.stripe_current_period_end)
  const resetAtIso = resolveInitialResetAt(sub, stripePeriodEndIso, hasCouponAiAccess, unlimited)
  const creditsUsed = readFiniteNumber(sub.ai_text_credits_used, 0)
  const rawLimit = readFiniteNumber(sub.ai_text_credits_limit, NaN)
  const creditsLimit = resolveInitialCreditsLimit({
    unlimited,
    isPaidTier,
    hasCouponAiAccess,
    resetAtIso,
    rawLimit,
  })
  const allowancePolicy = unlimited ? null : resolveTextAllowancePolicy(resetAtIso)
  return { creditsUsed, creditsLimit, resetAtIso, stripePeriodEndIso, allowancePolicy }
}

function shouldResetCredits(nowMs: number, resetAtIso: string | null, stripePeriodEndIso: string | null): boolean {
  const resetMs = resetAtIso ? Date.parse(resetAtIso) : NaN
  const stripeMs = stripePeriodEndIso ? Date.parse(stripePeriodEndIso) : NaN
  const shouldResetForTime = Number.isFinite(resetMs) && nowMs >= resetMs
  const shouldResetForStripeShift = Number.isFinite(stripeMs) && Number.isFinite(resetMs) &&
    (stripeMs > resetMs + 10 * 60 * 1000)
  return shouldResetForTime || shouldResetForStripeShift
}

function nextResetAtIso(nowMs: number, stripePeriodEndIso: string | null): string {
  const stripeMs = stripePeriodEndIso ? Date.parse(stripePeriodEndIso) : NaN
  return (Number.isFinite(stripeMs) && stripeMs > nowMs)
    ? new Date(stripeMs).toISOString()
    : new Date(nowMs + 30 * 86400000).toISOString()
}

function applyRolloverLimit(state: CreditPeriodState): number {
  const policy = state.allowancePolicy
  if (policy && policy.cap > policy.grant) {
    return accrueWeeklyRolloverLimit(state.creditsLimit, state.creditsUsed, policy.grant, policy.cap)
  }
  return policy?.grant ?? state.creditsLimit
}

async function persistCreditPeriod(
  supabase: any,
  userId: string,
  patch: {
    ai_text_credits_used?: number
    ai_text_credits_limit: number | null
    ai_text_credits_reset_at: string | null
  },
): Promise<void> {
  await supabase
    .from('user_subscriptions')
    .update({
      ...patch,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
}

async function applyPeriodResetIfNeeded(opts: {
  supabase: any
  userId: string
  sub: UserSubscriptionCreditRow
  unlimited: boolean
  state: CreditPeriodState
}): Promise<CreditPeriodState> {
  const { supabase, userId, sub, unlimited, state } = opts
  if (unlimited) return state

  const nowMs = Date.now()
  if (shouldResetCredits(nowMs, state.resetAtIso, state.stripePeriodEndIso)) {
    const creditsLimit = applyRolloverLimit(state)
    const resetAtIso = nextResetAtIso(nowMs, state.stripePeriodEndIso)
    await persistCreditPeriod(supabase, userId, {
      ai_text_credits_used: 0,
      ai_text_credits_limit: Number.isFinite(creditsLimit) ? creditsLimit : null,
      ai_text_credits_reset_at: resetAtIso,
    })
    return { ...state, creditsUsed: 0, creditsLimit, resetAtIso }
  }

  if (!sub.ai_text_credits_reset_at && state.resetAtIso) {
    await persistCreditPeriod(supabase, userId, {
      ai_text_credits_limit: Number.isFinite(state.creditsLimit) ? state.creditsLimit : null,
      ai_text_credits_reset_at: state.resetAtIso,
    })
  }

  return state
}

async function migrateLegacyLimitIfNeeded(
  supabase: any,
  userId: string,
  unlimited: boolean,
  state: CreditPeriodState,
): Promise<CreditPeriodState> {
  if (unlimited || !LEGACY_LIMIT_MAP.has(state.creditsLimit)) return state

  const newLimit = LEGACY_LIMIT_MAP.get(state.creditsLimit)!
  const scaledUsed = Math.round(state.creditsUsed * 40)
  await supabase
    .from('user_subscriptions')
    .update({
      ai_text_credits_limit: newLimit,
      ai_text_credits_used: scaledUsed,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)

  return { ...state, creditsLimit: newLimit, creditsUsed: scaledUsed }
}

function insufficientCreditsResponse(opts: {
  unlimited: boolean
  creditsUsed: number
  creditsLimit: number
  purchasedBalance: number
  resetAtIso: string | null
}): Response | null {
  if (opts.unlimited) return null
  const subRemaining = Math.max(0, Number(opts.creditsLimit) - Math.max(0, opts.creditsUsed))
  const totalRemaining = computeTotalRemaining(subRemaining, opts.purchasedBalance)
  if (totalRemaining > 0) return null
  return textCreditsJson({
    error: 'No text credits remaining',
    creditsRemaining: 0,
    creditsLimit: opts.creditsLimit,
    purchasedBalance: opts.purchasedBalance,
    creditsResetAt: opts.resetAtIso,
  }, 402)
}

/**
 * Authenticate user + check text credit balance.
 * Returns a TextCreditGate on success, or a ready-to-return Response on failure.
 */
export async function requireTextCredits(req: Request): Promise<TextCreditGate | Response> {
  const auth = await authenticateBearerUser(req)
  if (auth instanceof Response) return auth

  const { user, userId, supabase } = auth
  const { data: subRaw, error: subErr } = await supabase
    .from('user_subscriptions')
    .select(SUB_CREDIT_SELECT)
    .eq('user_id', userId)
    .maybeSingle()

  if (subErr || !subRaw) {
    return textCreditsJson({ error: 'Subscription not found' }, 403)
  }

  const sub = subRaw as UserSubscriptionCreditRow
  const tier = String(sub.subscription_tier || '').toLowerCase()
  const status = String(sub.subscription_status || '').toLowerCase()
  const hasCouponAiAccess = hasActiveCouponAiAccess(sub)
  const purchasedBalance = readPurchasedBalance(sub)

  if (!hasAiUsageEntitlement(sub)) {
    return textCreditsJson({ error: 'Upgrade required' }, 403)
  }

  const unlimited = sub.has_unlimited_ai === true
  const isPaidTier = isPaidPremiumTier(tier, status)
  let state = initCreditPeriodState(sub, unlimited, isPaidTier, hasCouponAiAccess)
  state = await applyPeriodResetIfNeeded({ supabase, userId, sub, unlimited, state })
  state = await migrateLegacyLimitIfNeeded(supabase, userId, unlimited, state)

  const exhausted = insufficientCreditsResponse({
    unlimited,
    creditsUsed: state.creditsUsed,
    creditsLimit: state.creditsLimit,
    purchasedBalance,
    resetAtIso: state.resetAtIso,
  })
  if (exhausted) return exhausted

  return {
    user,
    userId,
    supabase,
    unlimited,
    creditsUsed: state.creditsUsed,
    creditsLimit: state.creditsLimit,
    purchasedBalance,
    resetAtIso: state.resetAtIso,
  }
}

type CreditRowSnapshot = {
  creditsUsed: number
  creditsLimit: number
  purchasedOut: number
  resetAtIso: string | null
}

type CasUpdateOk = {
  updatedUsed: number
  updatedPurchased: number
  creditsLimitOut: number | null
  creditsResetAt: string | null
}

async function tryCasCreditUpdate(opts: {
  supabase: any
  userId: string
  expectedUsed: number
  expectedPurchased: number
  nextUsed: number
  nextPurchased: number
  creditsLimitOut: number | null
  resetAtIso: string | null
}): Promise<CasUpdateOk | null> {
  const { data: updated, error: updErr } = await opts.supabase
    .from('user_subscriptions')
    .update({
      ai_text_credits_used: opts.nextUsed,
      ai_text_credits_limit: opts.creditsLimitOut,
      ai_text_credits_reset_at: opts.resetAtIso,
      ai_purchased_credits_balance: opts.nextPurchased,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', opts.userId)
    .eq('ai_text_credits_used', opts.expectedUsed)
    .eq('ai_purchased_credits_balance', opts.expectedPurchased)
    .select('ai_text_credits_used, ai_text_credits_limit, ai_text_credits_reset_at, ai_purchased_credits_balance')
    .maybeSingle()

  if (updErr || !updated) return null

  return {
    updatedUsed: Number(updated.ai_text_credits_used),
    updatedPurchased: Number(updated.ai_purchased_credits_balance),
    creditsLimitOut: Number.isFinite(Number(updated.ai_text_credits_limit))
      ? Number(updated.ai_text_credits_limit)
      : opts.creditsLimitOut,
    creditsResetAt: updated.ai_text_credits_reset_at
      ? new Date(updated.ai_text_credits_reset_at).toISOString()
      : opts.resetAtIso,
  }
}

function pickFiniteOr(value: unknown, fallback: number): number {
  return Number.isFinite(Number(value)) ? Number(value) : fallback
}

function pickNonNegFiniteOr(value: unknown, fallback: number): number {
  return Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : fallback
}

async function refetchCreditSnapshot(
  supabase: any,
  userId: string,
  fallback: CreditRowSnapshot,
): Promise<CreditRowSnapshot> {
  const { data: refetched } = await supabase
    .from('user_subscriptions')
    .select('ai_text_credits_used, ai_text_credits_limit, ai_text_credits_reset_at, ai_purchased_credits_balance')
    .eq('user_id', userId)
    .maybeSingle()

  return {
    creditsUsed: pickFiniteOr(refetched?.ai_text_credits_used, fallback.creditsUsed),
    creditsLimit: pickFiniteOr(refetched?.ai_text_credits_limit, fallback.creditsLimit),
    purchasedOut: pickNonNegFiniteOr(refetched?.ai_purchased_credits_balance, fallback.purchasedOut),
    resetAtIso: toIsoOrNull(refetched?.ai_text_credits_reset_at) || fallback.resetAtIso,
  }
}

function finalizeDecrementResult(opts: {
  updatedUsed: number | null
  updatedPurchased: number | null
  creditsUsed: number
  purchasedOut: number
  creditsLimitOut: number | null
  creditsLimit: number
  creditsResetAt: string | null
  drainPlan: { subUsedDelta: number; purchasedDelta: number }
}): DecrementResult {
  const finalUsed = opts.updatedUsed ?? (opts.creditsUsed + opts.drainPlan.subUsedDelta)
  const finalPurchased = opts.updatedPurchased ?? Math.max(0, opts.purchasedOut - opts.drainPlan.purchasedDelta)
  const finalLimit = Number.isFinite(Number(opts.creditsLimitOut))
    ? Number(opts.creditsLimitOut)
    : Number(opts.creditsLimit)
  const subRem = Math.max(0, finalLimit - Math.max(0, finalUsed))
  const creditsRemaining = computeTotalRemaining(subRem, finalPurchased)
  return {
    creditsRemaining,
    creditsLimit: opts.creditsLimitOut,
    creditsResetAt: opts.creditsResetAt,
    purchasedBalance: finalPurchased,
  }
}

/**
 * Decrement text credits after a successful AI call (compare-and-set with retry).
 * @param cost Weighted credit cost for the model used (default 40).
 */
export async function decrementTextCredits(
  gate: TextCreditGate,
  cost: number = 40,
): Promise<DecrementResult> {
  if (gate.unlimited) {
    return {
      creditsRemaining: null,
      creditsLimit: null,
      creditsResetAt: gate.resetAtIso,
      purchasedBalance: null,
    }
  }

  const safeCost = Math.max(1, Math.round(cost))
  let snapshot: CreditRowSnapshot = {
    creditsUsed: gate.creditsUsed,
    creditsLimit: gate.creditsLimit,
    purchasedOut: Math.max(0, gate.purchasedBalance),
    resetAtIso: gate.resetAtIso,
  }
  let creditsLimitOut: number | null = Number.isFinite(snapshot.creditsLimit) ? snapshot.creditsLimit : null
  let creditsResetAt: string | null = snapshot.resetAtIso

  const subRemaining = Math.max(0, Number(creditsLimitOut ?? snapshot.creditsLimit) - Math.max(0, snapshot.creditsUsed))
  const drainPlan = planCreditDrain(subRemaining, snapshot.purchasedOut, safeCost)
  if (!drainPlan) {
    return {
      creditsRemaining: 0,
      creditsLimit: creditsLimitOut,
      creditsResetAt,
      purchasedBalance: snapshot.purchasedOut,
    }
  }

  let updatedUsed: number | null = null
  let updatedPurchased: number | null = null

  for (let attempt = 0; attempt < 3; attempt++) {
    const nextUsed = snapshot.creditsUsed + drainPlan.subUsedDelta
    const nextPurchased = Math.max(0, snapshot.purchasedOut - drainPlan.purchasedDelta)
    const cas = await tryCasCreditUpdate({
      supabase: gate.supabase,
      userId: gate.userId,
      expectedUsed: snapshot.creditsUsed,
      expectedPurchased: snapshot.purchasedOut,
      nextUsed,
      nextPurchased,
      creditsLimitOut,
      resetAtIso: snapshot.resetAtIso,
    })

    if (cas) {
      updatedUsed = cas.updatedUsed
      updatedPurchased = cas.updatedPurchased
      creditsLimitOut = cas.creditsLimitOut
      creditsResetAt = cas.creditsResetAt
      break
    }

    snapshot = await refetchCreditSnapshot(gate.supabase, gate.userId, snapshot)
  }

  return finalizeDecrementResult({
    updatedUsed,
    updatedPurchased,
    creditsUsed: snapshot.creditsUsed,
    purchasedOut: snapshot.purchasedOut,
    creditsLimitOut,
    creditsLimit: snapshot.creditsLimit,
    creditsResetAt,
    drainPlan,
  })
}

/** JWT required + ban gate. No premium required (e.g. ai-name). */
export async function requireAuthenticatedUser(req: Request): Promise<AuthenticatedUserGate | Response> {
  return authenticateBearerUser(req)
}

export async function checkAiNameRateLimit(supabase: any, userId: string): Promise<Response | null> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const { count, error } = await supabase
    .from('ai_name_attempt_log')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('attempted_at', oneHourAgo)

  if (error) {
    return textCreditsJson({ error: 'Rate limit check failed' }, 503)
  }

  if ((count ?? 0) >= AI_NAME_HOURLY_LIMIT) {
    return textCreditsJson({ error: 'Too many AI name requests. Try again later.' }, 429)
  }

  await supabase.from('ai_name_attempt_log').insert({ user_id: userId })
  return null
}
