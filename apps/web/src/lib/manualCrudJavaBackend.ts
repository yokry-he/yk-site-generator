import {
  relationIdField,
  toSnakeCase,
  type ArtifactFile,
  type ManualEntityDefinition,
  type ManualFieldDefinition,
} from 'shared'
import {
  entityByName,
  searchableFields,
  sortableNames,
  sqlOnDelete,
  tableName,
  text,
  upperFirst,
} from './manualCrudHelpers'

function javaType(field: ManualFieldDefinition): string {
  if (field.type === 'integer') return 'Integer'
  if (field.type === 'decimal') return 'BigDecimal'
  if (field.type === 'boolean') return 'Boolean'
  if (field.type === 'date') return 'LocalDate'
  if (field.type === 'datetime') return 'OffsetDateTime'
  return 'String'
}

function sqlType(field: ManualFieldDefinition): string {
  if (field.type === 'integer') return 'INTEGER'
  if (field.type === 'decimal') return 'NUMERIC'
  if (field.type === 'boolean') return 'BOOLEAN'
  if (field.type === 'date') return 'DATE'
  if (field.type === 'datetime') return 'TIMESTAMPTZ'
  return 'TEXT'
}

export function springCrudFiles(
  entities: readonly ManualEntityDefinition[],
): ArtifactFile[] {
  const files: ArtifactFile[] = []
  const sqlTables: string[] = []

  for (const entity of entities) {
    const fields = entity.fields.map((field) => `  @Column(name = "${toSnakeCase(field.name)}"${field.required ? ', nullable = false' : ''}${field.unique ? ', unique = true' : ''})\n  private ${javaType(field)} ${field.name};`)
    const relations = (entity.relations ?? []).map((relation) => `  @Column(name = "${toSnakeCase(relationIdField(relation))}"${relation.required ? ', nullable = false' : ''})\n  private Long ${relationIdField(relation)};`)
    const fieldAccessors = entity.fields.map((field) => `  public ${javaType(field)} get${upperFirst(field.name)}() { return ${field.name}; }\n  public void set${upperFirst(field.name)}(${javaType(field)} value) { this.${field.name} = value; }`)
    const relationAccessors = (entity.relations ?? []).map((relation) => `  public Long get${upperFirst(relationIdField(relation))}() { return ${relationIdField(relation)}; }\n  public void set${upperFirst(relationIdField(relation))}(Long value) { this.${relationIdField(relation)} = value; }`)
    const requestFields = [
      ...entity.fields.map((field) => `${javaType(field)} ${field.name}`),
      ...(entity.relations ?? []).map((relation) => `Long ${relationIdField(relation)}`),
    ]
    const setters = [
      ...entity.fields.map((field) => `    if (request.${field.name}() != null) item.set${upperFirst(field.name)}(request.${field.name}());`),
      ...(entity.relations ?? []).map((relation) => `    if (request.${relationIdField(relation)}() != null || !${relation.required}) item.set${upperFirst(relationIdField(relation))}(request.${relationIdField(relation)}());`),
    ]
    const searchable = searchableFields(entity)
    const searchPredicate = searchable.length
      ? `      return builder.or(${searchable.map((field) => `builder.like(builder.lower(root.get("${field.name}").as(String.class)), pattern)`).join(', ')});`
      : '      return builder.conjunction();'
    const allowedSort = sortableNames(entity).map((name) => `"${name}"`).join(', ')
    const defaults = entity.list!

    files.push(
      text(`apps/api/src/main/java/dev/siteforge/api/${entity.name}.java`, `package dev.siteforge.api;\n\nimport jakarta.persistence.*;\nimport java.math.BigDecimal;\nimport java.time.*;\n\n@Entity\n@Table(name = "${tableName(entity)}")\npublic class ${entity.name} {\n  @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;\n${[...fields, ...relations].join('\n')}\n  @Column(name = "created_at", nullable = false) private OffsetDateTime createdAt;\n  @Column(name = "updated_at", nullable = false) private OffsetDateTime updatedAt;\n  @PrePersist void createTimestamps() { createdAt = OffsetDateTime.now(); updatedAt = createdAt; }\n  @PreUpdate void updateTimestamp() { updatedAt = OffsetDateTime.now(); }\n  public Long getId() { return id; }\n${[...fieldAccessors, ...relationAccessors].join('\n')}\n  public OffsetDateTime getCreatedAt() { return createdAt; }\n  public OffsetDateTime getUpdatedAt() { return updatedAt; }\n}`),
      text(`apps/api/src/main/java/dev/siteforge/api/${entity.name}Repository.java`, `package dev.siteforge.api;\nimport org.springframework.data.jpa.repository.JpaRepository;\nimport org.springframework.data.jpa.repository.JpaSpecificationExecutor;\npublic interface ${entity.name}Repository extends JpaRepository<${entity.name}, Long>, JpaSpecificationExecutor<${entity.name}> {}`),
      text(`apps/api/src/main/java/dev/siteforge/api/${entity.name}Controller.java`, `package dev.siteforge.api;\n\nimport java.math.BigDecimal;\nimport java.time.*;\nimport java.util.LinkedHashMap;\nimport java.util.Map;\nimport java.util.Set;\nimport org.springframework.data.domain.Page;\nimport org.springframework.data.domain.PageRequest;\nimport org.springframework.data.domain.Sort;\nimport org.springframework.data.jpa.domain.Specification;\nimport org.springframework.http.HttpStatus;\nimport org.springframework.web.bind.annotation.*;\nimport org.springframework.web.server.ResponseStatusException;\n\n@RestController\n@RequestMapping("/api${entity.route}")\n@CrossOrigin(origins = "http://localhost:5173")\npublic class ${entity.name}Controller {\n  private final ${entity.name}Repository repository;\n  private static final Set<String> SORT_FIELDS = Set.of(${allowedSort});\n  public ${entity.name}Controller(${entity.name}Repository repository) { this.repository = repository; }\n  public record Request(${requestFields.join(', ')}) {}\n\n  @GetMapping\n  public Map<String, Object> list(\n      @RequestParam(defaultValue = "1") int page,\n      @RequestParam(defaultValue = "${defaults.pageSize}") int pageSize,\n      @RequestParam(defaultValue = "") String search,\n      @RequestParam(defaultValue = "${defaults.defaultSortField}") String sort,\n      @RequestParam(defaultValue = "${defaults.defaultSortDirection}") String order) {\n    int safePage = Math.max(1, page);\n    int safePageSize = Math.min(100, Math.max(1, pageSize));\n    String safeSort = SORT_FIELDS.contains(sort) ? sort : "${defaults.defaultSortField}";\n    Sort.Direction direction = "asc".equalsIgnoreCase(order) ? Sort.Direction.ASC : Sort.Direction.DESC;\n    Specification<${entity.name}> specification = (root, query, builder) -> {\n      if (search == null || search.isBlank()) return builder.conjunction();\n      String pattern = "%" + search.toLowerCase() + "%";\n${searchPredicate}\n    };\n    Page<${entity.name}> result = repository.findAll(specification, PageRequest.of(safePage - 1, safePageSize, Sort.by(direction, safeSort)));\n    Map<String, Object> response = new LinkedHashMap<>();\n    response.put("items", result.getContent());\n    response.put("total", result.getTotalElements());\n    response.put("page", safePage);\n    response.put("pageSize", safePageSize);\n    return response;\n  }\n\n  @GetMapping("/{id}") public ${entity.name} get(@PathVariable Long id) { return repository.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND)); }\n  @PostMapping @ResponseStatus(HttpStatus.CREATED) public ${entity.name} create(@RequestBody Request request) { return repository.save(apply(new ${entity.name}(), request)); }\n  @PatchMapping("/{id}") public ${entity.name} update(@PathVariable Long id, @RequestBody Request request) { return repository.save(apply(get(id), request)); }\n  @DeleteMapping("/{id}") @ResponseStatus(HttpStatus.NO_CONTENT) public void delete(@PathVariable Long id) { repository.delete(get(id)); }\n  private ${entity.name} apply(${entity.name} item, Request request) {\n${setters.join('\n')}\n    return item;\n  }\n}`),
    )

    const sqlFields = entity.fields.map((field) => `  ${toSnakeCase(field.name)} ${sqlType(field)}${field.required ? ' NOT NULL' : ''}${field.unique ? ' UNIQUE' : ''}`)
    const sqlRelations = (entity.relations ?? []).map((relation) => {
      const target = entityByName(entities, relation.targetEntity)
      return `  ${toSnakeCase(relationIdField(relation))} BIGINT${relation.required ? ' NOT NULL' : ''} REFERENCES ${tableName(target)}(id) ON DELETE ${sqlOnDelete(relation.onDelete)}`
    })
    sqlTables.push(`CREATE TABLE ${tableName(entity)} (\n  id BIGSERIAL PRIMARY KEY,\n${[...sqlFields, ...sqlRelations].join(',\n')},\n  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),\n  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()\n);`)
  }

  files.push(text('apps/api/src/main/resources/db/migration/V1__create_resources.sql', sqlTables.join('\n\n')))
  return files
}
