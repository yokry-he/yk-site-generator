import type { ArtifactFile, ManualAccessDefinition, ManualEntityDefinition } from 'shared'
import { text } from './manualCrudHelpers'
import { runtimeRules, runtimeTargets } from './manualAuthCommon'

export function springAuth(
  access: ManualAccessDefinition,
  entities: readonly ManualEntityDefinition[],
): ArtifactFile[] {
  const rules = JSON.stringify(runtimeRules(access)).replace(/"""/g, '\\"\\"\\"')
  const targets = JSON.stringify(runtimeTargets(entities)).replace(/"""/g, '\\"\\"\\"')
  return [
    text('apps/api/src/main/java/dev/siteforge/api/AuthFilter.java', `package dev.siteforge.api;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
public class AuthFilter extends OncePerRequestFilter {
  public static final String IDENTITY_ATTRIBUTE = "siteforge.identity";
  private static final String RULES_JSON = """\n${rules}\n""";
  private static final String TARGETS_JSON = """\n${targets}\n""";
  private final ObjectMapper objectMapper;
  private final Map<String, Map<String, List<String>>> rules;
  private final List<Map<String, String>> targets;
  private String cachedRaw = "";
  private List<Map<String, String>> cachedIdentities = List.of();

  public AuthFilter(ObjectMapper objectMapper) throws IOException {
    this.objectMapper = objectMapper;
    this.rules = objectMapper.readValue(RULES_JSON, new TypeReference<>() {});
    this.targets = objectMapper.readValue(TARGETS_JSON, new TypeReference<>() {});
  }

  public static boolean enabled() {
    String value = System.getenv().getOrDefault("AUTH_ENABLED", "").toLowerCase();
    return List.of("1", "true", "yes", "on").contains(value);
  }

  private synchronized List<Map<String, String>> identities() {
    String raw = System.getenv().getOrDefault("AUTH_IDENTITIES_JSON", "");
    if (raw.equals(cachedRaw)) return cachedIdentities;
    cachedRaw = raw;
    try {
      List<Map<String, Object>> values = objectMapper.readValue(raw, new TypeReference<>() {});
      List<Map<String, String>> valid = new ArrayList<>();
      for (Map<String, Object> value : values) {
        Object token = value.get("token");
        Object userId = value.get("userId");
        Object email = value.get("email");
        Object role = value.get("role");
        if (token instanceof String tokenValue && tokenValue.length() >= 16
            && userId instanceof String userIdValue
            && email instanceof String emailValue
            && role instanceof String roleValue && rules.containsKey(roleValue)) {
          valid.add(Map.of("token", tokenValue, "userId", userIdValue, "email", emailValue, "role", roleValue));
        }
      }
      cachedIdentities = List.copyOf(valid);
    } catch (Exception ignored) {
      cachedIdentities = List.of();
    }
    return cachedIdentities;
  }

  private boolean sameToken(String left, String right) {
    try {
      MessageDigest digest = MessageDigest.getInstance("SHA-256");
      byte[] leftDigest = digest.digest(left.getBytes(StandardCharsets.UTF_8));
      byte[] rightDigest = digest.digest(right.getBytes(StandardCharsets.UTF_8));
      return MessageDigest.isEqual(leftDigest, rightDigest);
    } catch (NoSuchAlgorithmException error) {
      throw new IllegalStateException("SHA-256 unavailable", error);
    }
  }

  private Map<String, String> authenticate(String header) {
    String token = header != null && header.startsWith("Bearer ") ? header.substring(7).trim() : "";
    if (token.isEmpty()) return null;
    return identities().stream().filter(identity -> sameToken(identity.get("token"), token)).findFirst().orElse(null);
  }

  private Map<String, String> publicIdentity(Map<String, String> identity) {
    return Map.of(
      "userId", identity.get("userId"),
      "email", identity.get("email"),
      "role", identity.get("role")
    );
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
  protected void doFilterInternal(
      HttpServletRequest request,
      HttpServletResponse response,
      FilterChain filterChain) throws ServletException, IOException {
    String path = request.getRequestURI();
    response.setHeader("Access-Control-Allow-Origin", "http://localhost:5173");
    response.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    response.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
    if ("OPTIONS".equals(request.getMethod()) || "/api/health".equals(path) || !enabled()) {
      filterChain.doFilter(request, response);
      return;
    }
    List<Map<String, String>> configured = identities();
    if (configured.isEmpty()) {
      error(response, 503, "AUTH_NOT_CONFIGURED");
      return;
    }
    Map<String, String> identity = authenticate(request.getHeader("Authorization"));
    if (identity == null) {
      error(response, 401, "UNAUTHORIZED");
      return;
    }
    request.setAttribute(IDENTITY_ATTRIBUTE, publicIdentity(identity));
    if (!"/api/auth/me".equals(path)) {
      Map<String, String> resolved = resolveAction(request.getMethod(), path);
      if (resolved != null) {
        List<String> allowed = rules
          .getOrDefault(identity.get("role"), Map.of())
          .getOrDefault(resolved.get("entity"), List.of());
        if (!allowed.contains(resolved.get("action"))) {
          error(response, 403, "FORBIDDEN");
          return;
        }
      }
    }
    filterChain.doFilter(request, response);
  }
}
`),
    text('apps/api/src/main/java/dev/siteforge/api/AuthController.java', `package dev.siteforge.api;

import jakarta.servlet.http.HttpServletRequest;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@CrossOrigin(origins = "http://localhost:5173")
public class AuthController {
  @GetMapping("/api/auth/me")
  public Map<String, Object> me(HttpServletRequest request) {
    Map<String, Object> response = new LinkedHashMap<>();
    response.put("enabled", AuthFilter.enabled());
    response.put("identity", request.getAttribute(AuthFilter.IDENTITY_ATTRIBUTE));
    return response;
  }
}
`),
  ]
}
