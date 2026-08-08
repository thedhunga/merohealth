import { useTranslations } from 'next-intl';
import { Smartphone } from 'lucide-react';

import { CtaBand } from '@/components/ui/CtaBand';

export function FinalCta() {
  const t = useTranslations('home.finalCta');

  return (
    <CtaBand
      body={t('body')}
      heading={t('heading')}
      id="final-cta-heading"
      primaryCta={{ href: '/register', label: t('primaryCta') }}
      secondaryCta={{
        external: true,
        href: '/app',
        icon: <Smartphone aria-hidden className="size-4.5" />,
        label: t('secondaryCta'),
      }}
    />
  );
}
