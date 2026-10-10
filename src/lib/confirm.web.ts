/**
 * Sur le web, Alert.alert n'affiche pas de boutons : on utilise la boîte native du navigateur.
 * Dans une page intégrée (iframe), ces boîtes sont souvent bloquées : on confirme directement.
 */
export function confirmAction(title: string, message: string, _confirmLabel: string, onConfirm: () => void) {
  const embedded = window.self !== window.top;
  if (embedded || window.confirm(`${title}\n\n${message}`)) onConfirm();
}
