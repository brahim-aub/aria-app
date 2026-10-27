import { ScrollViewStyleReset, useServerDocumentContext } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

export default function RootHTML({ children }: PropsWithChildren) {
  const { headNodes, bodyNodes, htmlAttributes, bodyAttributes } = useServerDocumentContext();
  return (
    <html {...htmlAttributes} lang="fr">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <meta name="color-scheme" content="dark" />
        <meta name="theme-color" content="#0C100D" />
        <ScrollViewStyleReset />
        <style>{'html, body { background: #0C100D; color-scheme: dark; }'}</style>
        {headNodes}
      </head>
      <body {...bodyAttributes}>{children}{bodyNodes}</body>
    </html>
  );
}
