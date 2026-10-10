import { Body, Card, Screen, Title } from '@/components/ui';

export default function Coach() {
  return (
    <Screen>
      <Title>Ton coach</Title>
      <Card>
        <Body>
          Bientôt, tu pourras discuter ici avec ton coach : « j&apos;ai mal au genou », « je
          n&apos;ai que 15 minutes », « explique-moi cet exercice »… Il connaîtra ton profil et ta
          progression, et te proposera une séance adaptée à valider d&apos;un tap.
        </Body>
      </Card>
      <Body muted>
        En attendant, tu peux déjà adapter ta séance depuis l&apos;accueil. Le coach a besoin
        d&apos;une connexion internet ; tout le reste de l&apos;appli fonctionne sans.
      </Body>
    </Screen>
  );
}
