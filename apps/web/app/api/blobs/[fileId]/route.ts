import { NextResponse, type NextRequest } from 'next/server';
import { LocalFileBlobStore } from '@yantra/blobstore';
import { verifySourceUrl } from '@yantra/knowledge';
import { dbQuery } from '../../../lib/db';

// Tenant-scoped source bytes behind expiring HMAC URLs. Every failure — bad
// signature, expiry, malformed params, missing row, foreign row — returns the
// identical 404: no existence oracle. The browser's native PDF viewer sends
// no auth headers, which is why this route trusts signatures, not sessions.
function blobRoot(): string {
  return process.env['LOCAL_BLOB_ROOT']?.trim() || './data/uploads';
}

// Inline rendering is restricted to non-executable types. Anything else
// (HTML, SVG, text, uploads with attacker-chosen types) downloads as an
// opaque octet-stream inside a sandboxed context: a stored upload must never
// execute script in the app origin.
const INLINE_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'image/avif',
]);

function appSecret(): string {
  const secret = process.env['APP_SECRET'];
  if (!secret) {
    throw new Error('APP_SECRET is not set (see .env.example)');
  }
  return secret;
}

export async function GET(request: NextRequest, context: { params: Promise<{ fileId: string }> }) {
  const denied = () => NextResponse.json({ error: 'not found' }, { status: 404 });
  try {
    const { fileId } = await context.params;
    const url = new URL(request.url);
    const { tenantId } = verifySourceUrl(
      fileId,
      {
        tenant: url.searchParams.get('tenant') ?? undefined,
        exp: url.searchParams.get('exp') ?? undefined,
        sig: url.searchParams.get('sig') ?? undefined,
      },
      appSecret(),
    );
    const store = new LocalFileBlobStore(blobRoot(), dbQuery);
    const { bytes, meta } = await store.get(tenantId, fileId);
    const inline = INLINE_TYPES.has(meta.mimeType);
    return new Response(bytes as unknown as BodyInit, {
      headers: {
        'Content-Type': inline ? meta.mimeType : 'application/octet-stream',
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': 'sandbox',
        // Tenant-gated bytes must never sit in a cache past URL expiry.
        'Cache-Control': 'no-store',
        'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="source"`,
      },
    });
  } catch {
    return denied();
  }
}
