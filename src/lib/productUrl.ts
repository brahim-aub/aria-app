/** Vérifie les liens reçus du modèle ou d'un ancien relevé, sans inventer une autre adresse. */
export function productPageUrl(raw: unknown): string | undefined {
  if (typeof raw !== 'string' || /[\\\s]/.test(raw.trim())) return undefined;
  try {
    const url = new URL(raw.trim());
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.port) return undefined;
    const host = url.hostname.toLowerCase().replace(/\.$/, '');
    if (!/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}$/.test(host)) return undefined;
    // Les liens se présentant comme Carrefour France doivent rester sur son domaine officiel.
    // Une autre terminaison (frij), un suffixe ajouté ou un domaine ressemblant n'est pas corrigé.
    if (host.includes('carrefour') && host !== 'carrefour.fr' && !host.endsWith('.carrefour.fr')) return undefined;
    return url.href;
  } catch {
    return undefined;
  }
}
