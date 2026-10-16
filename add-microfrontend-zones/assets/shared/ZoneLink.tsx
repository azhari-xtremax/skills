// buildpad-backend-file: supabase
// Backend: before using this file, establish the backend as "Establish the backend first" in this skill's SKILL.md says, keep only the parts for that backend, and copy no marker line into the application.
// Copy to: lib/shell/ZoneLink.tsx (every app, unchanged).
// lib/shell/ZoneLink.tsx — add-microfrontend-zones Step 6. Identical in every app.
'use client';

import Link from 'next/link';
import { forwardRef, type AnchorHTMLAttributes } from 'react';
import { OWN_PREFIX, zoneFor } from '@/config/app-urls';

type Props = AnchorHTMLAttributes<HTMLAnchorElement> & { href: string };

/**
 * Give ZoneLink a PUBLIC path, always with the zone prefix.
 * - Same zone:  renders <Link> without the prefix (Next.js adds basePath). Soft navigation.
 * - Other zone: renders <a> with the full path. Full page load.
 */
export const ZoneLink = forwardRef<HTMLAnchorElement, Props>(function ZoneLink(
  { href, ...rest },
  ref,
) {
  const owner = zoneFor(href)?.prefix ?? '';
  if (owner === OWN_PREFIX) {
    const inZone = href.slice(OWN_PREFIX.length) || '/';
    return <Link ref={ref} href={inZone} {...rest} />;
  }
  return <a ref={ref} href={href} {...rest} />;
});
