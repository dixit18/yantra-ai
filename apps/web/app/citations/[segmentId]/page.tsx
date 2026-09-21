import type { Metadata } from 'next';
import { authenticateRequest } from '@yantra/auth';
import { Chip, Eyebrow, Shell } from '@yantra/ui';
import { createSourceUrl, formatCitation, resolveCitation } from '@yantra/knowledge';
import { dbQuery } from '../../lib/db';

export const metadata: Metadata = {
  title: 'Source — Yantra AI',
  description: 'Cited source evidence for a Yantra AI answer.',
};

const NAV = [
  { href: '/product', label: 'Product' },
  { href: '/security', label: 'Security' },
  { href: '/contact', label: 'Contact' },
];

function Locked() {
  return (
    <Shell nav={NAV} footerNote="Yantra AI — lean MVP demo.">
      <section className="strip" aria-labelledby="locked-h">
        <Eyebrow>Source</Eyebrow>
        <h1 id="locked-h">This source requires a signed demo link.</h1>
        <p className="lede" data-testid="citation-locked">
          Evidence links are tenant-bound and expire. Ask the assistant for a fresh citation.
        </p>
      </section>
    </Shell>
  );
}

export default async function SourcePage({
  params,
  searchParams,
}: {
  params: Promise<{ segmentId: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const secret = process.env['APP_SECRET'];
  const token = (await searchParams).token;
  if (!secret || !token) {
    return <Locked />;
  }
  try {
    const { segmentId } = await params;
    const ctx = await authenticateRequest(
      { authorization: `Bearer ${token}` },
      { secret, query: dbQuery },
    );
    const citation = await resolveCitation(dbQuery, { tenantId: ctx.tenantId, segmentId });
    const sourceUrl = createSourceUrl(
      { fileId: citation.blobFileId, tenantId: ctx.tenantId },
      secret,
    );
    return (
      <Shell nav={NAV} footerNote="Yantra AI — lean MVP demo.">
        <section className="strip" aria-labelledby="source-h">
          <Eyebrow>Source evidence</Eyebrow>
          <h1 id="source-h" data-testid="citation-title">
            {formatCitation(citation)}
          </h1>
          <p className="lede" data-testid="citation-meta">
            {citation.documentTitle} · version {citation.versionLabel} · {citation.approvalState} ·
            page {citation.page} <Chip>{citation.kind}</Chip>
          </p>
          <embed
            src={`${sourceUrl}#page=${citation.page}`}
            type="application/pdf"
            data-testid="source-pdf"
            style={{ width: '100%', height: '70vh', border: '1px solid var(--line)' }}
          />
        </section>
      </Shell>
    );
  } catch {
    return <Locked />;
  }
}
