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

/** "Dimanche" */
const cap = (word: string) => word.charAt(0).toUpperCase() + word.slice(1);

export const fr = {
  app: {
    name: 'Banque de papa et maman',
    loading: 'Chargement…',
  },
  parent: {
    appTitle: 'Banque de papa et maman · espace parent',
    kidsGroup: 'Enfant',
    addKid: '+ Ajouter un enfant',
    balanceOf: (name: string) => `Solde ${de(name)} aujourd'hui`,
    seeAs: (name: string) => `Voir comme ${name}`,
    loading: 'Ouverture de ta banque…',
    noRoot: 'Ouvre ton lien parent, ou restaure ta banque avec tes 12 mots.',
    notFound: "Ce lien ne correspond à aucune banque sur ce serveur. Vérifie l'adresse.",
    damaged: 'Impossible de lire ta banque. Le lien est peut-être incomplet.',
    loadNetwork: 'Pas de connexion. Réessaie dans un moment.',
    retry: 'Réessayer',
    noKids: 'Ajoute un premier enfant pour commencer.',
    close: 'Fermer',
    cancel: 'Annuler',
    save: 'Enregistrer',

    catchUpTitle: (day: string) => `${cap(day)}s à rattraper`,
    catchUpSub: (name: string, day: string) =>
      `Pour chaque ${day} sans réponse, dis si la pièce est allée à la banque ou si ${name} l'a gardée. Les intérêts sont recalculés depuis la bonne date.`,
    allBank: 'Tout à la banque',
    allKept: 'Tout gardé',
    bank: 'Banque',
    kept: 'Gardée',
    pendingDay: (day: string, dayMonth: string, year: string | null) => `${cap(day)} ${dayMonth}${year ? ` ${year}` : ''}`,
    agoToday: "aujourd'hui",
    agoThisWeek: 'cette semaine',
    agoWeeks: (n: number) => `il y a ${n} ${p(n, 'semaine', 'semaines')}`,
    showOthers: (n: number) => `Voir les ${n} autres`,
    showLess: 'Voir moins',
    catchUpPreview: (banked: number, kept: number, coins: string, interest: string, balance: string) =>
      `${banked} à la banque, ${kept} ${p(kept, 'gardée', 'gardées')}. +**${coins}** de pièces et +**${interest}** d'intérêts rattrapés. Nouveau solde : **${balance}**.`,
    saveDays: (n: number, day: string) => (n ? `Enregistrer ${n} ${p(n, day, `${day}s`)}` : 'Enregistrer'),
    savedDays: (name: string) => `Enregistré. ${name} verra le nouveau solde à sa prochaine visite.`,
    upToDate: (day: string, next: string | null) => (next ? `Tout est à jour. Prochain ${day} : le ${next}.` : 'Tout est à jour.'),

    addMoveTitle: 'Ajouter un mouvement',
    typeGroup: 'Type de mouvement',
    deposit: 'Dépôt',
    withdrawal: 'Retrait',
    amountLabel: 'Montant (€)',
    amountPlaceholder: '0,00',
    dateLabel: 'Date',
    lastDayChip: (day: string) => `${cap(day)} dernier`,
    kidNoteLabel: (name: string) => `Note pour ${name} (visible dans son livret)`,
    kidNotePlaceholder: 'Ex. : de Mamie pour ton anniversaire',
    privateNoteLabel: 'Note privée (seulement pour toi)',
    privateNotePlaceholder: 'Ex. : rendu en liquide le 3/10',
    newBalance: (balance: string) => `Nouveau solde : **${balance}**`,
    backdated: (signed: string) => `Daté du passé : **${signed}** d'intérêts recalculés depuis cette date.`,
    overdraftToday: (amount: string) => `Il n'y a que ${amount} sur le compte.`,
    overdraftPast: (date: string, amount: string) => `Le ${date}, il n'y avait que ${amount} sur le compte.`,
    moveProblem: {
      in_future: 'La date ne peut pas être dans le futur.',
      before_start: 'La date ne peut pas être avant le début du livret.',
      date_invalid: 'Choisis une date.',
      amount_zero: 'Indique un montant.',
      amount_invalid: 'Indique un montant.',
    },
    submitDeposit: (amount: string | null) => (amount ? `Déposer ${amount}` : 'Déposer'),
    submitWithdrawal: (amount: string | null) => (amount ? `Retirer ${amount}` : 'Retirer'),
    toastDeposit: 'Dépôt ajouté au livret.',
    toastWithdrawal: 'Retrait ajouté au livret.',
    toastEdited: 'Modifié. Les soldes sont recalculés.',
    toastDeleted: 'Supprimé du livret.',
    editTitle: 'Modifier le mouvement',
    delete: 'Supprimer',

    conflict: 'Modifié sur un autre appareil. Recharge pour voir la dernière version.',
    reload: 'Recharger',
    saveNetwork: "Pas de connexion : rien n'a été enregistré. Réessaie dans un moment.",
    saveServer: "Le serveur n'a pas pu enregistrer. Réessaie dans un moment.",
    saveTooLarge: 'Ta banque est devenue trop grande pour ce serveur.',

    historyTitle: 'Livret',
    coinRow: (day: string) => `Pièce du ${day}`,
    keptRow: 'Pièce gardée',
    keptAmount: 'gardée',
    historyMore: (n: number) => `Voir tout le livret (${n})`,
    historyEmpty: "Rien pour l'instant. Le premier mouvement apparaîtra ici.",
    privateNoteAria: 'Note privée',

    sundayTitle: (day: string, date: string) => `${cap(day)} ${date}`,
    currentlyBanked: 'Actuellement : pièce mise à la banque.',
    currentlyKept: (name: string) => `Actuellement : pièce gardée par ${name}.`,
    markKept: 'Marquer gardée',
    markBanked: 'Mettre à la banque',
    resetDay: 'Remettre à rattraper',

    settingsTitle: 'Réglages',
    nameLabel: 'Prénom',
    birthdayLabel: 'Anniversaire',
    birthdayOptional: 'Anniversaire (facultatif)',
    birthdayNone: 'Pas indiqué',
    nameRequired: 'Indique un prénom.',
    editKid: 'Modifier',
    toastKidSaved: 'Enregistré.',
    allowanceLabel: 'Argent de poche',
    allowanceValue: (amount: string, day: string) => `${amount} chaque ${day}`,
    allowancePaused: 'En pause',
    allowanceFrom: (value: string, date: string) => `${value} à partir du ${date}`,
    changeAllowance: "Changer l'argent de poche",
    allowanceAmountLabel: 'Montant (€, 0 pour une pause)',
    weekdayLabel: 'Jour',
    fromLabel: 'À partir du',
    allowanceHint: "Le passé ne change pas : l'ancien montant reste appliqué jusqu'à cette date.",
    toastAllowance: (date: string) => `Argent de poche changé à partir du ${date}.`,
    rateLabel: "Taux d'intérêt",
    rateSince: (rate: string, date: string) => `${rate} depuis le ${date}`,
    rateFrom: (rate: string, date: string) => `${rate} à partir du ${date}`,
    changeRate: 'Changer le taux',
    newRateLabel: 'Nouveau taux (% par an)',
    rateHint: "Le passé ne change pas : l'ancien taux reste appliqué jusqu'à cette date.",
    toastRate: (rate: string, date: string) => `Taux de ${rate} à partir du ${date}.`,
    datedProblem: {
      rate_out_of_range: 'Choisis un taux entre 0 et 50 %.',
      amount_invalid: 'Indique un montant (0 pour une pause).',
      date_invalid: 'Choisis une date.',
      before_start: 'La date ne peut pas être avant le début du livret.',
      in_past: "La date ne peut pas être dans le passé : l'historique ne change jamais.",
    },
    forgetDevice: 'Oublier cet appareil',
    forgetHint: 'Ce téléphone ne retiendra plus ta banque. Pour revenir, il te faudra ton lien parent ou tes 12 mots.',
    forgetConfirm: 'Oublier',

    sharingTitle: (name: string) => `Lien ${de(name)}`,
    qrAria: (name: string) => `QR code du lien ${de(name)}`,
    shareHelp: (name: string) =>
      `Scanne ce code avec le téléphone ${de(name)}, puis « Ajouter à l'écran d'accueil ». Ce lien permet seulement de regarder.`,
    copyLink: (name: string) => `Copier le lien ${de(name)}`,
    toastCopied: (name: string) => `Lien ${de(name)} copié.`,
    newLink: (name: string) => `Créer un nouveau lien pour ${name}`,
    newLinkHelp: "L'ancien lien ne marchera plus. Utile si le lien a été partagé par erreur ou si un téléphone est perdu.",
    newLinkConfirm: 'Créer le nouveau lien',
    toastNewLink: "Nouveau lien créé. L'ancien ne marche plus.",
    oldLinkKept: "Nouveau lien créé, mais l'ancien n'a pas pu être supprimé. Réessaie plus tard.",

    addKidTitle: 'Ajouter un enfant',
    allowanceAmount: 'Argent de poche (€)',
    rateInput: "Taux d'intérêt (% par an)",
    createKid: (name: string) => (name ? `Créer la banque ${de(name)}` : 'Créer la banque'),
    toastKidAdded: (name: string) => `Banque ${de(name)} créée. Envoie-lui son lien.`,
    tooManyKids: 'Une famille peut avoir 10 enfants au maximum.',
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
