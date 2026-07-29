import type { ArtifactFile, BackendDatabaseId, ManualAccessDefinition, ManualEntityDefinition } from 'shared'
import { replaceFile } from './manualAuthCommon'
import { text } from './manualCrudHelpers'
import { sessionBootstrapRole } from './manualSessionRuntimeCommon'
import { AUDIT_RETENTION_DAYS, LOGIN_LOCKOUT_SECONDS, LOGIN_WINDOW_SECONDS, MAX_LOGIN_ATTEMPTS, SESSION_RETENTION_DAYS } from './manualSessionProtectionCommon'

export function ginProtection(files: ArtifactFile[], access: ManualAccessDefinition, entities: readonly ManualEntityDefinition[], database: BackendDatabaseId): ArtifactFile[] {
  const role = JSON.stringify(sessionBootstrapRole(access, entities))
  replaceFile(files, 'apps/api/internal/database/models.go', (content) => `${content.trimEnd()}

type AuthLoginEvent struct {
  ID uint \`json:"id" gorm:"primaryKey"\`
  PrincipalHash string \`json:"-" gorm:"column:principal_hash;index:auth_login_events_principal_created_idx,priority:1;not null"\`
  NetworkHash string \`json:"-" gorm:"column:network_hash;index:auth_login_events_network_created_idx,priority:1;not null"\`
  Outcome string \`json:"outcome" gorm:"column:outcome;not null"\`
  CreatedAt time.Time \`json:"createdAt" gorm:"index:auth_login_events_principal_created_idx,priority:2;index:auth_login_events_network_created_idx,priority:2;index"\`
}
func (AuthLoginEvent) TableName() string { return "auth_login_events" }
`)
  replaceFile(files, 'apps/api/internal/database/database.go', (content) => content.replace('&AuthUser{}, &AuthSession{}', '&AuthUser{}, &AuthSession{}, &AuthLoginEvent{}'))
  replaceFile(files, 'apps/api/internal/auth/auth.go', (content) => content
    .replace('"siteforge.dev/api/internal/database"', '"siteforge.dev/api/internal/database"')
    .replace('func login(c *gin.Context) {\n', 'func login(c *gin.Context) {\n')
    .replace(
      '  var user database.AuthUser\n  if err :=',
      '  network := clientNetwork(c)\n  if retry := loginGate(strings.ToLower(strings.TrimSpace(input.Email)), network); retry > 0 { auditLogin(strings.ToLower(strings.TrimSpace(input.Email)), network, "rate_limited"); c.Header("Retry-After", strconv.Itoa(retry)); c.JSON(http.StatusTooManyRequests, gin.H{"error":"LOGIN_RATE_LIMITED", "retryAfterSeconds":retry}); return }\n  var user database.AuthUser\n  if err :=',
    )
    .replace(
      '    c.JSON(http.StatusUnauthorized, gin.H{"error":"INVALID_CREDENTIALS"}); return\n  }\n  token, expiresAt, err := issueSession',
      '    auditLogin(strings.ToLower(strings.TrimSpace(input.Email)), network, "failure")\n    c.JSON(http.StatusUnauthorized, gin.H{"error":"INVALID_CREDENTIALS"}); return\n  }\n  token, expiresAt, err := issueSession',
    )
    .replace(
      '  if err != nil { c.JSON(http.StatusInternalServerError, gin.H{"error":"INTERNAL_ERROR"}); return }\n  c.JSON(http.StatusOK, gin.H{"token":token',
      '  if err != nil { c.JSON(http.StatusInternalServerError, gin.H{"error":"INTERNAL_ERROR"}); return }\n  auditLogin(strings.ToLower(strings.TrimSpace(input.Email)), network, "success")\n  go cleanupSecurityData(false)\n  c.JSON(http.StatusOK, gin.H{"token":token',
    )
    .replace(
      '  router.POST("/api/auth/revoke-all", revokeAll)',
      '  router.POST("/api/auth/maintenance/cleanup", maintenanceCleanup)\n  router.POST("/api/auth/revoke-all", revokeAll)',
    )
    .replace(
      'func revokeAll(c *gin.Context) {',
      `func maintenanceCleanup(c *gin.Context) {
  identity, ok := IdentityFrom(c)
  if !ok || identity.Role != ${role} { c.JSON(http.StatusForbidden, gin.H{"error":"FORBIDDEN"}); return }
  c.JSON(http.StatusOK, cleanupSecurityData(true))
}

func revokeAll(c *gin.Context) {`,
    ))
  return [
    text('apps/api/internal/auth/protection.go', `package auth

import (
  "crypto/hmac"
  "crypto/rand"
  "crypto/sha256"
  "encoding/hex"
  "encoding/json"
  "log"
  "net"
  "os"
  "strconv"
  "strings"
  "sync"
  "time"
  "github.com/gin-gonic/gin"
  "siteforge.dev/api/internal/database"
)
type attemptState struct { Failures []time.Time; LockedUntil time.Time }
var protection struct { sync.Mutex; Attempts map[string]*attemptState; Key []byte; LastCleanup time.Time }
func init(){ protection.Attempts = map[string]*attemptState{} }
func intEnv(name string, fallback int) int { value, err := strconv.Atoi(os.Getenv(name)); if err == nil && value > 0 { return value }; return fallback }
func auditKey() []byte { protection.Lock(); defer protection.Unlock(); raw := os.Getenv("AUTH_AUDIT_HASH_KEY"); lower := strings.ToLower(raw); if len(raw) >= 32 && !strings.Contains(lower,"replace-with") && !strings.Contains(lower,"changeme") && !strings.Contains(lower,"example") { return []byte(raw) }; if protection.Key == nil { protection.Key = make([]byte,32); _,_ = rand.Read(protection.Key); log.Print("AUTH_AUDIT_HASH_KEY is not configured; audit hashes rotate when this process restarts") }; return protection.Key }
func auditDigest(scope,value string) string { mac := hmac.New(sha256.New,auditKey()); mac.Write([]byte(scope+"\\x00"+value)); return hex.EncodeToString(mac.Sum(nil)) }
func clientNetwork(c *gin.Context) string { trusted := strings.ToLower(os.Getenv("AUTH_TRUST_PROXY")); if trusted=="1"||trusted=="true"||trusted=="yes"||trusted=="on" { return strings.TrimSpace(strings.Split(c.GetHeader("X-Forwarded-For"),",")[0]) }; host,_,err:=net.SplitHostPort(c.Request.RemoteAddr); if err==nil{return host}; return c.Request.RemoteAddr }
func protectionKeys(email,network string) []string { result:=[]string{auditDigest("principal",email)}; if network!="" { result=append(result,auditDigest("network",network)) }; return result }
func loginGate(email,network string) int { now:=time.Now(); window:=time.Duration(intEnv("AUTH_LOGIN_WINDOW_SECONDS",${LOGIN_WINDOW_SECONDS}))*time.Second; lockout:=time.Duration(intEnv("AUTH_LOGIN_LOCKOUT_SECONDS",${LOGIN_LOCKOUT_SECONDS}))*time.Second; maximum:=intEnv("AUTH_MAX_LOGIN_ATTEMPTS",${MAX_LOGIN_ATTEMPTS}); retry:=0; itemKeys:=protectionKeys(email,network); protection.Lock(); defer protection.Unlock(); for _,key:=range itemKeys{ state:=protection.Attempts[key]; if state==nil { state=&attemptState{}; protection.Attempts[key]=state }; filtered:=state.Failures[:0]; for _,stamp:=range state.Failures { if stamp.After(now.Add(-window)){ filtered=append(filtered,stamp) } }; state.Failures=filtered; if state.LockedUntil.After(now){ seconds:=int(time.Until(state.LockedUntil).Seconds())+1; if seconds>retry{retry=seconds} } else if len(state.Failures)>=maximum { state.LockedUntil=now.Add(lockout); seconds:=int(lockout.Seconds()); if seconds>retry{retry=seconds} } }; return retry }
func auditLogin(email,network,outcome string){ now:=time.Now().UTC(); itemKeys:=protectionKeys(email,network); protection.Lock(); if outcome=="failure"{ for _,key:=range itemKeys{ state:=protection.Attempts[key]; if state==nil{state=&attemptState{};protection.Attempts[key]=state}; state.Failures=append(state.Failures,now) } } else if outcome=="success"{ for _,key:=range itemKeys{delete(protection.Attempts,key)} }; protection.Unlock(); principalHash:=auditDigest("principal",email); networkHash:=""; if network!=""{networkHash=auditDigest("network",network)}; database.DB.Create(&database.AuthLoginEvent{PrincipalHash:principalHash,NetworkHash:networkHash,Outcome:outcome,CreatedAt:now}); value,_:=json.Marshal(map[string]any{"event":"auth.login","outcome":outcome,"principalHash":principalHash,"networkHash":networkHash,"at":now.Format(time.RFC3339)}); log.Print(string(value)) }
func cleanupSecurityData(force bool) map[string]any { protection.Lock(); if !force && time.Since(protection.LastCleanup)<time.Hour { protection.Unlock(); return map[string]any{"completed":true,"skipped":true} }; protection.LastCleanup=time.Now(); protection.Unlock(); auditCutoff:=time.Now().UTC().AddDate(0,0,-intEnv("AUTH_AUDIT_RETENTION_DAYS",${AUDIT_RETENTION_DAYS})); sessionCutoff:=time.Now().UTC().AddDate(0,0,-intEnv("AUTH_SESSION_RETENTION_DAYS",${SESSION_RETENTION_DAYS})); events:=database.DB.Where("created_at < ?",auditCutoff).Delete(&database.AuthLoginEvent{}); sessions:=database.DB.Where("expires_at < ? OR (revoked_at IS NOT NULL AND revoked_at < ?)",sessionCutoff,sessionCutoff).Delete(&database.AuthSession{}); return map[string]any{"completed":true,"loginEventsDeleted":events.RowsAffected,"sessionsDeleted":sessions.RowsAffected} }
`),
    text('apps/api/migrations/00003_auth_login_events.sql', `-- +goose Up
CREATE TABLE auth_login_events (
  id ${database === 'sqlite' ? 'INTEGER PRIMARY KEY AUTOINCREMENT' : 'BIGSERIAL PRIMARY KEY'},
  principal_hash TEXT NOT NULL,
  network_hash TEXT NOT NULL,
  outcome TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX auth_login_events_principal_created_idx ON auth_login_events(principal_hash, created_at);
CREATE INDEX auth_login_events_network_created_idx ON auth_login_events(network_hash, created_at);
CREATE INDEX auth_login_events_created_idx ON auth_login_events(created_at);
-- +goose Down
DROP TABLE IF EXISTS auth_login_events;`),
  ]
}

