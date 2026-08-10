import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';
import { colors } from '@swasthya/configuration';

const description =
  'A calm, multilingual health companion for asking questions, understanding health information, and finding the right care.';

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="ne">
      <head>
        <meta charSet="utf-8" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=5, viewport-fit=cover"
        />
        <meta name="theme-color" content={colors.primary} />
        <meta name="description" content={description} />
        <meta property="og:type" content="website" />
        <meta property="og:title" content="Mero Health - Your health, in your language" />
        <meta property="og:description" content={description} />
        <meta property="og:image" content="/mero-health-social.png" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Mero Health - Your health, in your language" />
        <meta name="twitter:description" content={description} />
        <meta name="twitter:image" content="/mero-health-social.png" />
        <title>Mero Health - Your health, in your language</title>
        <ScrollViewStyleReset />
        <script
          dangerouslySetInnerHTML={{
            __html: "document.title = 'Mero Health - Your health, in your language';",
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
