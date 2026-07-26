import type { ArtifactFile, BackendStackId } from 'shared'
import { text } from './manualCrudHelpers'

function replaceFile(
  files: ArtifactFile[],
  path: string,
  transform: (content: string) => string,
): void {
  const file = files.find((item) => item.path === path)
  if (!file) throw new Error(`错误处理脚手架缺少目标文件：${path}`)
  file.content = transform(file.content)
}

function honoErrors(files: ArtifactFile[]): ArtifactFile[] {
  replaceFile(files, 'apps/api/src/index.ts', (content) => content
    .replace("import { z } from 'zod'", "import { ZodError, z } from 'zod'")
    .replace(
      'const app = new Hono()\n',
      `const app = new Hono()

function constraintConflict(error: unknown): boolean {
  const message = error instanceof Error ? error.name + ' ' + error.message : ''
  return /SQLITE_CONSTRAINT|constraint|foreign key|duplicate|unique|23503|23505/i.test(message)
}

app.onError((error, c) => {
  if (error instanceof ZodError) return c.json({ error: 'VALIDATION_ERROR' }, 400)
  if (constraintConflict(error)) return c.json({ error: 'CONSTRAINT_CONFLICT' }, 409)
  console.error('Unhandled API error type:', error instanceof Error ? error.name : 'Unknown')
  return c.json({ error: 'INTERNAL_ERROR' }, 500)
})
`,
    ))
  return []
}

function nestErrors(files: ArtifactFile[]): ArtifactFile[] {
  replaceFile(files, 'apps/api/src/main.ts', (content) => content
    .replace(
      "import { AppModule } from './app.module'",
      "import { AppModule } from './app.module'\nimport { ApiErrorFilter } from './api-error.filter'",
    )
    .replace(
      'const app = await NestFactory.create(AppModule)\n',
      'const app = await NestFactory.create(AppModule)\n  app.useGlobalFilters(new ApiErrorFilter())\n',
    ))

  return [text('apps/api/src/api-error.filter.ts', `import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
} from '@nestjs/common'
import { Prisma } from '@prisma/client'

interface JsonResponse {
  status(code: number): { json(body: unknown): void }
}

function structuredHttpBody(exception: HttpException): unknown {
  const status = exception.getStatus()
  const body = exception.getResponse()
  if (typeof body === 'object' && body !== null && 'error' in body) return body
  if (status === 400) return { error: 'VALIDATION_ERROR' }
  if (status === 404) return { error: 'NOT_FOUND' }
  return { error: 'HTTP_ERROR' }
}

@Catch()
export class ApiErrorFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<JsonResponse>()
    if (exception instanceof HttpException) {
      response.status(exception.getStatus()).json(structuredHttpBody(exception))
      return
    }
    if (exception instanceof Prisma.PrismaClientKnownRequestError && ['P2002', 'P2003', 'P2014'].includes(exception.code)) {
      response.status(409).json({ error: 'CONSTRAINT_CONFLICT' })
      return
    }
    console.error('Unhandled API error type:', exception instanceof Error ? exception.name : 'Unknown')
    response.status(500).json({ error: 'INTERNAL_ERROR' })
  }
}
`)]
}

function fastApiErrors(files: ArtifactFile[]): ArtifactFile[] {
  replaceFile(files, 'apps/api/app/main.py', (content) => content
    .replace(/^from fastapi import FastAPI(?:, Request)?$/m, 'from fastapi import FastAPI, Request')
    .replace(
      'from fastapi.middleware.cors import CORSMiddleware',
      'from fastapi.exceptions import RequestValidationError\nfrom fastapi.middleware.cors import CORSMiddleware\nfrom fastapi.responses import JSONResponse\nfrom sqlalchemy.exc import IntegrityError',
    )
    .replace(
      'app = FastAPI(title="SiteForge CRUD API")\n',
      `app = FastAPI(title="SiteForge CRUD API")

@app.exception_handler(RequestValidationError)
async def validation_error(_request: Request, _error: RequestValidationError):
    return JSONResponse({"error": "VALIDATION_ERROR"}, status_code=400)

@app.exception_handler(IntegrityError)
async def constraint_error(_request: Request, _error: IntegrityError):
    return JSONResponse({"error": "CONSTRAINT_CONFLICT"}, status_code=409)

@app.exception_handler(Exception)
async def internal_error(_request: Request, error: Exception):
    print("Unhandled API error type:", type(error).__name__)
    return JSONResponse({"error": "INTERNAL_ERROR"}, status_code=500)
`,
    ))
  return []
}

function springErrors(): ArtifactFile[] {
  return [text('apps/api/src/main/java/dev/siteforge/api/ApiExceptionHandler.java', `package dev.siteforge.api;

import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.server.ResponseStatusException;

@RestControllerAdvice
public class ApiExceptionHandler {
  private static final Logger LOGGER = LoggerFactory.getLogger(ApiExceptionHandler.class);

  @ExceptionHandler(DataIntegrityViolationException.class)
  public ResponseEntity<Map<String, String>> constraintConflict() {
    return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("error", "CONSTRAINT_CONFLICT"));
  }

  @ExceptionHandler({
      MethodArgumentNotValidException.class,
      HttpMessageNotReadableException.class,
      MethodArgumentTypeMismatchException.class
  })
  public ResponseEntity<Map<String, String>> validationError() {
    return ResponseEntity.badRequest().body(Map.of("error", "VALIDATION_ERROR"));
  }

  @ExceptionHandler(ResponseStatusException.class)
  public ResponseEntity<Map<String, String>> statusError(ResponseStatusException error) {
    String code = error.getStatusCode().value() == 404 ? "NOT_FOUND" : "HTTP_ERROR";
    return ResponseEntity.status(error.getStatusCode()).body(Map.of("error", code));
  }

  @ExceptionHandler(Exception.class)
  public ResponseEntity<Map<String, String>> internalError(Exception error) {
    LOGGER.error("Unhandled API error type: {}", error.getClass().getSimpleName());
    return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", "INTERNAL_ERROR"));
  }
}
`)]
}

function ginErrors(files: ArtifactFile[]): ArtifactFile[] {
  replaceFile(files, 'apps/api/internal/handlers/resources.go', (content) => content
    .replaceAll(
      'if err := c.ShouldBindJSON(&item); err != nil { c.JSON(http.StatusBadRequest, gin.H{"error":err.Error()}); return }',
      'if err := c.ShouldBindJSON(&item); err != nil { c.JSON(http.StatusBadRequest, gin.H{"error":"VALIDATION_ERROR"}); return }',
    )
    .replaceAll(
      'if err := database.DB.Create(&item).Error; err != nil { c.JSON(http.StatusBadRequest, gin.H{"error":err.Error()}); return }',
      'if err := database.DB.Create(&item).Error; err != nil { writeDatabaseError(c, err); return }',
    )
    .replaceAll(
      'if err := c.ShouldBindJSON(&input); err != nil { c.JSON(http.StatusBadRequest, gin.H{"error":err.Error()}); return }',
      'if err := c.ShouldBindJSON(&input); err != nil { c.JSON(http.StatusBadRequest, gin.H{"error":"VALIDATION_ERROR"}); return }',
    )
    .replaceAll(
      'if err := database.DB.Model(&item).Updates(updates).Error; err != nil { c.JSON(http.StatusBadRequest, gin.H{"error":err.Error()}); return }',
      'if err := database.DB.Model(&item).Updates(updates).Error; err != nil { writeDatabaseError(c, err); return }',
    )
    .replaceAll(
      'if err := database.DB.Delete(&item).Error; err != nil { c.JSON(http.StatusConflict, gin.H{"error":err.Error()}); return }',
      'if err := database.DB.Delete(&item).Error; err != nil { writeDatabaseError(c, err); return }',
    ))

  return [text('apps/api/internal/handlers/errors.go', `package handlers

import (
  "log"
  "net/http"
  "strings"

  "github.com/gin-gonic/gin"
)

func writeDatabaseError(c *gin.Context, err error) {
  message := strings.ToLower(err.Error())
  if strings.Contains(message, "constraint") ||
    strings.Contains(message, "foreign key") ||
    strings.Contains(message, "duplicate") ||
    strings.Contains(message, "unique") {
    c.JSON(http.StatusConflict, gin.H{"error":"CONSTRAINT_CONFLICT"})
    return
  }
  log.Printf("Unhandled database error type: %T", err)
  c.JSON(http.StatusInternalServerError, gin.H{"error":"INTERNAL_ERROR"})
}
`)]
}

export function applyManualErrorHandling(
  inputFiles: ArtifactFile[],
  stack: BackendStackId,
): ArtifactFile[] {
  const files = inputFiles.map((file) => ({ ...file }))
  const extra = stack === 'hono-drizzle'
    ? honoErrors(files)
    : stack === 'nestjs-prisma'
      ? nestErrors(files)
      : stack === 'fastapi-sqlalchemy'
        ? fastApiErrors(files)
        : stack === 'spring-boot-jpa'
          ? springErrors()
          : ginErrors(files)
  return [...files, ...extra]
}
