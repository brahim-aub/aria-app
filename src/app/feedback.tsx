import { useState } from 'react';
import { StyleSheet, TextInput } from 'react-native';

import { Body, Button, Card, Screen } from '@/components/ui';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { useAppStore } from '@/store/app-store';

export default function FeedbackScreen() {
  const addFeedback = useAppStore((state) => state.addFeedback);
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState(false);

  const send = () => {
    addFeedback(message.trim());
    setMessage('');
    setSent(true);
  };

  return (
    <Screen edges={['bottom']}>
      <Body>
        Un exercice mal expliqué, une séance trop dure, une idée ? Dis-nous tout, chaque message
        est lu.
      </Body>
      <Card>
        <TextInput
          style={styles.input}
          value={message}
          onChangeText={(text) => {
            setMessage(text);
            setSent(false);
          }}
          placeholder="Ton message"
          multiline
          textAlignVertical="top"
        />
      </Card>
      <Button label="Envoyer" disabled={!message.trim()} onPress={send} />
      {sent && <Body muted>Merci, ton message est enregistré.</Body>}
    </Screen>
  );
}

const styles = StyleSheet.create({
  input: {
    minHeight: 140,
    fontSize: 16,
    fontFamily: Fonts.medium,
    color: Colors.text,
    borderRadius: Radius.md,
    padding: Spacing.sm,
  },
});
