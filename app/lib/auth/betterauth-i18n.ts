import i18n from "~/i18n";

const errorCodeToTranslationKey = {
  INVALID_EMAIL_OR_PASSWORD: "auth.errors.invalidCredentials",
  INVALID_USERNAME_OR_PASSWORD: "auth.errors.invalidCredentials",
  INVALID_CREDENTIALS: "auth.errors.invalidCredentials",
  INVCREDS: "auth.errors.invalidCredentials",
  USERNAME_TOO_SHORT: "auth.errors.usernameTooShort",
  INVALID_USERNAME: "auth.errors.usernameInvalid",
  PROVIDER_NOT_FOUND: "auth.errors.providerDisabled",
  PROVIDER_NOT_ENABLED: "auth.errors.providerDisabled",
  PROVIDER_DISABLED: "auth.errors.providerDisabled",
  OAUTH_ERROR: "auth.errors.authError",
  PROVIDER_ERROR: "auth.errors.authError",
  OAUTH_EMAIL_MISSING: "auth.errors.authError",
  OAUTH_ACCOUNT_NOT_LINKED: "auth.errors.noConnectedAccount",
  ACCOUNT_DISABLED: "auth.errors.accountDisabled",
  SIGNUP_DISABLED: "auth.errors.signupDisabled",
  RATE_LIMIT: "auth.errors.rateLimit",
  RATELIMIT: "auth.errors.rateLimit",
  UNKNOWN: "auth.errors.unknown",
} as const;

export const betterAuthTranslations = {
  [i18n.DEFAULT_LANG]: Object.fromEntries(
    Object.entries(errorCodeToTranslationKey).map(([errorCode, translationKey]) => [
      errorCode,
      i18n.t(translationKey),
    ]),
  ),
};
