export interface CategorizedError {
  isTemporary: boolean;
  code: string;
  reason: string;
  userActionRequired?: string;
}

export class ErrorClassifier {
  public static classify(err: any): CategorizedError {
    if (!err) {
      return {
        isTemporary: true,
        code: 'UNKNOWN_TEMPORARY_ERROR',
        reason: 'Unspecified temporary network error'
      };
    }

    const message = (
      typeof err === 'string'
        ? err
        : `${err?.message || ''} ${err?.error || ''} ${err?.errorSummary || ''} ${err?.errorDescription || ''} ${err?.reason || ''} ${err?.type || ''} ${JSON.stringify(err)}`
    ).toLowerCase();

    // Permanent hard auth rejections
    if (
      message.includes('checkpoint') ||
      message.includes('1357004') ||
      message.includes('1348092') ||
      message.includes('login approval') ||
      message.includes('security code') ||
      message.includes('security checkpoint') ||
      message.includes('please try closing and re-opening your browser window')
    ) {
      return {
        isTemporary: false,
        code: 'CHECKPOINT',
        reason: 'Facebook account hit security checkpoint or 2FA approval requirement.',
        userActionRequired: 'Log into Facebook in your browser, solve security checkpoint, export fresh appstate JSON, and reconnect.'
      };
    }

    if (
      message.includes('invalid_session') ||
      message.includes('session expired') ||
      message.includes('invalid cookies') ||
      message.includes('wrong password') ||
      message.includes('not logged in') ||
      message.includes('not_logged_in') ||
      message.includes('getseqid') ||
      message.includes('no sync_sequence_id') ||
      message.includes('auth_error') ||
      message.includes('account_inactive') ||
      message.includes('re-authenticate') ||
      message.includes('connection refused') ||
      message.includes('server unavailable')
    ) {
      return {
        isTemporary: false,
        code: 'SESSION_EXPIRED',
        reason: 'Facebook authentication cookies expired, invalidated, or rejected by Facebook (Connection refused).',
        userActionRequired: 'Export fresh appstate JSON from active browser session and re-authenticate.'
      };
    }

    if (
      message.includes('account_restricted') ||
      message.includes('disabled') ||
      message.includes('account suspended') ||
      message.includes('account banned') ||
      message.includes('blocked') ||
      message.includes('login_blocked') ||
      message.includes('blocked the login')
    ) {
      return {
        isTemporary: false,
        code: 'ACCOUNT_RESTRICTED',
        reason: 'Facebook account is restricted, suspended, or blocked from login.',
        userActionRequired: 'Log into Facebook in web browser to clear any safety blocks, review account status, and upload fresh session cookies.'
      };
    }

    if (message.includes('revoked_token') || message.includes('invalid OAuth access token')) {
      return {
        isTemporary: false,
        code: 'REVOKED_TOKEN',
        reason: 'Meta OAuth token has been revoked or expired.',
        userActionRequired: 'Re-authorize connection via Meta OAuth.'
      };
    }

    // Rate limit (temporary)
    if (message.includes('rate limit') || message.includes('too many requests') || message.includes('429')) {
      return {
        isTemporary: true,
        code: 'RATE_LIMIT',
        reason: 'Facebook API rate limit encountered. Waiting before retry.'
      };
    }

    // Network & MQTT disconnects (temporary)
    if (
      message.includes('econnreset') ||
      message.includes('etimedout') ||
      message.includes('enotfound') ||
      message.includes('socket hang up') ||
      message.includes('network error') ||
      message.includes('timeout') ||
      message.includes('mqtt') ||
      message.includes('disconnect') ||
      message.includes('500') ||
      message.includes('502') ||
      message.includes('503') ||
      message.includes('504')
    ) {
      return {
        isTemporary: true,
        code: 'TEMPORARY_NETWORK_ERROR',
        reason: 'Temporary network instability or server disconnection. Reconnecting with exponential backoff.'
      };
    }

    // Default to temporary to prevent destroying session state on ambiguous errors
    return {
      isTemporary: true,
      code: 'PROVIDER_ERROR',
      reason: err.message || 'Transient FCA provider or transport issue.'
    };
  }
}
