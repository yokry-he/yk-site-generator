import {
  relationIdField,
  toSnakeCase,
  type ArtifactFile,
  type ManualEntityDefinition,
  type ManualFieldDefinition,
  type ManualRelationDefinition,
} from 'shared'
import {
  entityByName,
  searchableFields,
  sortableNames,
  sqlOnDelete,
  tableName,
  text,
} from './manualCrudHelpers'

function pythonType(field: ManualFieldDefinition): string {
  const type = field.type === 'integer'
    ? 'int'
    : field.type === 'decimal'
      ? 'float'
      : field.type === 'boolean'
        ? 'bool'
        : field.type === 'date'
          ? 'date'
          : field.type === 'datetime'
            ? 'datetime'
            : 'str'
  return field.required ? type : `${type} | None`
}

function sqlalchemyType(field: ManualFieldDefinition): string {
  if (field.type === 'integer') return 'Integer'
  if (field.type === 'decimal') return 'Float'
  if (field.type === 'boolean') return 'Boolean'
  if (field.type === 'date') return 'Date'
  if (field.type === 'datetime') return 'DateTime(timezone=True)'
  return 'Text'
}

function sqlalchemyColumn(field: ManualFieldDefinition): string {
  return `    ${field.name}: Mapped[${pythonType(field)}] = mapped_column(${sqlalchemyType(field)}, nullable=${field.required ? 'False' : 'True'}${field.unique ? ', unique=True' : ''})`
}

function sqlalchemyRelationColumn(
  relation: ManualRelationDefinition,
  entities: readonly ManualEntityDefinition[],
): string {
  const target = entityByName(entities, relation.targetEntity)
  const fieldName = relationIdField(relation)
  const type = relation.required ? 'int' : 'int | None'
  return `    ${fieldName}: Mapped[${type}] = mapped_column("${toSnakeCase(fieldName)}", ForeignKey("${tableName(target)}.id", ondelete="${sqlOnDelete(relation.onDelete)}"), nullable=${relation.required ? 'False' : 'True'}, index=True)`
}

function pydanticRelationType(relation: ManualRelationDefinition): string {
  return relation.required ? 'int' : 'int | None'
}

function alembicColumn(field: ManualFieldDefinition): string {
  const type = field.type === 'integer'
    ? 'sa.Integer()'
    : field.type === 'decimal'
      ? 'sa.Float()'
      : field.type === 'boolean'
        ? 'sa.Boolean()'
        : field.type === 'date'
          ? 'sa.Date()'
          : field.type === 'datetime'
            ? 'sa.DateTime(timezone=True)'
            : 'sa.Text()'
  return `        sa.Column("${toSnakeCase(field.name)}", ${type}, nullable=${field.required ? 'False' : 'True'}${field.unique ? ', unique=True' : ''}),`
}

function migrationFile(entities: readonly ManualEntityDefinition[]): ArtifactFile {
  const upgrades = entities.map((entity) => {
    const fieldColumns = entity.fields.map(alembicColumn)
    const relationColumns = (entity.relations ?? []).map((relation) => {
      const fieldName = relationIdField(relation)
      return `        sa.Column("${toSnakeCase(fieldName)}", sa.Integer(), nullable=${relation.required ? 'False' : 'True'}),`
    })
    const foreignKeys = (entity.relations ?? []).map((relation) => {
      const target = entityByName(entities, relation.targetEntity)
      const fieldName = relationIdField(relation)
      return `        sa.ForeignKeyConstraint(["${toSnakeCase(fieldName)}"], ["${tableName(target)}.id"], ondelete="${sqlOnDelete(relation.onDelete)}"),`
    })
    return `    op.create_table(\n        "${tableName(entity)}",\n        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),\n${[...fieldColumns, ...relationColumns].join('\n')}\n        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),\n        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),\n${foreignKeys.join('\n')}\n    )`
  }).join('\n\n')
  const downgrades = [...entities].reverse().map((entity) => `    op.drop_table("${tableName(entity)}")`).join('\n')
  return text('apps/api/migrations/versions/0001_create_resources.py', `"""create SiteForge resources"""\nfrom alembic import op\nimport sqlalchemy as sa\n\nrevision = "0001"\ndown_revision = None\nbranch_labels = None\ndepends_on = None\n\ndef upgrade() -> None:\n${upgrades}\n\ndef downgrade() -> None:\n${downgrades}`)
}

export function fastApiCrudFiles(
  entities: readonly ManualEntityDefinition[],
): ArtifactFile[] {
  const modelClasses = entities.map((entity) => `class ${entity.name}(Base):\n    __tablename__ = "${tableName(entity)}"\n    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)\n${[
    ...entity.fields.map(sqlalchemyColumn),
    ...(entity.relations ?? []).map((relation) => sqlalchemyRelationColumn(relation, entities)),
  ].join('\n')}\n    createdAt: Mapped[datetime] = mapped_column("created_at", DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))\n    updatedAt: Mapped[datetime] = mapped_column("updated_at", DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))`).join('\n\n')

  const schemaClasses = entities.map((entity) => {
    const createFields = [
      ...entity.fields.map((field) => `    ${field.name}: ${pythonType(field)}${field.required ? '' : ' = None'}`),
      ...(entity.relations ?? []).map((relation) => `    ${relationIdField(relation)}: ${pydanticRelationType(relation)}${relation.required ? '' : ' = None'}`),
    ]
    const updateFields = [
      ...entity.fields.map((field) => `    ${field.name}: ${pythonType({ ...field, required: false })} = None`),
      ...(entity.relations ?? []).map((relation) => `    ${relationIdField(relation)}: int | None = None`),
    ]
    return `class ${entity.name}Create(BaseModel):\n${createFields.join('\n')}\n\nclass ${entity.name}Update(BaseModel):\n${updateFields.join('\n')}\n\nclass ${entity.name}Read(${entity.name}Create):\n    id: int\n    createdAt: datetime\n    updatedAt: datetime\n    model_config = ConfigDict(from_attributes=True)`
  }).join('\n\n')

  const routeBlocks = entities.map((entity) => {
    const variable = entity.name[0].toLowerCase() + entity.name.slice(1)
    const searchFields = searchableFields(entity)
    const condition = searchFields.length
      ? `or_(${searchFields.map((field) => `models.${entity.name}.${field.name}.ilike(pattern)`).join(', ')})`
      : 'None'
    const sortMap = sortableNames(entity).map((name) => `        "${name}": models.${entity.name}.${name},`).join('\n')
    const defaults = entity.list!
    return `@router.get("${entity.route}")\ndef list_${variable}(\n    page: int = Query(1, ge=1),\n    pageSize: int = Query(${defaults.pageSize}, ge=1, le=100),\n    search: str = "",\n    sort: str = "${defaults.defaultSortField}",\n    order: str = "${defaults.defaultSortDirection}",\n    db: Session = Depends(get_db),\n):\n    sort_columns = {\n${sortMap}\n    }\n    sort_column = sort_columns.get(sort, sort_columns["${defaults.defaultSortField}"])\n    direction = sort_column.asc() if order == "asc" else sort_column.desc()\n    statement = select(models.${entity.name})\n    count_statement = select(func.count()).select_from(models.${entity.name})\n    if search.strip():\n        pattern = "%" + search.strip() + "%"\n        condition = ${condition}\n        if condition is not None:\n            statement = statement.where(condition)\n            count_statement = count_statement.where(condition)\n    items = db.scalars(statement.order_by(direction).offset((page - 1) * pageSize).limit(pageSize)).all()\n    total = int(db.scalar(count_statement) or 0)\n    return {"items": [schemas.${entity.name}Read.model_validate(item) for item in items], "total": total, "page": page, "pageSize": pageSize}\n\n@router.get("${entity.route}/{item_id}", response_model=schemas.${entity.name}Read)\ndef get_${variable}(item_id: int, db: Session = Depends(get_db)):\n    item = db.get(models.${entity.name}, item_id)\n    if item is None: raise HTTPException(status_code=404, detail="Not found")\n    return item\n\n@router.post("${entity.route}", response_model=schemas.${entity.name}Read, status_code=201)\ndef create_${variable}(payload: schemas.${entity.name}Create, db: Session = Depends(get_db)):\n    item = models.${entity.name}(**payload.model_dump())\n    db.add(item); db.commit(); db.refresh(item); return item\n\n@router.patch("${entity.route}/{item_id}", response_model=schemas.${entity.name}Read)\ndef update_${variable}(item_id: int, payload: schemas.${entity.name}Update, db: Session = Depends(get_db)):\n    item = db.get(models.${entity.name}, item_id)\n    if item is None: raise HTTPException(status_code=404, detail="Not found")\n    for key, value in payload.model_dump(exclude_unset=True).items(): setattr(item, key, value)\n    db.commit(); db.refresh(item); return item\n\n@router.delete("${entity.route}/{item_id}", status_code=204)\ndef delete_${variable}(item_id: int, db: Session = Depends(get_db)):\n    item = db.get(models.${entity.name}, item_id)\n    if item is None: raise HTTPException(status_code=404, detail="Not found")\n    db.delete(item); db.commit()`
  }).join('\n\n')

  return [
    text('apps/api/app/models.py', `from datetime import datetime, timezone\nfrom sqlalchemy import Boolean, Date, DateTime, Float, ForeignKey, Integer, Text\nfrom sqlalchemy.orm import Mapped, mapped_column\nfrom .database import Base\n\n${modelClasses}`),
    text('apps/api/app/schemas.py', `from datetime import date, datetime\nfrom pydantic import BaseModel, ConfigDict\n\n${schemaClasses}`),
    text('apps/api/app/routes.py', `from fastapi import APIRouter, Depends, HTTPException, Query\nfrom sqlalchemy import func, or_, select\nfrom sqlalchemy.orm import Session\nfrom . import models, schemas\nfrom .database import SessionLocal\n\nrouter = APIRouter(prefix="/api")\n\ndef get_db():\n    db = SessionLocal()\n    try: yield db\n    finally: db.close()\n\n${routeBlocks}`),
    text('apps/api/app/main.py', `from fastapi import FastAPI\nfrom fastapi.middleware.cors import CORSMiddleware\nfrom .routes import router\n\napp = FastAPI(title="SiteForge CRUD API")\napp.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5173"], allow_methods=["*"], allow_headers=["*"])\napp.get("/api/health")(lambda: {"status": "ok", "stack": "FastAPI + SQLAlchemy"})\napp.include_router(router)`),
    text('apps/api/migrations/versions/__init__.py', ''),
    migrationFile(entities),
  ]
}
