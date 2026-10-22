import { ExerciseList } from '@/components/ExerciseList';
import { Muted, Screen } from '@/components/ui';
import { useApp } from '@/store/AppStore';

export default function Exercices() {
  const { data } = useApp();
  return (
    <Screen top={false}>
      <Muted>Appuie sur un exercice pour voir l’animation et les consignes. La pastille de couleur indique le niveau : vert pour débutant, jaune pour intermédiaire, orange pour confirmé.</Muted>
      <ExerciseList equipment={data.profile.equipment} />
    </Screen>
  );
}
