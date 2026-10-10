import * as Speech from 'expo-speech';

/** Annonce vocale en français, via la synthèse vocale de l'appareil (gratuite, hors connexion). */
export function say(text: string) {
  try {
    Speech.stop();
    Speech.speak(text, { language: 'fr-FR', rate: 1.0 });
  } catch {
    // Pas de synthèse vocale disponible : l'appli reste utilisable en silence.
  }
}

export function stopVoice() {
  try {
    Speech.stop();
  } catch {
    // Rien à arrêter.
  }
}
