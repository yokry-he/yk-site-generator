import { createHash, createHmac } from 'node:crypto'
import { sitePageOutputPath, type SitePage } from 'shared'
import { env } from '../env'

function sha256(value: string | Uint8Array): string {
  return createHash('sha256').update(value).digest('hex')
}

function hmac(key: Buffer | string, value: string): Buffer {
  return createHmac('sha256', key).update(value).digest()
}

function awsEncode(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`)
}

function canonicalUri(pathname: string): string {
  return pathname.split('/').map(awsEncode).join('/').replace(/%2F/gi, '/') || '/'
}

function objectUrl(key: string): URL {
  const endpoint = env.S3_ENDPOINT.replace(/\/$/, '')
  return new URL(`${endpoint}/${awsEncode(env.S3_BUCKET)}/${key.split('/').map(awsEncode).join('/')}`)
}

function amzTimestamp(now: Date): { amzDate: string; date: string } {
  const iso = now.toISOString().replace(/[:-]|\.\d{3}/g, '')
  return { amzDate: iso, date: iso.slice(0, 8) }
}

async function signedRequest(input: {
  method: 'PUT' | 'DELETE'
  key: string
  body?: string
}): Promise<void> {
  const url = objectUrl(input.key)
  const payload = input.body ?? ''
  const payloadHash = sha256(payload)
  const { amzDate, date } = amzTimestamp(new Date())
  const headers: Record<string, string> = {
    host: url.host,
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': amzDate,
  }
  if (input.method === 'PUT') {
    headers['content-type'] = 'text/html; charset=utf-8'
    headers['cache-control'] = 'public,max-age=60,stale-while-revalidate=300'
  }

  const sortedHeaderNames = Object.keys(headers).sort()
  const canonicalHeaders = sortedHeaderNames.map((name) => `${name}:${headers[name].trim()}\n`).join('')
  const signedHeaders = sortedHeaderNames.join(';')
  const canonicalQuery = [...url.searchParams.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${awsEncode(key)}=${awsEncode(value)}`)
    .join('&')
  const canonicalRequest = [
    input.method,
    canonicalUri(url.pathname),
    canonicalQuery,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n')
  const scope = `${date}/${env.S3_REGION}/s3/aws4_request`
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256(canonicalRequest)].join('\n')
  const dateKey = hmac(`AWS4${env.S3_SECRET_ACCESS_KEY}`, date)
  const regionKey = hmac(dateKey, env.S3_REGION)
  const serviceKey = hmac(regionKey, 's3')
  const signingKey = hmac(serviceKey, 'aws4_request')
  const signature = createHmac('sha256', signingKey).update(stringToSign).digest('hex')
  const authorization = `AWS4-HMAC-SHA256 Credential=${env.S3_ACCESS_KEY_ID}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`

  const response = await fetch(url, {
    method: input.method,
    headers: { ...headers, authorization },
    body: input.method === 'PUT' ? payload : undefined,
  })
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 500)
    throw new Error(`S3_${input.method}_FAILED:${response.status}:${detail}`)
  }
}

function pageObjectKey(slug: string, page: Pick<SitePage, 'path'>): string {
  return `sites/${slug}/${sitePageOutputPath(page)}`
}

export async function putPublishedObjects(slug: string, pages: readonly SitePage[]): Promise<void> {
  const uploaded: string[] = []
  try {
    for (const page of pages) {
      const key = pageObjectKey(slug, page)
      await signedRequest({ method: 'PUT', key, body: page.html })
      uploaded.push(key)
    }
  } catch (error) {
    await Promise.allSettled(uploaded.map((key) => signedRequest({ method: 'DELETE', key })))
    throw error
  }
}

export async function deletePublishedObjects(slug: string, pages: readonly Pick<SitePage, 'path'>[]): Promise<void> {
  const targets = pages.length ? pages : [{ path: '/' }]
  const results = await Promise.allSettled(targets.map((page) => signedRequest({ method: 'DELETE', key: pageObjectKey(slug, page) })))
  const rejected = results.find((result): result is PromiseRejectedResult => result.status === 'rejected')
  if (rejected) throw rejected.reason
}

/** Backwards-compatible one-page wrappers. */
export async function putPublishedObject(slug: string, html: string): Promise<void> {
  await putPublishedObjects(slug, [{ id: 'home', title: '首页', path: '/', html }])
}

export async function deletePublishedObject(slug: string): Promise<void> {
  await deletePublishedObjects(slug, [{ path: '/' }])
}

export function s3PublicationUrl(slug: string): string {
  if (env.S3_PUBLIC_BASE_URL) return `${env.S3_PUBLIC_BASE_URL.replace(/\/$/, '')}/sites/${slug}/index.html`
  return objectUrl(`sites/${slug}/index.html`).toString()
}

export async function invalidatePublicationCache(
  slug: string,
  action: 'publish' | 'delete',
  pages: readonly Pick<SitePage, 'path'>[] = [{ path: '/' }],
): Promise<void> {
  if (!env.CDN_INVALIDATION_WEBHOOK_URL) return
  const objectPaths = pages.map((page) => `/sites/${slug}/${sitePageOutputPath(page)}`)
  const appPaths = pages.map((page) => `/site/${slug}${page.path === '/' ? '' : page.path}`)
  try {
    const response = await fetch(env.CDN_INVALIDATION_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(env.CDN_INVALIDATION_WEBHOOK_TOKEN
          ? { authorization: `Bearer ${env.CDN_INVALIDATION_WEBHOOK_TOKEN}` }
          : {}),
      },
      body: JSON.stringify({ action, paths: [...new Set([...objectPaths, ...appPaths])] }),
    })
    if (!response.ok) console.warn(`[cdn] 缓存失效 Webhook 返回 ${response.status}`)
  } catch (err) {
    console.warn('[cdn] 缓存失效 Webhook 调用失败:', err)
  }
}
