/** Sur le web, Alert.alert n'affiche pas de boutons : on utilise la boîte native du navigateur. */
export function confirmAction(title: string, message: string, _confirmLabel: string, onConfirm: () => void) {
  if (window.confirm(`${title}\n\n${message}`)) onConfirm();
}
