import { renderAppIcon } from '@/lib/app-icon';

export const runtime = 'nodejs';
export const dynamic = 'force-static';

export function GET() {
  return renderAppIcon(512, { maskable: true });
}
