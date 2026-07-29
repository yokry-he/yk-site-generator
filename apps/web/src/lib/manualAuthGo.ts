import type { ArtifactFile, ManualAccessDefinition, ManualEntityDefinition } from 'shared'
import { text } from './manualCrudHelpers'
import { replaceFile, runtimeRules, runtimeTargets } from './manualAuthCommon'

export function ginAuth(
  files: ArtifactFile[],
  access: ManualAccessDefinition,
  entities: readonly ManualEntityDefinition[],
): ArtifactFile[] {
  const rules = runtimeRules(access)
  const targets = runtimeTargets(entities)
  const ruleLiteral = Object.entries(rules).map(([role, resources]) => {
    const resourceLiteral = Object.entries(resources).map(([entity, actions]) => {
      const actionLiteral = actions.map((action) => `${JSON.stringify(action)}: true`).join(', ')
      return `${JSON.stringify(entity)}: {${actionLiteral}}`
    }).join(', ')
    return `${JSON.stringify(role)}: {${resourceLiteral}}`
  }).join(',\n  ')
  const targetLiteral = targets.map((target) => `{Entity: ${JSON.stringify(target.entity)}, Route: ${JSON.stringify(target.route)}}`).join(',\n  ')

  replaceFile(files, 'apps/api/cmd/api/main.go', (content) => content
    .replace(
      '"siteforge.dev/api/internal/database"',
      '"siteforge.dev/api/internal/auth"\n  "siteforge.dev/api/internal/database"',
    )
    .replace(
      'c.Header("Access-Control-Allow-Headers", "Content-Type")',
      'c.Header("Access-Control-Allow-Headers", "Content-Type, Authorization")',
    )
    .replace(
      'router.GET("/api/health", func(c *gin.Context) { c.JSON(http.StatusOK, gin.H{"status":"ok", "stack":"Gin + GORM"}) })',
      'router.Use(auth.Middleware())\n  router.GET("/api/health", func(c *gin.Context) { c.JSON(http.StatusOK, gin.H{"status":"ok", "stack":"Gin + GORM"}) })\n  router.GET("/api/auth/me", func(c *gin.Context) { identity, ok := auth.IdentityFrom(c); if !ok { c.JSON(http.StatusOK, gin.H{"enabled":auth.Enabled(), "identity":nil}); return }; c.JSON(http.StatusOK, gin.H{"enabled":auth.Enabled(), "identity":identity}) })',
    ))

  return [text('apps/api/internal/auth/auth.go', `package auth

import (
  "crypto/sha256"
  "crypto/subtle"
  "encoding/json"
  "net/http"
  "os"
  "strings"
  "sync"

  "github.com/gin-gonic/gin"
)

type Identity struct {
  Token string \`json:"token"\`
  UserID string \`json:"userId"\`
  Email string \`json:"email"\`
  Role string \`json:"role"\`
}

type PublicIdentity struct {
  UserID string \`json:"userId"\`
  Email string \`json:"email"\`
  Role string \`json:"role"\`
}

type target struct {
  Entity string
  Route string
}

var rules = map[string]map[string]map[string]bool{
  ${ruleLiteral},
}
var targets = []target{
  ${targetLiteral},
}
var cache struct {
  sync.Mutex
  raw string
  identities []Identity
}

func Enabled() bool {
  value := strings.ToLower(os.Getenv("AUTH_ENABLED"))
  return value == "1" || value == "true" || value == "yes" || value == "on"
}

func configuredIdentities() []Identity {
  raw := os.Getenv("AUTH_IDENTITIES_JSON")
  cache.Lock()
  defer cache.Unlock()
  if raw == cache.raw {
    return cache.identities
  }
  cache.raw = raw
  var values []Identity
  if err := json.Unmarshal([]byte(raw), &values); err != nil {
    cache.identities = nil
    return nil
  }
  valid := make([]Identity, 0, len(values))
  for _, identity := range values {
    if _, roleExists := rules[identity.Role]; len(identity.Token) >= 16 && identity.UserID != "" && identity.Email != "" && roleExists {
      valid = append(valid, identity)
    }
  }
  cache.identities = valid
  return cache.identities
}

func sameToken(left, right string) bool {
  leftDigest := sha256.Sum256([]byte(left))
  rightDigest := sha256.Sum256([]byte(right))
  return subtle.ConstantTimeCompare(leftDigest[:], rightDigest[:]) == 1
}

func authenticate(header string) (Identity, bool) {
  token := ""
  if strings.HasPrefix(header, "Bearer ") {
    token = strings.TrimSpace(strings.TrimPrefix(header, "Bearer "))
  }
  for _, identity := range configuredIdentities() {
    if token != "" && sameToken(identity.Token, token) {
      return identity, true
    }
  }
  return Identity{}, false
}

func resolveAction(method, path string) (string, string, bool) {
  for _, item := range targets {
    if path != item.Route && !strings.HasPrefix(path, item.Route+"/") {
      continue
    }
    detail := path != item.Route
    if method == http.MethodGet {
      if detail { return item.Entity, "read", true }
      return item.Entity, "list", true
    }
    if method == http.MethodPost && !detail { return item.Entity, "create", true }
    if (method == http.MethodPatch || method == http.MethodPut) && detail { return item.Entity, "update", true }
    if method == http.MethodDelete && detail { return item.Entity, "delete", true }
  }
  return "", "", false
}

func IdentityFrom(c *gin.Context) (*PublicIdentity, bool) {
  value, exists := c.Get("siteforge.identity")
  identity, ok := value.(PublicIdentity)
  return &identity, exists && ok
}

func Middleware() gin.HandlerFunc {
  return func(c *gin.Context) {
    path := c.Request.URL.Path
    if c.Request.Method == http.MethodOptions || path == "/api/health" || !Enabled() {
      c.Next()
      return
    }
    if len(configuredIdentities()) == 0 {
      c.AbortWithStatusJSON(http.StatusServiceUnavailable, gin.H{"error":"AUTH_NOT_CONFIGURED"})
      return
    }
    identity, ok := authenticate(c.GetHeader("Authorization"))
    if !ok {
      c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error":"UNAUTHORIZED"})
      return
    }
    public := PublicIdentity{UserID: identity.UserID, Email: identity.Email, Role: identity.Role}
    c.Set("siteforge.identity", public)
    if path != "/api/auth/me" {
      entity, action, resolved := resolveAction(c.Request.Method, path)
      if resolved && !rules[identity.Role][entity][action] {
        c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error":"FORBIDDEN"})
        return
      }
    }
    c.Next()
  }
}
`)]
}
