import type { ArtifactFile, ManualAccessDefinition, ManualEntityDefinition } from 'shared'
import { runtimeRules, runtimeTargets } from './manualAuthCommon'
import { text } from './manualCrudHelpers'
import { sessionBootstrapRole } from './manualSessionRuntimeCommon'

export function springSessionRuntime(
  access: ManualAccessDefinition,
  entities: readonly ManualEntityDefinition[],
): ArtifactFile[] {
  const rules = JSON.stringify(runtimeRules(access)).replace(/"""/g, '\\"\\"\\"')
  const targets = JSON.stringify(runtimeTargets(entities)).replace(/"""/g, '\\"\\"\\"')
  const allowedRoles = access.roles.map((role) => JSON.stringify(role.key)).join(', ')
  const bootstrapRole = JSON.stringify(sessionBootstrapRole(access, entities))

  return [
    text('apps/api/src/main/java/dev/siteforge/api/AuthSessionService.java', `package dev.siteforge.api;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Base64;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.Set;
import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.PBEKeySpec;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthSessionService {
  public record RuntimeIdentity(String userId, String email, String role, String source, Long sessionId, OffsetDateTime expiresAt) {}
  public record SessionResult(String token, OffsetDateTime expiresAt, Map<String, String> identity) {}
  public record BootstrapResult(String error, Map<String, Object> value) {}
  private record UserRow(long id, String email, String passwordHash, String role, boolean disabled) {}
  private record StaticIdentity(String token, String userId, String email, String role) {}

  private static final Set<String> ALLOWED_ROLES = Set.of(${allowedRoles});
  private static final String BOOTSTRAP_ROLE = ${bootstrapRole};
  private static final int SESSION_TTL_SECONDS = ${access.session!.ttlSeconds};
  private static final int MAX_ACTIVE_SESSIONS = ${access.session!.maxActiveSessions};
  private final JdbcTemplate jdbc;
  private final ObjectMapper objectMapper;
  private final SecureRandom random = new SecureRandom();
  private String cachedRaw = "";
  private List<StaticIdentity> cachedIdentities = List.of();

  public AuthSessionService(JdbcTemplate jdbc, ObjectMapper objectMapper) {
    this.jdbc = jdbc;
    this.objectMapper = objectMapper;
  }

  public static boolean enabled() {
    String value = System.getenv().getOrDefault("AUTH_ENABLED", "").toLowerCase();
    return List.of("1", "true", "yes", "on").contains(value);
  }

  private synchronized List<StaticIdentity> staticIdentities() {
    String raw = System.getenv().getOrDefault("AUTH_IDENTITIES_JSON", "");
    if (raw.equals(cachedRaw)) return cachedIdentities;
    cachedRaw = raw;
    try {
      List<Map<String, Object>> values = objectMapper.readValue(raw, new TypeReference<>() {});
      List<StaticIdentity> valid = new ArrayList<>();
      for (Map<String, Object> value : values) {
        Object token = value.get("token");
        Object userId = value.get("userId");
        Object email = value.get("email");
        Object role = value.get("role");
        if (token instanceof String tokenValue && tokenValue.length() >= 16
            && userId instanceof String userIdValue
            && email instanceof String emailValue
            && role instanceof String roleValue && ALLOWED_ROLES.contains(roleValue)) {
          valid.add(new StaticIdentity(tokenValue, userIdValue, emailValue, roleValue));
        }
      }
      cachedIdentities = List.copyOf(valid);
    } catch (Exception ignored) {
      cachedIdentities = List.of();
    }
    return cachedIdentities;
  }

  public boolean hasConfiguredIdentity() {
    if (!staticIdentities().isEmpty()) return true;
    Long count = jdbc.queryForObject("SELECT COUNT(*) FROM auth_users", Long.class);
    return count != null && count > 0;
  }

  public RuntimeIdentity authenticate(String header) {
    String token = header != null && header.startsWith("Bearer ") ? header.substring(7).trim() : "";
    if (token.isEmpty()) return null;
    byte[] candidate = digest(token);
    for (StaticIdentity identity : staticIdentities()) {
      if (MessageDigest.isEqual(digest(identity.token()), candidate)) {
        return new RuntimeIdentity(identity.userId(), identity.email(), identity.role(), "static", null, null);
      }
    }
    List<RuntimeIdentity> sessions = jdbc.query(
      "SELECT s.id AS session_id, s.expires_at, u.id AS user_id, u.email, u.role, u.disabled " +
      "FROM auth_sessions s JOIN auth_users u ON u.id = s.user_id " +
      "WHERE s.token_hash = ? AND s.revoked_at IS NULL AND s.expires_at > NOW()",
      (rs, rowNum) -> rs.getBoolean("disabled") || !ALLOWED_ROLES.contains(rs.getString("role")) ? null :
        new RuntimeIdentity(
          Long.toString(rs.getLong("user_id")),
          rs.getString("email"),
          rs.getString("role"),
          "session",
          rs.getLong("session_id"),
          rs.getObject("expires_at", OffsetDateTime.class)
        ),
      digestHex(token)
    ).stream().filter(item -> item != null).toList();
    if (sessions.isEmpty()) return null;
    RuntimeIdentity identity = sessions.getFirst();
    jdbc.update("UPDATE auth_sessions SET last_used_at = NOW() WHERE id = ?", identity.sessionId());
    return identity;
  }

  @Transactional
  public BootstrapResult bootstrap() {
    String email = System.getenv().getOrDefault("AUTH_BOOTSTRAP_EMAIL", "").trim().toLowerCase();
    String password = System.getenv().getOrDefault("AUTH_BOOTSTRAP_PASSWORD", "");
    String lower = password.toLowerCase();
    if (!email.contains("@") || password.length() < 12 || lower.contains("replace-with") || lower.contains("changeme") || lower.contains("example")) {
      return new BootstrapResult("BOOTSTRAP_NOT_CONFIGURED", null);
    }
    Long count = jdbc.queryForObject("SELECT COUNT(*) FROM auth_users", Long.class);
    if (count != null && count > 0) return new BootstrapResult("BOOTSTRAP_ALREADY_COMPLETED", null);
    jdbc.update(
      "INSERT INTO auth_users(email, password_hash, role, disabled, created_at, updated_at) VALUES (?, ?, ?, FALSE, NOW(), NOW())",
      email, passwordHash(password), BOOTSTRAP_ROLE
    );
    Long id = jdbc.queryForObject("SELECT id FROM auth_users WHERE email = ?", Long.class, email);
    return new BootstrapResult(null, Map.of(
      "created", true,
      "identity", Map.of("userId", String.valueOf(id), "email", email, "role", BOOTSTRAP_ROLE)
    ));
  }

  @Transactional
  public SessionResult login(String emailInput, String password) {
    if (emailInput == null || password == null || password.length() < 12) return null;
    List<UserRow> users = jdbc.query(
      "SELECT id, email, password_hash, role, disabled FROM auth_users WHERE email = ?",
      (rs, rowNum) -> new UserRow(rs.getLong("id"), rs.getString("email"), rs.getString("password_hash"), rs.getString("role"), rs.getBoolean("disabled")),
      emailInput.trim().toLowerCase()
    );
    if (users.isEmpty()) return null;
    UserRow user = users.getFirst();
    if (user.disabled() || !ALLOWED_ROLES.contains(user.role()) || !verifyPassword(password, user.passwordHash())) return null;
    return issueSession(user.id(), null, Map.of("userId", Long.toString(user.id()), "email", user.email(), "role", user.role()));
  }

  @Transactional
  public void logout(long sessionId) {
    jdbc.update("UPDATE auth_sessions SET revoked_at = NOW() WHERE id = ? AND revoked_at IS NULL", sessionId);
  }

  @Transactional
  public SessionResult rotate(RuntimeIdentity identity) {
    return issueSession(Long.parseLong(identity.userId()), identity.sessionId(), Map.of(
      "userId", identity.userId(), "email", identity.email(), "role", identity.role()
    ));
  }

  @Transactional
  public void revokeAll(long userId) {
    jdbc.update("UPDATE auth_sessions SET revoked_at = NOW() WHERE user_id = ? AND revoked_at IS NULL", userId);
  }

  private SessionResult issueSession(long userId, Long currentSessionId, Map<String, String> identity) {
    OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
    if (currentSessionId != null) jdbc.update("UPDATE auth_sessions SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL", now, currentSessionId);
    List<Long> active = jdbc.queryForList(
      "SELECT id FROM auth_sessions WHERE user_id = ? AND revoked_at IS NULL AND expires_at > ? ORDER BY created_at ASC",
      Long.class,
      userId,
      now
    );
    int revokeCount = Math.max(0, active.size() - MAX_ACTIVE_SESSIONS + 1);
    for (int index = 0; index < revokeCount; index += 1) {
      jdbc.update("UPDATE auth_sessions SET revoked_at = ? WHERE id = ?", now, active.get(index));
    }
    byte[] bytes = new byte[32];
    random.nextBytes(bytes);
    String token = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    OffsetDateTime expiresAt = now.plusSeconds(SESSION_TTL_SECONDS);
    jdbc.update(
      "INSERT INTO auth_sessions(token_hash, user_id, expires_at, revoked_at, last_used_at, created_at) VALUES (?, ?, ?, NULL, ?, ?)",
      digestHex(token), userId, expiresAt, now, now
    );
    return new SessionResult(token, expiresAt, identity);
  }

  private String passwordHash(String password) {
    byte[] salt = new byte[16];
    random.nextBytes(salt);
    byte[] hash = derive(password, salt, 600_000, 32);
    return "pbkdf2_sha256$600000$" + HexFormat.of().formatHex(salt) + "$" + HexFormat.of().formatHex(hash);
  }

  private boolean verifyPassword(String password, String stored) {
    try {
      String[] parts = stored.split("\\\\$", 4);
      if (parts.length != 4 || !"pbkdf2_sha256".equals(parts[0])) return false;
      int iterations = Integer.parseInt(parts[1]);
      byte[] salt = HexFormat.of().parseHex(parts[2]);
      byte[] expected = HexFormat.of().parseHex(parts[3]);
      return MessageDigest.isEqual(expected, derive(password, salt, iterations, expected.length));
    } catch (Exception ignored) {
      return false;
    }
  }

  private byte[] derive(String password, byte[] salt, int iterations, int length) {
    try {
      PBEKeySpec spec = new PBEKeySpec(password.toCharArray(), salt, iterations, length * 8);
      return SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(spec).getEncoded();
    } catch (Exception error) {
      throw new IllegalStateException("PBKDF2 unavailable", error);
    }
  }

  private byte[] digest(String value) {
    try {
      return MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
    } catch (Exception error) {
      throw new IllegalStateException("SHA-256 unavailable", error);
    }
  }

  private String digestHex(String value) {
    return HexFormat.of().formatHex(digest(value));
  }
}
`),
    text('apps/api/src/main/java/dev/siteforge/api/AuthFilter.java', `package dev.siteforge.api;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
public class AuthFilter extends OncePerRequestFilter {
  public static final String IDENTITY_ATTRIBUTE = "siteforge.identity";
  private static final Logger LOGGER = LoggerFactory.getLogger(AuthFilter.class);
  private static final String RULES_JSON = """\n${rules}\n""";
  private static final String TARGETS_JSON = """\n${targets}\n""";
  private static final Set<String> PUBLIC_PATHS = Set.of("/api/health", "/api/auth/bootstrap", "/api/auth/login");
  private final ObjectMapper objectMapper;
  private final AuthSessionService auth;
  private final Map<String, Map<String, List<String>>> rules;
  private final List<Map<String, String>> targets;

  public AuthFilter(ObjectMapper objectMapper, AuthSessionService auth) throws IOException {
    this.objectMapper = objectMapper;
    this.auth = auth;
    this.rules = objectMapper.readValue(RULES_JSON, new TypeReference<>() {});
    this.targets = objectMapper.readValue(TARGETS_JSON, new TypeReference<>() {});
  }

  private Map<String, String> resolveAction(String method, String path) {
    for (Map<String, String> target : targets) {
      String route = target.get("route");
      if (!path.equals(route) && !path.startsWith(route + "/")) continue;
      boolean detail = !path.equals(route);
      String action = null;
      if ("GET".equals(method)) action = detail ? "read" : "list";
      else if ("POST".equals(method) && !detail) action = "create";
      else if (("PATCH".equals(method) || "PUT".equals(method)) && detail) action = "update";
      else if ("DELETE".equals(method) && detail) action = "delete";
      if (action != null) return Map.of("entity", target.get("entity"), "action", action);
    }
    return null;
  }

  private void error(HttpServletResponse response, int status, String code) throws IOException {
    response.setStatus(status);
    response.setContentType("application/json");
    objectMapper.writeValue(response.getWriter(), Map.of("error", code));
  }

  @Override
  protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain) throws ServletException, IOException {
    String path = request.getRequestURI();
    response.setHeader("Access-Control-Allow-Origin", "http://localhost:5173");
    response.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    response.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
    if ("OPTIONS".equals(request.getMethod()) || PUBLIC_PATHS.contains(path)) {
      chain.doFilter(request, response);
      return;
    }
    try {
      AuthSessionService.RuntimeIdentity identity = auth.authenticate(request.getHeader("Authorization"));
      if (!AuthSessionService.enabled()) {
        if (identity != null) request.setAttribute(IDENTITY_ATTRIBUTE, identity);
        chain.doFilter(request, response);
        return;
      }
      if (identity == null) {
        boolean configured = auth.hasConfiguredIdentity();
        error(response, configured ? 401 : 503, configured ? "UNAUTHORIZED" : "AUTH_NOT_CONFIGURED");
        return;
      }
      request.setAttribute(IDENTITY_ATTRIBUTE, identity);
      Map<String, String> resolved = resolveAction(request.getMethod(), path);
      if (resolved != null) {
        List<String> allowed = rules.getOrDefault(identity.role(), Map.of()).getOrDefault(resolved.get("entity"), List.of());
        if (!allowed.contains(resolved.get("action"))) {
          error(response, 403, "FORBIDDEN");
          return;
        }
      }
      chain.doFilter(request, response);
    } catch (Exception error) {
      LOGGER.error("Unhandled authentication error type: {}", error.getClass().getSimpleName());
      error(response, 500, "INTERNAL_ERROR");
    }
  }
}
`),
    text('apps/api/src/main/java/dev/siteforge/api/AuthController.java', `package dev.siteforge.api;

import jakarta.servlet.http.HttpServletRequest;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@RestController
@CrossOrigin(origins = "http://localhost:5173")
public class AuthController {
  public record LoginInput(String email, String password) {}
  private final AuthSessionService auth;

  public AuthController(AuthSessionService auth) { this.auth = auth; }

  @PostMapping("/api/auth/bootstrap")
  public ResponseEntity<?> bootstrap() {
    AuthSessionService.BootstrapResult result = auth.bootstrap();
    if ("BOOTSTRAP_NOT_CONFIGURED".equals(result.error())) return ResponseEntity.status(503).body(Map.of("error", result.error()));
    if ("BOOTSTRAP_ALREADY_COMPLETED".equals(result.error())) return ResponseEntity.status(409).body(Map.of("error", result.error()));
    return ResponseEntity.status(HttpStatus.CREATED).body(result.value());
  }

  @PostMapping("/api/auth/login")
  public ResponseEntity<?> login(@RequestBody LoginInput input) {
    AuthSessionService.SessionResult result = auth.login(input.email(), input.password());
    return result == null
      ? ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "INVALID_CREDENTIALS"))
      : ResponseEntity.ok(result);
  }

  @GetMapping("/api/auth/me")
  public Map<String, Object> me(HttpServletRequest request) {
    AuthSessionService.RuntimeIdentity identity = (AuthSessionService.RuntimeIdentity) request.getAttribute(AuthFilter.IDENTITY_ATTRIBUTE);
    Map<String, Object> response = new LinkedHashMap<>();
    response.put("enabled", AuthSessionService.enabled());
    response.put("identity", identity == null ? null : Map.of("userId", identity.userId(), "email", identity.email(), "role", identity.role()));
    response.put("source", identity == null ? null : identity.source());
    response.put("expiresAt", identity == null || identity.expiresAt() == null ? null : identity.expiresAt().toString());
    return response;
  }

  @PostMapping("/api/auth/logout")
  public ResponseEntity<?> logout(HttpServletRequest request) {
    AuthSessionService.RuntimeIdentity identity = identity(request);
    if (identity == null || identity.sessionId() == null) return ResponseEntity.status(409).body(Map.of("error", "SESSION_REQUIRED"));
    auth.logout(identity.sessionId());
    return ResponseEntity.noContent().build();
  }

  @PostMapping("/api/auth/rotate")
  public ResponseEntity<?> rotate(HttpServletRequest request) {
    AuthSessionService.RuntimeIdentity identity = identity(request);
    if (identity == null || identity.sessionId() == null) return ResponseEntity.status(409).body(Map.of("error", "SESSION_REQUIRED"));
    return ResponseEntity.ok(auth.rotate(identity));
  }

  @PostMapping("/api/auth/revoke-all")
  public ResponseEntity<?> revokeAll(HttpServletRequest request) {
    AuthSessionService.RuntimeIdentity identity = identity(request);
    if (identity == null || identity.sessionId() == null) return ResponseEntity.status(409).body(Map.of("error", "SESSION_REQUIRED"));
    auth.revokeAll(Long.parseLong(identity.userId()));
    return ResponseEntity.noContent().build();
  }

  private AuthSessionService.RuntimeIdentity identity(HttpServletRequest request) {
    return (AuthSessionService.RuntimeIdentity) request.getAttribute(AuthFilter.IDENTITY_ATTRIBUTE);
  }
}
`),
  ]
}
