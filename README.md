# Banque de papa et maman

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/hardymathieu/BanquePM)

*English below.*

Une tirelire virtuelle, libre et gratuite, que les parents tiennent pour leurs enfants. L'argent de poche peut aller à la banque de papa et maman, la banque paie des intérêts généreux pour apprendre, et l'enfant regarde son argent grandir sur une page à lui, en lecture seule.

## La promesse : celui qui héberge ne peut rien savoir

- **Pas de compte**, pas d'e-mail, pas de mot de passe. Ta banque s'ouvre avec un lien secret, et se récupère avec **12 mots**.
- **Tout est chiffré sur ton téléphone** avant d'être envoyé. Le serveur ne garde que des fichiers qu'il ne peut pas ouvrir : ni prénoms, ni montants, ni notes.
- **Aucun journal, aucune statistique**, aucune requête vers un autre site (polices et bibliothèques sont incluses).
- **Tes données sont à toi** : une sauvegarde en un clic, un simple fichier JSON, qui s'ouvre même sans internet.
- **Pas de récupération possible** sans tes 12 mots ou une sauvegarde. C'est le prix de la confidentialité : l'app insiste pour que tu les ranges.

Le détail est sur la page `/confidentialite` de chaque banque.

## Installer ta propre banque (5 minutes)

Il faut un compte Cloudflare (gratuit). Le plan gratuit suffit très largement pour une famille.

1. Clique sur **Deploy to Cloudflare** ci-dessus. Cloudflare copie ce dépôt dans ton GitHub, crée la base de données et publie l'app.
2. Quand on te demande **`ADMIN_TOKEN`**, choisis un long mot de passe aléatoire (**32 caractères ou plus**) et range-le dans ton gestionnaire de mots de passe.
3. Ouvre `https://<ton-worker>.workers.dev/admin`, colle ton `ADMIN_TOKEN`, puis :
   - **Créer ma banque** pour ta propre famille ;
   - ou **Créer une invitation** pour une famille amie (un code à usage unique, valable 14 jours).
4. Suis les étapes : prénom de l'enfant, **carte de récupération** (imprime-la), puis le lien et le QR code à ouvrir sur le téléphone de l'enfant, qui l'ajoute à l'écran d'accueil.

Tu as déjà un tableau Google Sheets ? À la création, choisis **Depuis un tableau** et donne le fichier CSV (*Fichier → Télécharger → Valeurs séparées par des virgules*).

### Options

- `INSTANCE_CONTACT` (facultatif) : un contact affiché sur la page de confidentialité, par exemple une adresse e-mail. À ajouter dans Cloudflare, *Workers → ta banque → Settings → Variables*.

### Mises à jour

Le bouton Deploy crée une **copie** de ce dépôt dans ton GitHub (pas un fork), et y inscrit l'identifiant de ta base de données (`database_id` dans `wrangler.jsonc`). Ta copie ne se met pas à jour toute seule. Pour récupérer les nouveautés :

```
git clone https://github.com/<toi>/<ta-copie>.git && cd <ta-copie>
./scripts/update-from-upstream.sh   # fusionne ce dépôt-ci en gardant ton database_id
git push                            # Cloudflare reconstruit et republie
```

Ne supprime jamais la ligne `database_id` : sans elle, un déploiement pourrait créer une nouvelle base vide. L'API reste compatible `/api/v1` : une nouvelle version lit toujours les banques existantes.

---

## English

A free, open-source virtual savings account that parents run for their kids. Pocket money can go into mum and dad's bank, the bank pays generous, educational interest, and the kid watches it grow on their own read-only page. The UI is in French; English is partial.

**The promise: whoever hosts it can know nothing.** No accounts, no e-mails, no passwords, no logs, no analytics, no third-party requests. Everything is end-to-end encrypted in the browser; the server stores only blobs it cannot read. A secret link opens the bank and 12 recovery words restore it. Lose both (and your backups) and nobody can recover it, by design.

**Deploy your own:** click **Deploy to Cloudflare** above, set `ADMIN_TOKEN` to a random password of 32+ characters, open `/admin`, then *Créer ma banque* for your family or *Créer une invitation* for a friend's. Optional `INSTANCE_CONTACT` shows a contact on the privacy page. The button makes a *copy* (not a fork) holding your D1 `database_id`; to update it, run `./scripts/update-from-upstream.sh` in your copy, then `git push`. Never drop the `database_id` line. The API stays `/api/v1`-compatible.

## Development

```
npm install
npm test                 # unit tests: engine, crypto, worker (in workerd)
npm run typecheck
cp .dev.vars.example .dev.vars   # then set ADMIN_TOKEN to 32+ random characters
npm run dev              # then, in another terminal: npm run seed (a fictional demo bank)
npx playwright install chromium  # once
npm run e2e              # end-to-end tests, phone size, light and dark
npm run verify           # everything: typecheck, unit, dist check, end-to-end
python3 fixtures/engine_reference.py   # reference implementation of the interest maths
```

Architecture: one Cloudflare Worker serves the app and a tiny JSON API (`worker/`), one D1 database stores encrypted blobs. All logic runs in the browser: the pure calculation engine in `src/engine/`, the crypto (HKDF, AES-GCM, BIP39) in `src/crypto/`, the Preact UI in `src/ui/`. Design decisions are in `docs/decisions.md`.

Licence: MIT.
