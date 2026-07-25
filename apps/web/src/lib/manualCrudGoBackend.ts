import {
  relationIdField,
  toSnakeCase,
  type ArtifactFile,
  type BackendDatabaseId,
  type ManualEntityDefinition,
  type ManualFieldDefinition,
} from 'shared'
import {
  entityByName,
  gormOnDelete,
  searchableFields,
  sortableNames,
  sqlOnDelete,
  tableName,
  text,
  upperFirst,
} from './manualCrudHelpers'

function goBaseType(field: ManualFieldDefinition): string {
  if (field.type === 'integer') return 'int'
  if (field.type === 'decimal') return 'float64'
  if (field.type === 'boolean') return 'bool'
  if (field.type === 'date' || field.type === 'datetime') return 'time.Time'
  return 'string'
}

function goType(field: ManualFieldDefinition): string {
  const type = goBaseType(field)
  return field.required ? type : `*${type}`
}

function sqlType(field: ManualFieldDefinition): string {
  if (field.type === 'integer') return 'INTEGER'
  if (field.type === 'decimal') return 'NUMERIC'
  if (field.type === 'boolean') return 'BOOLEAN'
  if (field.type === 'date') return 'DATE'
  if (field.type === 'datetime') return 'TIMESTAMP'
  return 'TEXT'
}

export function ginCrudFiles(
  database: BackendDatabaseId,
  entities: readonly ManualEntityDefinition[],
): ArtifactFile[] {
  const sqlite = database === 'sqlite'
  const structs = entities.map((entity) => {
    const fields = entity.fields.map((field) => {
      const tags = [
        `column:${toSnakeCase(field.name)}`,
        field.required ? 'not null' : '',
        field.unique ? 'uniqueIndex' : '',
      ].filter(Boolean).join(';')
      return `  ${upperFirst(field.name)} ${goType(field)} \`json:"${field.name}" gorm:"${tags}"\``
    })
    const relations = (entity.relations ?? []).flatMap((relation) => {
      const fieldName = relationIdField(relation)
      const idType = relation.required ? 'uint' : '*uint'
      const targetType = relation.required ? relation.targetEntity : `*${relation.targetEntity}`
      return [
        `  ${upperFirst(fieldName)} ${idType} \`json:"${fieldName}" gorm:"column:${toSnakeCase(fieldName)};index${relation.required ? ';not null' : ''}"\``,
        `  ${upperFirst(relation.name)} ${targetType} \`json:"-" gorm:"foreignKey:${upperFirst(fieldName)};constraint:OnUpdate:CASCADE,OnDelete:${gormOnDelete(relation.onDelete)};"\``,
      ]
    })
    return `type ${entity.name} struct {\n  ID uint \`json:"id" gorm:"primaryKey"\`\n${[...fields, ...relations].join('\n')}\n  CreatedAt time.Time \`json:"createdAt"\`\n  UpdatedAt time.Time \`json:"updatedAt"\`\n}`
  }).join('\n\n')

  const migrate = entities.map((entity) => `&${entity.name}{}`).join(', ')
  const migrationUp = entities.map((entity) => {
    const id = sqlite ? 'INTEGER PRIMARY KEY AUTOINCREMENT' : 'BIGSERIAL PRIMARY KEY'
    const fields = entity.fields.map((field) => `  ${toSnakeCase(field.name)} ${sqlType(field)}${field.required ? ' NOT NULL' : ''}${field.unique ? ' UNIQUE' : ''}`)
    const relations = (entity.relations ?? []).map((relation) => {
      const target = entityByName(entities, relation.targetEntity)
      return `  ${toSnakeCase(relationIdField(relation))} INTEGER${relation.required ? ' NOT NULL' : ''} REFERENCES ${tableName(target)}(id) ON DELETE ${sqlOnDelete(relation.onDelete)}`
    })
    return `CREATE TABLE ${tableName(entity)} (\n  id ${id},\n${[...fields, ...relations].join(',\n')},\n  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,\n  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP\n);`
  }).join('\n\n')
  const migrationDown = [...entities].reverse().map((entity) => `DROP TABLE IF EXISTS ${tableName(entity)};`).join('\n')

  const handlers = entities.map((entity) => {
    const route = entity.route.replace(/^\//, '')
    const defaults = entity.list!
    const sortMap = sortableNames(entity).map((name) => `    "${name}": "${toSnakeCase(name)}",`).join('\n')
    const search = searchableFields(entity)
    const searchBlock = search.length
      ? `  if search != "" {\n    pattern := "%" + strings.ToLower(search) + "%"\n    query = query.Where("${search.map((field) => `LOWER(${toSnakeCase(field.name)}) LIKE ?`).join(' OR ')}"${search.map(() => ', pattern').join('')})\n  }`
      : ''
    const updateMap = [
      ...entity.fields.map((field) => `    if value, ok := input["${field.name}"]; ok { updates["${toSnakeCase(field.name)}"] = value }`),
      ...(entity.relations ?? []).map((relation) => `    if value, ok := input["${relationIdField(relation)}"]; ok { updates["${toSnakeCase(relationIdField(relation))}"] = value }`),
    ].join('\n')
    return `func Register${entity.name}Routes(router *gin.Engine) {\n  group := router.Group("/api/${route}")\n  group.GET("", func(c *gin.Context) {\n    page, _ := strconv.Atoi(c.DefaultQuery("page", "1")); if page < 1 { page = 1 }\n    pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "${defaults.pageSize}")); if pageSize < 1 { pageSize = ${defaults.pageSize} }; if pageSize > 100 { pageSize = 100 }\n    search := strings.TrimSpace(c.Query("search"))\n    sortFields := map[string]string{\n${sortMap}\n    }\n    sortColumn, ok := sortFields[c.DefaultQuery("sort", "${defaults.defaultSortField}")]; if !ok { sortColumn = sortFields["${defaults.defaultSortField}"] }\n    order := strings.ToLower(c.DefaultQuery("order", "${defaults.defaultSortDirection}")); if order != "asc" { order = "desc" }\n    query := database.DB.Model(&database.${entity.name}{})\n${searchBlock}\n    var total int64; query.Count(&total)\n    var items []database.${entity.name}\n    query.Order(sortColumn + " " + order).Offset((page - 1) * pageSize).Limit(pageSize).Find(&items)\n    c.JSON(http.StatusOK, gin.H{"items": items, "total": total, "page": page, "pageSize": pageSize})\n  })\n  group.GET("/:id", func(c *gin.Context) { var item database.${entity.name}; if database.DB.First(&item, c.Param("id")).Error != nil { c.JSON(http.StatusNotFound, gin.H{"error":"NOT_FOUND"}); return }; c.JSON(http.StatusOK, item) })\n  group.POST("", func(c *gin.Context) { var item database.${entity.name}; if err := c.ShouldBindJSON(&item); err != nil { c.JSON(http.StatusBadRequest, gin.H{"error":err.Error()}); return }; if err := database.DB.Create(&item).Error; err != nil { c.JSON(http.StatusBadRequest, gin.H{"error":err.Error()}); return }; c.JSON(http.StatusCreated, item) })\n  group.PATCH("/:id", func(c *gin.Context) {\n    var item database.${entity.name}; if database.DB.First(&item, c.Param("id")).Error != nil { c.JSON(http.StatusNotFound, gin.H{"error":"NOT_FOUND"}); return }\n    var input map[string]any; if err := c.ShouldBindJSON(&input); err != nil { c.JSON(http.StatusBadRequest, gin.H{"error":err.Error()}); return }\n    updates := map[string]any{}\n${updateMap}\n    if err := database.DB.Model(&item).Updates(updates).Error; err != nil { c.JSON(http.StatusBadRequest, gin.H{"error":err.Error()}); return }\n    database.DB.First(&item, item.ID); c.JSON(http.StatusOK, item)\n  })\n  group.DELETE("/:id", func(c *gin.Context) { var item database.${entity.name}; if database.DB.First(&item, c.Param("id")).Error != nil { c.JSON(http.StatusNotFound, gin.H{"error":"NOT_FOUND"}); return }; if err := database.DB.Delete(&item).Error; err != nil { c.JSON(http.StatusConflict, gin.H{"error":err.Error()}); return }; c.Status(http.StatusNoContent) })\n}`
  }).join('\n\n')
  const routeRegisters = entities.map((entity) => `handlers.Register${entity.name}Routes(router)`).join('\n  ')

  return [
    text('apps/api/internal/database/models.go', `package database\n\nimport "time"\n\n${structs}`),
    text('apps/api/internal/database/database.go', `package database\n\nimport (\n  "os"\n  "gorm.io/driver/${sqlite ? 'sqlite' : 'postgres'}"\n  "gorm.io/gorm"\n)\nvar DB *gorm.DB\nfunc Connect() {\n  url := os.Getenv("DATABASE_URL"); if url == "" { url = "${sqlite ? 'data/app.db' : 'postgresql://siteforge:siteforge@localhost:5432/siteforge_app'}" }\n  db, err := gorm.Open(${sqlite ? 'sqlite.Open(url)' : 'postgres.Open(url)'}, &gorm.Config{}); if err != nil { panic(err) }\n  if err := db.AutoMigrate(${migrate}); err != nil { panic(err) }; DB = db\n}`),
    text('apps/api/internal/handlers/resources.go', `package handlers\n\nimport (\n  "net/http"\n  "strconv"\n  "strings"\n  "github.com/gin-gonic/gin"\n  "siteforge.dev/api/internal/database"\n)\n\n${handlers}`),
    text('apps/api/migrations/00001_create_tasks.sql', `-- +goose Up\n${migrationUp}\n\n-- +goose Down\n${migrationDown}`),
    text('apps/api/cmd/api/main.go', `package main\n\nimport (\n  "net/http"\n  "os"\n  "github.com/gin-gonic/gin"\n  "siteforge.dev/api/internal/database"\n  "siteforge.dev/api/internal/handlers"\n)\nfunc main() {\n  database.Connect()\n  router := gin.Default()\n  router.Use(func(c *gin.Context) { c.Header("Access-Control-Allow-Origin", "http://localhost:5173"); c.Header("Access-Control-Allow-Headers", "Content-Type"); c.Header("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS"); if c.Request.Method == http.MethodOptions { c.AbortWithStatus(http.StatusNoContent); return }; c.Next() })\n  router.GET("/api/health", func(c *gin.Context) { c.JSON(http.StatusOK, gin.H{"status":"ok", "stack":"Gin + GORM"}) })\n  ${routeRegisters}\n  port := os.Getenv("API_PORT"); if port == "" { port = "8787" }; _ = router.Run(":" + port)\n}`),
  ]
}
