import type { ArtifactFile, ManualAccessDefinition, ManualEntityDefinition } from 'shared'
import { replaceFile } from './manualAuthCommon'
import { text } from './manualCrudHelpers'
import { sessionBootstrapRole } from './manualSessionRuntimeCommon'
import { AUDIT_RETENTION_DAYS, LOGIN_LOCKOUT_SECONDS, LOGIN_WINDOW_SECONDS, MAX_LOGIN_ATTEMPTS, SESSION_RETENTION_DAYS } from './manualSessionProtectionCommon'

export function springProtection(files: ArtifactFile[], access: ManualAccessDefinition, entities: readonly ManualEntityDefinition[]): ArtifactFile[] {
  const role = JSON.stringify(sessionBootstrapRole(access, entities))
  replaceFile(files, 'apps/api/src/main/java/dev/siteforge/api/AuthSessionService.java', (content) => content
    .replace('private final ObjectMapper objectMapper;', 'private final ObjectMapper objectMapper;\n  private final AuthProtectionService protection;')
    .replace('public AuthSessionService(JdbcTemplate jdbc, ObjectMapper objectMapper) {', 'public AuthSessionService(JdbcTemplate jdbc, ObjectMapper objectMapper, AuthProtectionService protection) {')
    .replace('this.objectMapper = objectMapper;', 'this.objectMapper = objectMapper;\n    this.protection = protection;')
    .replace('public SessionResult login(String emailInput, String password) {', 'public SessionResult login(String emailInput, String password, String network) {')
    .replace(
      '    List<UserRow> users = jdbc.query(',
      '    String normalizedEmail = emailInput.trim().toLowerCase();\n    protection.assertAllowed(normalizedEmail, network);\n    List<UserRow> users = jdbc.query(',
    )
    .replace('      emailInput.trim().toLowerCase()', '      normalizedEmail')
    .replace(
      '    if (users.isEmpty()) return null;',
      '    if (users.isEmpty()) { protection.record(normalizedEmail, network, "failure"); return null; }',
    )
    .replace(
      '    if (user.disabled() || !ALLOWED_ROLES.contains(user.role()) || !verifyPassword(password, user.passwordHash())) return null;',
      '    if (user.disabled() || !ALLOWED_ROLES.contains(user.role()) || !verifyPassword(password, user.passwordHash())) { protection.record(normalizedEmail, network, "failure"); return null; }\n',
    )
    .replace('    return issueSession(user.id(), null, Map.of("userId", Long.toString(user.id()), "email", user.email(), "role", user.role()));', '    SessionResult session = issueSession(user.id(), null, Map.of("userId", Long.toString(user.id()), "email", user.email(), "role", user.role()));\n    protection.record(normalizedEmail, network, "success");\n    protection.cleanup(false);\n    return session;')
    .replace('  @Transactional\n  public void logout', '  public Map<String, Object> cleanupSecurityData() { return protection.cleanup(true); }\n\n  @Transactional\n  public void logout'))
  replaceFile(files, 'apps/api/src/main/java/dev/siteforge/api/AuthController.java', (content) => content
    .replace('public ResponseEntity<?> login(@RequestBody LoginInput input) {', 'public ResponseEntity<?> login(@RequestBody LoginInput input, HttpServletRequest request) {')
    .replace('AuthSessionService.SessionResult result = auth.login(input.email(), input.password());', `AuthSessionService.SessionResult result;
    try { result = auth.login(input.email(), input.password(), network(request)); }
    catch (AuthProtectionService.LoginRateLimitedException error) {
      return ResponseEntity.status(429).body(Map.of("error", "LOGIN_RATE_LIMITED", "retryAfterSeconds", error.retryAfterSeconds()));
    }`)
    .replace(
      '  @PostMapping("/api/auth/revoke-all")',
      `  @PostMapping("/api/auth/maintenance/cleanup")
  public ResponseEntity<?> cleanup(HttpServletRequest request) {
    AuthSessionService.RuntimeIdentity identity = identity(request);
    if (identity == null || !${role}.equals(identity.role())) return ResponseEntity.status(403).body(Map.of("error", "FORBIDDEN"));
    return ResponseEntity.ok(auth.cleanupSecurityData());
  }

  @PostMapping("/api/auth/revoke-all")`,
    )
    .replace('  private AuthSessionService.RuntimeIdentity identity', `  private String network(HttpServletRequest request) {
    boolean trusted = java.util.List.of("1", "true", "yes", "on").contains(System.getenv().getOrDefault("AUTH_TRUST_PROXY", "").toLowerCase());
    if (trusted) return request.getHeader("X-Forwarded-For") == null ? "" : request.getHeader("X-Forwarded-For").split(",")[0].trim();
    return request.getRemoteAddr() == null ? "" : request.getRemoteAddr();
  }

  private AuthSessionService.RuntimeIdentity identity`))
  return [
    text('apps/api/src/main/java/dev/siteforge/api/AuthProtectionService.java', `package dev.siteforge.api;

import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthProtectionService {
  public static class LoginRateLimitedException extends RuntimeException {
    private final int retryAfterSeconds;
    public LoginRateLimitedException(int retryAfterSeconds) { this.retryAfterSeconds = retryAfterSeconds; }
    public int retryAfterSeconds() { return retryAfterSeconds; }
  }
  private static final class AttemptState { final List<Long> failures = new ArrayList<>(); long lockedUntil; }
  private final JdbcTemplate jdbc;
  private final Map<String, AttemptState> attempts = new ConcurrentHashMap<>();
  private byte[] ephemeralKey;
  private long lastCleanup;
  public AuthProtectionService(JdbcTemplate jdbc) { this.jdbc = jdbc; }
  private int integer(String name, int fallback) { try { int value = Integer.parseInt(System.getenv().getOrDefault(name, "")); return value > 0 ? value : fallback; } catch (Exception ignored) { return fallback; } }
  private synchronized byte[] key() { String raw = System.getenv().getOrDefault("AUTH_AUDIT_HASH_KEY", ""); if (raw.length() >= 32 && !raw.matches("(?i).*(replace-with|changeme|example).*") ) return raw.getBytes(StandardCharsets.UTF_8); if (ephemeralKey == null) { ephemeralKey = new byte[32]; new SecureRandom().nextBytes(ephemeralKey); System.err.println("AUTH_AUDIT_HASH_KEY is not configured; audit hashes rotate when this process restarts"); } return ephemeralKey; }
  private String digest(String scope, String value) { try { Mac mac = Mac.getInstance("HmacSHA256"); mac.init(new SecretKeySpec(key(), "HmacSHA256")); return HexFormat.of().formatHex(mac.doFinal((scope + "\\0" + value).getBytes(StandardCharsets.UTF_8))); } catch (Exception error) { throw new IllegalStateException(error); } }
  private List<String> keys(String email, String network) { List<String> result = new ArrayList<>(); result.add(digest("principal", email)); if (network != null && !network.isBlank()) result.add(digest("network", network)); return result; }
  public void assertAllowed(String email, String network) { long now = System.currentTimeMillis(), window = integer("AUTH_LOGIN_WINDOW_SECONDS", ${LOGIN_WINDOW_SECONDS}) * 1000L, lockout = integer("AUTH_LOGIN_LOCKOUT_SECONDS", ${LOGIN_LOCKOUT_SECONDS}) * 1000L; int maximum = integer("AUTH_MAX_LOGIN_ATTEMPTS", ${MAX_LOGIN_ATTEMPTS}), retry = 0; for (String key : keys(email, network)) { AttemptState state = attempts.computeIfAbsent(key, ignored -> new AttemptState()); synchronized (state) { state.failures.removeIf(item -> item <= now - window); if (state.lockedUntil > now) retry = Math.max(retry, (int)Math.ceil((state.lockedUntil - now) / 1000.0)); else if (state.failures.size() >= maximum) { state.lockedUntil = now + lockout; retry = Math.max(retry, (int)(lockout / 1000)); } } } if (retry > 0) { record(email, network, "rate_limited"); throw new LoginRateLimitedException(retry); } }
  public void record(String email, String network, String outcome) { long now = System.currentTimeMillis(); if ("failure".equals(outcome)) for (String key : keys(email, network)) { AttemptState state = attempts.computeIfAbsent(key, ignored -> new AttemptState()); synchronized(state) { state.failures.add(now); } } else if ("success".equals(outcome)) for (String key : keys(email, network)) attempts.remove(key); String principalHash = digest("principal", email), networkHash = network == null || network.isBlank() ? "" : digest("network", network); jdbc.update("INSERT INTO auth_login_events(principal_hash, network_hash, outcome, created_at) VALUES (?, ?, ?, NOW())", principalHash, networkHash, outcome); System.out.println("{\\\"event\\\":\\\"auth.login\\\",\\\"outcome\\\":\\\"" + outcome + "\\\",\\\"principalHash\\\":\\\"" + principalHash + "\\\",\\\"networkHash\\\":\\\"" + networkHash + "\\\"}"); }
  @Transactional public synchronized Map<String, Object> cleanup(boolean force) { long now = System.currentTimeMillis(); if (!force && now - lastCleanup < 3_600_000) return Map.of("completed", true, "skipped", true); lastCleanup = now; OffsetDateTime auditCutoff = OffsetDateTime.now(ZoneOffset.UTC).minusDays(integer("AUTH_AUDIT_RETENTION_DAYS", ${AUDIT_RETENTION_DAYS})), sessionCutoff = OffsetDateTime.now(ZoneOffset.UTC).minusDays(integer("AUTH_SESSION_RETENTION_DAYS", ${SESSION_RETENTION_DAYS})); int events = jdbc.update("DELETE FROM auth_login_events WHERE created_at < ?", auditCutoff), sessions = jdbc.update("DELETE FROM auth_sessions WHERE expires_at < ? OR (revoked_at IS NOT NULL AND revoked_at < ?)", sessionCutoff, sessionCutoff); return Map.of("completed", true, "loginEventsDeleted", events, "sessionsDeleted", sessions); }
}
`),
    text('apps/api/src/main/resources/db/migration/V3__auth_login_events.sql', `CREATE TABLE auth_login_events (
  id BIGSERIAL PRIMARY KEY,
  principal_hash TEXT NOT NULL,
  network_hash TEXT NOT NULL,
  outcome TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX auth_login_events_principal_created_idx ON auth_login_events(principal_hash, created_at);
CREATE INDEX auth_login_events_network_created_idx ON auth_login_events(network_hash, created_at);
CREATE INDEX auth_login_events_created_idx ON auth_login_events(created_at);`),
  ]
}
