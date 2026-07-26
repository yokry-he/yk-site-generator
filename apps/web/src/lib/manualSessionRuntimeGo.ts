import type {
  ArtifactFile,
  ManualAccessDefinition,
  ManualEntityDefinition,
} from 'shared'
import { replaceFile, runtimeRules, runtimeTargets } from './manualAuthCommon'
import { text } from './manualCrudHelpers'
import { sessionBootstrapRole } from './manualSessionRuntimeCommon'

export function ginSessionRuntime(
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
  const allowedRoles = access.roles.map((role) => `${JSON.stringify(role.key)}: true`).join(', ')
  const bootstrapRole = JSON.stringify(sessionBootstrapRole(access, entities))

  replaceFile(files, 'apps/api/cmd/api/main.go', (content) => content.replace(
    /router\.GET\("\/api\/auth\/me"[^\n]*\n/,
    'auth.RegisterRoutes(router)\n  ',
  ))

  replaceFile(files, 'apps/api/internal/auth/auth.go', () => `package auth

import (
  "crypto/hmac"
  "crypto/rand"
  "crypto/sha256"
  "crypto/subtle"
  "encoding/base64"
  "encoding/hex"
  "encoding/json"
  "net/http"
  "os"
  "strconv"
  "strings"
  "sync"
  "time"

  "github.com/gin-gonic/gin"
  "gorm.io/gorm"
  "siteforge.dev/api/internal/database"
)

type Identity struct {
  Token string \`json:"token"\`
  UserID string \`json:"userId"\`
  Email string \`json:"email"\`
  Role string \`json:"role"\`
}

type RuntimeIdentity struct {
  UserID string \`json:"userId"\`
  Email string \`json:"email"\`
  Role string \`json:"role"\`
  Source string \`json:"source"\`
  SessionID *uint \`json:"-"\`
  ExpiresAt *time.Time \`json:"expiresAt,omitempty"\`
}

type target struct { Entity string; Route string }
type loginInput struct { Email string \`json:"email"\`; Password string \`json:"password"\` }
type sessionRecord struct { SessionID uint; ExpiresAt time.Time; UserID uint; Email string; Role string; Disabled bool }

var rules = map[string]map[string]map[string]bool{
  ${ruleLiteral},
}
var targets = []target{
  ${targetLiteral},
}
var allowedRoles = map[string]bool{${allowedRoles}}
var publicPaths = map[string]bool{"/api/health": true, "/api/auth/bootstrap": true, "/api/auth/login": true}
var cache struct { sync.Mutex; raw string; identities []Identity }

const bootstrapRole = ${bootstrapRole}
const sessionTTLSeconds = ${access.session!.ttlSeconds}
const maxActiveSessions = ${access.session!.maxActiveSessions}

func Enabled() bool {
  value := strings.ToLower(os.Getenv("AUTH_ENABLED"))
  return value == "1" || value == "true" || value == "yes" || value == "on"
}

func staticIdentities() []Identity {
  raw := os.Getenv("AUTH_IDENTITIES_JSON")
  cache.Lock()
  defer cache.Unlock()
  if raw == cache.raw { return cache.identities }
  cache.raw = raw
  var values []Identity
  if err := json.Unmarshal([]byte(raw), &values); err != nil { cache.identities = nil; return nil }
  valid := make([]Identity, 0, len(values))
  for _, identity := range values {
    if len(identity.Token) >= 16 && identity.UserID != "" && identity.Email != "" && allowedRoles[identity.Role] { valid = append(valid, identity) }
  }
  cache.identities = valid
  return cache.identities
}

func tokenDigest(token string) string {
  value := sha256.Sum256([]byte(token))
  return hex.EncodeToString(value[:])
}

func sameToken(left, right string) bool {
  leftDigest := sha256.Sum256([]byte(left))
  rightDigest := sha256.Sum256([]byte(right))
  return subtle.ConstantTimeCompare(leftDigest[:], rightDigest[:]) == 1
}

func tokenFromHeader(header string) string {
  if strings.HasPrefix(header, "Bearer ") { return strings.TrimSpace(strings.TrimPrefix(header, "Bearer ")) }
  return ""
}

func authenticateStatic(token string) (*RuntimeIdentity, bool) {
  for _, identity := range staticIdentities() {
    if token != "" && sameToken(identity.Token, token) {
      return &RuntimeIdentity{UserID: identity.UserID, Email: identity.Email, Role: identity.Role, Source: "static"}, true
    }
  }
  return nil, false
}

func authenticateSession(token string) (*RuntimeIdentity, bool) {
  var row sessionRecord
  error := database.DB.Table("auth_sessions AS s").
    Select("s.id AS session_id, s.expires_at, u.id AS user_id, u.email, u.role, u.disabled").
    Joins("JOIN auth_users u ON u.id = s.user_id").
    Where("s.token_hash = ? AND s.revoked_at IS NULL AND s.expires_at > ?", tokenDigest(token), time.Now().UTC()).
    Scan(&row).Error
  if error != nil || row.SessionID == 0 || row.Disabled || !allowedRoles[row.Role] { return nil, false }
  database.DB.Model(&database.AuthSession{}).Where("id = ?", row.SessionID).Update("last_used_at", time.Now().UTC())
  sessionID := row.SessionID
  expiresAt := row.ExpiresAt
  return &RuntimeIdentity{UserID: strconv.FormatUint(uint64(row.UserID), 10), Email: row.Email, Role: row.Role, Source: "session", SessionID: &sessionID, ExpiresAt: &expiresAt}, true
}

func authenticate(header string) (*RuntimeIdentity, bool) {
  token := tokenFromHeader(header)
  if token == "" { return nil, false }
  if identity, ok := authenticateStatic(token); ok { return identity, true }
  return authenticateSession(token)
}

func hasConfiguredIdentity() bool {
  if len(staticIdentities()) > 0 { return true }
  var count int64
  database.DB.Model(&database.AuthUser{}).Count(&count)
  return count > 0
}

func resolveAction(method, path string) (string, string, bool) {
  for _, item := range targets {
    if path != item.Route && !strings.HasPrefix(path, item.Route+"/") { continue }
    detail := path != item.Route
    if method == http.MethodGet { if detail { return item.Entity, "read", true }; return item.Entity, "list", true }
    if method == http.MethodPost && !detail { return item.Entity, "create", true }
    if (method == http.MethodPatch || method == http.MethodPut) && detail { return item.Entity, "update", true }
    if method == http.MethodDelete && detail { return item.Entity, "delete", true }
  }
  return "", "", false
}

func IdentityFrom(c *gin.Context) (*RuntimeIdentity, bool) {
  value, exists := c.Get("siteforge.identity")
  identity, ok := value.(*RuntimeIdentity)
  return identity, exists && ok && identity != nil
}

func Middleware() gin.HandlerFunc {
  return func(c *gin.Context) {
    path := c.Request.URL.Path
    if c.Request.Method == http.MethodOptions || publicPaths[path] { c.Next(); return }
    identity, ok := authenticate(c.GetHeader("Authorization"))
    if !Enabled() { if ok { c.Set("siteforge.identity", identity) }; c.Next(); return }
    if !ok {
      if hasConfiguredIdentity() { c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error":"UNAUTHORIZED"}) } else { c.AbortWithStatusJSON(http.StatusServiceUnavailable, gin.H{"error":"AUTH_NOT_CONFIGURED"}) }
      return
    }
    c.Set("siteforge.identity", identity)
    entity, action, resolved := resolveAction(c.Request.Method, path)
    if resolved && !rules[identity.Role][entity][action] { c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error":"FORBIDDEN"}); return }
    c.Next()
  }
}

func RegisterRoutes(router *gin.Engine) {
  router.POST("/api/auth/bootstrap", bootstrap)
  router.POST("/api/auth/login", login)
  router.GET("/api/auth/me", me)
  router.POST("/api/auth/logout", logout)
  router.POST("/api/auth/rotate", rotate)
  router.POST("/api/auth/revoke-all", revokeAll)
}

func bootstrap(c *gin.Context) {
  email := strings.ToLower(strings.TrimSpace(os.Getenv("AUTH_BOOTSTRAP_EMAIL")))
  password := os.Getenv("AUTH_BOOTSTRAP_PASSWORD")
  lower := strings.ToLower(password)
  if !strings.Contains(email, "@") || len(password) < 12 || strings.Contains(lower, "replace-with") || strings.Contains(lower, "changeme") || strings.Contains(lower, "example") {
    c.JSON(http.StatusServiceUnavailable, gin.H{"error":"BOOTSTRAP_NOT_CONFIGURED"}); return
  }
  var count int64
  database.DB.Model(&database.AuthUser{}).Count(&count)
  if count > 0 { c.JSON(http.StatusConflict, gin.H{"error":"BOOTSTRAP_ALREADY_COMPLETED"}); return }
  user := database.AuthUser{Email: email, PasswordHash: passwordHash(password), Role: bootstrapRole, Disabled: false}
  if err := database.DB.Create(&user).Error; err != nil { c.JSON(http.StatusConflict, gin.H{"error":"CONSTRAINT_CONFLICT"}); return }
  c.JSON(http.StatusCreated, gin.H{"created":true, "identity":gin.H{"userId":strconv.FormatUint(uint64(user.ID), 10), "email":user.Email, "role":user.Role}})
}

func login(c *gin.Context) {
  var input loginInput
  if err := c.ShouldBindJSON(&input); err != nil || len(input.Password) < 12 { c.JSON(http.StatusUnauthorized, gin.H{"error":"INVALID_CREDENTIALS"}); return }
  var user database.AuthUser
  if err := database.DB.Where("email = ?", strings.ToLower(strings.TrimSpace(input.Email))).First(&user).Error; err != nil || user.Disabled || !allowedRoles[user.Role] || !verifyPassword(input.Password, user.PasswordHash) {
    c.JSON(http.StatusUnauthorized, gin.H{"error":"INVALID_CREDENTIALS"}); return
  }
  token, expiresAt, err := issueSession(user.ID, nil)
  if err != nil { c.JSON(http.StatusInternalServerError, gin.H{"error":"INTERNAL_ERROR"}); return }
  c.JSON(http.StatusOK, gin.H{"token":token, "expiresAt":expiresAt.Format(time.RFC3339), "identity":gin.H{"userId":strconv.FormatUint(uint64(user.ID), 10), "email":user.Email, "role":user.Role}})
}

func me(c *gin.Context) {
  identity, ok := IdentityFrom(c)
  if !ok { c.JSON(http.StatusOK, gin.H{"enabled":Enabled(), "identity":nil, "source":nil, "expiresAt":nil}); return }
  var expiresAt any = nil
  if identity.ExpiresAt != nil { expiresAt = identity.ExpiresAt.Format(time.RFC3339) }
  c.JSON(http.StatusOK, gin.H{"enabled":Enabled(), "identity":gin.H{"userId":identity.UserID, "email":identity.Email, "role":identity.Role}, "source":identity.Source, "expiresAt":expiresAt})
}

func logout(c *gin.Context) {
  identity, ok := IdentityFrom(c)
  if !ok || identity.SessionID == nil { c.JSON(http.StatusConflict, gin.H{"error":"SESSION_REQUIRED"}); return }
  database.DB.Model(&database.AuthSession{}).Where("id = ? AND revoked_at IS NULL", *identity.SessionID).Update("revoked_at", time.Now().UTC())
  c.Status(http.StatusNoContent)
}

func rotate(c *gin.Context) {
  identity, ok := IdentityFrom(c)
  if !ok || identity.SessionID == nil { c.JSON(http.StatusConflict, gin.H{"error":"SESSION_REQUIRED"}); return }
  userID, _ := strconv.ParseUint(identity.UserID, 10, 64)
  token, expiresAt, err := issueSession(uint(userID), identity.SessionID)
  if err != nil { c.JSON(http.StatusInternalServerError, gin.H{"error":"INTERNAL_ERROR"}); return }
  c.JSON(http.StatusOK, gin.H{"token":token, "expiresAt":expiresAt.Format(time.RFC3339), "identity":gin.H{"userId":identity.UserID, "email":identity.Email, "role":identity.Role}})
}

func revokeAll(c *gin.Context) {
  identity, ok := IdentityFrom(c)
  if !ok || identity.SessionID == nil { c.JSON(http.StatusConflict, gin.H{"error":"SESSION_REQUIRED"}); return }
  userID, _ := strconv.ParseUint(identity.UserID, 10, 64)
  database.DB.Model(&database.AuthSession{}).Where("user_id = ? AND revoked_at IS NULL", uint(userID)).Update("revoked_at", time.Now().UTC())
  c.Status(http.StatusNoContent)
}

func issueSession(userID uint, currentSessionID *uint) (string, time.Time, error) {
  token := make([]byte, 32)
  if _, err := rand.Read(token); err != nil { return "", time.Time{}, err }
  raw := base64.RawURLEncoding.EncodeToString(token)
  now := time.Now().UTC()
  expiresAt := now.Add(time.Duration(sessionTTLSeconds) * time.Second)
  error := database.DB.Transaction(func(tx *gorm.DB) error {
    if currentSessionID != nil { if err := tx.Model(&database.AuthSession{}).Where("id = ? AND revoked_at IS NULL", *currentSessionID).Update("revoked_at", now).Error; err != nil { return err } }
    var active []database.AuthSession
    if err := tx.Where("user_id = ? AND revoked_at IS NULL AND expires_at > ?", userID, now).Order("created_at ASC").Find(&active).Error; err != nil { return err }
    revokeCount := len(active) - maxActiveSessions + 1
    if revokeCount < 0 { revokeCount = 0 }
    for _, session := range active[:revokeCount] { if err := tx.Model(&database.AuthSession{}).Where("id = ?", session.ID).Update("revoked_at", now).Error; err != nil { return err } }
    session := database.AuthSession{TokenHash: tokenDigest(raw), UserID: userID, ExpiresAt: expiresAt, RevokedAt: nil, LastUsedAt: now, CreatedAt: now}
    return tx.Create(&session).Error
  })
  return raw, expiresAt, error
}

func passwordHash(password string) string {
  salt := make([]byte, 16)
  if _, err := rand.Read(salt); err != nil { panic(err) }
  derived := pbkdf2Key([]byte(password), salt, 600000, 32)
  return "pbkdf2_sha256$600000$" + hex.EncodeToString(salt) + "$" + hex.EncodeToString(derived)
}

func verifyPassword(password, stored string) bool {
  parts := strings.Split(stored, "$")
  if len(parts) != 4 || parts[0] != "pbkdf2_sha256" { return false }
  iterations, err := strconv.Atoi(parts[1]); if err != nil || iterations < 1 { return false }
  salt, err := hex.DecodeString(parts[2]); if err != nil { return false }
  expected, err := hex.DecodeString(parts[3]); if err != nil { return false }
  actual := pbkdf2Key([]byte(password), salt, iterations, len(expected))
  return subtle.ConstantTimeCompare(expected, actual) == 1
}

func pbkdf2Key(password, salt []byte, iterations, keyLength int) []byte {
  hashLength := 32
  blocks := (keyLength + hashLength - 1) / hashLength
  output := make([]byte, 0, blocks*hashLength)
  for block := 1; block <= blocks; block++ {
    counter := []byte{byte(block >> 24), byte(block >> 16), byte(block >> 8), byte(block)}
    mac := hmac.New(sha256.New, password)
    mac.Write(salt); mac.Write(counter)
    u := mac.Sum(nil)
    t := append([]byte(nil), u...)
    for index := 1; index < iterations; index++ {
      mac = hmac.New(sha256.New, password); mac.Write(u); u = mac.Sum(nil)
      for offset := range t { t[offset] ^= u[offset] }
    }
    output = append(output, t...)
  }
  return output[:keyLength]
}
`)
  return []
}
