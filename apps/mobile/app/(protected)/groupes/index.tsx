import React, { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { api } from 'five-api-client';
import { Alert, Card, Loading, PageTitle } from 'five-ui';
import Screen from '../../../components/Screen';
import { LinkButton, LinkCard } from '../../../components/links';

export default function Groups() {
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Meme raison que sur le tableau de bord : revenir ici apres avoir quitte
  // ou supprime un groupe doit relire la liste, pas montrer l'ancienne.
  useFocusEffect(
    useCallback(() => {
      let alive = true;

      api
        .get('/groups')
        .then((res) => alive && setGroups(res.data))
        .catch((err) => alive && setError(err.response?.data?.message ?? 'Chargement impossible'))
        .finally(() => alive && setLoading(false));

      return () => {
        alive = false;
      };
    }, [])
  );

  if (loading) return <Loading />;

  const mine = groups.filter((g) => g.isMember);
  const others = groups.filter((g) => !g.isMember);

  const row = (group: any) => (
    <LinkCard key={group.id} href={`/groupes/${group.id}`}>
      <View className="flex-row items-start justify-between gap-2">
        <Text className="font-semibold text-gray-900 flex-1">{group.name}</Text>

        {/* S-01 : messages non lus du chat de ce groupe. La donnee vient de
            GET /groups, deja appele ici : pas d'aller-retour de plus. */}
        {group.unreadCount > 0 ? (
          <View
            accessibilityLabel={`${group.unreadCount} messages non lus`}
            className="min-w-[20px] h-5 px-1.5 rounded-full bg-red-600 items-center justify-center"
          >
            <Text className="text-white text-xs font-bold">
              {group.unreadCount > 99 ? '99+' : group.unreadCount}
            </Text>
          </View>
        ) : null}
      </View>
      {group.city ? <Text className="text-sm text-gray-600">{group.city}</Text> : null}
    </LinkCard>
  );

  return (
    <Screen>
      <PageTitle subtitle="Vos groupes, et les groupes publics près de chez vous.">
        Groupes
      </PageTitle>

      {error ? (
        <View className="mb-4">
          <Alert kind="error">{error}</Alert>
        </View>
      ) : null}

      <LinkButton href="/groupes/nouveau" className="mb-6">
        Créer un groupe
      </LinkButton>

      {mine.length === 0 && others.length === 0 ? (
        <Card>
          <Text className="text-gray-600">
            Aucun groupe pour l'instant. Créez le vôtre, ou demandez un lien d'invitation à un
            organisateur.
          </Text>
        </Card>
      ) : (
        <>
          {mine.length > 0 ? (
            <View className="mb-8">
              <Text className="text-lg font-bold text-gray-900 mb-3">Mes groupes</Text>
              <View className="gap-3">{mine.map(row)}</View>
            </View>
          ) : null}

          {others.length > 0 ? (
            <View>
              <Text className="text-lg font-bold text-gray-900 mb-3">Groupes publics</Text>
              <View className="gap-3">{others.map(row)}</View>
            </View>
          ) : null}
        </>
      )}
    </Screen>
  );
}
