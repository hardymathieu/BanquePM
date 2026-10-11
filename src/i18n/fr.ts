// French UI strings: tu form, sentence case. `**…**` marks bold, rendered by <Rich>.
// Wording follows design/kid-view.html and design/parent-view.html where they have it.
import type { FractionKey } from '../engine/kidNumbers';

const plural = new Intl.PluralRules('fr');
const p = (n: number, one: string, other: string) => (plural.select(n) === 'one' ? one : other);

/** "de septembre", "d'octobre" */
const de = (word: string) => (/^[aeiouyhàâäéèêëîïôöûü]/i.test(word) ? `d'${word}` : `de ${word}`);

const fractions: Record<FractionKey, string> = {
  bit: 'un petit bout',
  quarter: 'un quart',
  third: 'un tiers',
  half: 'la moitié',
  twoThirds: 'deux tiers',
  threeQuarters: 'trois quarts',
  almostAll: 'presque toute',
  whole: 'toute',
};

export const fr = {
  app: {
    name: 'Banque de papa et maman',
    loading: 'Chargement…',
  },
  kid: {
    title: (name: string) => `Banque de ${name}`,
    hello: (name: string) => `Bonjour ${name} !`,
    where: 'dans ta banque de papa et maman',
    today: (amount: string) =>
      `Aujourd'hui, la banque t'a donné **${amount}**, juste parce que ton argent est ici. Demain, elle recommence.`,
    todayEmpty: "Dès que tu mets de l'argent ici, la banque t'en donne un peu plus chaque jour.",
    cents: (n: number) => `${n} ${p(n, 'centime', 'centimes')}`,

    coinTitle: 'Ta banque te paie aussi',
    thisWeek: "Cette semaine, elle t'a donné",
    weekFraction: (key: FractionKey, coin: string, day: string) =>
      key === 'whole'
        ? `C'est **une pièce entière**, autant que ta pièce de ${coin} du ${day}, sans rien faire.`
        : `C'est **${fractions[key]}** de ta pièce de ${coin} du ${day}, sans rien faire.`,
    goal: (amount: string) =>
      `Plus ta banque grandit, plus la pièce se remplit. Le jour où tu auras **${amount}**, la banque te donnera chaque semaine une pièce entière, autant que papa.`,
    goalReached: 'Ta banque te donne déjà chaque semaine une pièce entière, ou plus. Bravo !',
    coinAria: (coin: string, percent: number) => `Une pièce de ${coin} remplie à ${percent} pour cent`,

    chartTitle: 'Et si tu avais mis chaque pièce ?',
    gapKept: (n: number, day: string, gap: string) =>
      p(
        n,
        `Tu as gardé ${n} pièce du ${day} pour toi. Si tu l'avais mise à la banque, tu aurais aujourd'hui **${gap} de plus**, intérêts compris. Ce n'est pas grave : c'était ton choix, et tu as profité de cette pièce.`,
        `Tu as gardé ${n} pièces du ${day} pour toi. Si tu les avais toutes mises à la banque, tu aurais aujourd'hui **${gap} de plus**, intérêts compris. Ce n'est pas grave : c'était ton choix, et tu as profité de ces pièces.`,
      ),
    allBanked: 'Tu as mis toutes tes pièces à la banque. Bravo !',
    legendMine: 'Ton compte',
    legendGhost: (day: string) => `Avec chaque pièce du ${day}`,
    chartAria: (day: string, target: string) =>
      `Évolution de ton compte comparée au compte avec chaque pièce du ${day}, jusqu'au ${target}`,
    chartToday: "aujourd'hui",
    chartEndGhost: 'chaque pièce',
    chartEndMine: (age: number | null) => (age === null ? 'toi' : `toi, ${age} ans`),
    tipFuture: ' (si tu continues)',
    tipMine: 'ton compte',
    tipGhost: 'avec chaque pièce',
    tableToggle: 'Voir les chiffres mois par mois',
    tableMonth: 'Fin du mois',
    tableMine: 'Ton compte',
    tableGhost: 'Avec chaque pièce',

    bdayTitle: (dayMonth: string, age: number) => `Le ${dayMonth}, pour tes ${age} ans`,
    sixMonthsTitle: 'Dans 6 mois',
    bdayWhen: (days: number) => `Dans ${days} ${p(days, 'jour', 'jours')}, tu pourrais avoir :`,
    pathYes: (day: string) => `si tu mets ta pièce chaque ${day}`,
    pathNo: 'si tu ne mets plus rien',

    bookTitle: 'Ton livret',
    deposit: 'Dépôt',
    withdrawal: 'Retrait',
    coinRow: (day: string) => `Pièce du ${day}`,
    interestRow: (monthYear: string, partial: boolean) => `Intérêts ${de(monthYear)}${partial ? ", jusqu'ici" : ''}`,
    paidByBank: 'payés par la banque',
    bookMore: 'Voir tout le livret',
    bookLess: 'Voir moins',

    footer: 'Lecture seule : tout est calculé sur ce téléphone à partir de la liste des dépôts et retraits.',
    stale: (date: string) => `Mis à jour le ${date}. Pas de connexion pour l'instant.`,
    revoked: "Ce lien n'est plus valable. Demande un nouveau lien à tes parents.",
    loadError: "Impossible d'ouvrir ta banque pour l'instant. Vérifie ta connexion et réessaie.",
    retry: 'Réessayer',
  },
};

export type Messages = typeof fr;
