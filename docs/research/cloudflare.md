# Vincoli reali di Cloudflare Pages + Workers

> Research ticket: [Simi24/simonepetta.com#3](https://github.com/Simi24/simonepetta.com/issues/3) — mappa: [#1](https://github.com/Simi24/simonepetta.com/issues/1)
> Data ricerca: 2026-09-23. Fonte primaria: `developers.cloudflare.com` (MCP docs search + fetch diretto).
>
> **Convenzione**: ✅ = verificato su documentazione ufficiale, con link. 🧠 = mia valutazione / inferenza architetturale, non un fatto documentato.

---

## TL;DR — le cinque cose che cambiano il progetto

1. ✅ **Cloudflare dice esplicitamente di NON usare Pages per progetti nuovi.** Workers Static Assets è la piattaforma raccomandata; Pages "continua a funzionare" ma tutte le feature nuove vanno su Workers. Il framing del ticket ("Pages + Workers") va rovesciato in **un solo Worker con static assets**.
2. ✅ **Non esiste un hard spending cap a livello di account Cloudflare.** I budget alert sono *informational only*: "They do not pause or cap usage". Questo è un **rischio di progetto** e va mitigato per costruzione, non per configurazione.
3. ✅ **Esiste invece un hard cap vero, e sta esattamente dove serve**: AI Gateway **spend limits** bloccano le richieste con `429` quando la spesa in dollari supera il budget nella finestra. È l'unico tetto duro in dollari dell'intero stack, e copre proprio la chat.
4. ✅ **Le richieste agli static asset sono gratuite e illimitate**, su free e su paid, e non consumano la quota di richieste. Il vincolo "la parte statica non si rompe mai" è quindi **garantito dalla piattaforma**, non da noi — a patto di non mettere il Worker davanti agli asset (`run_worker_first`).
5. ✅ **Il rate limiting binding è disponibile su Workers e NON su Pages Functions.** Da solo basta a chiudere la scelta di piattaforma.

---

## 1. Limiti reali del free tier di Pages (2026)

Fonte: [Pages · Limits](https://developers.cloudflare.com/pages/platform/limits/) (aggiornata 5 set 2026), [Pages Functions · Pricing](https://developers.cloudflare.com/pages/functions/pricing/).

| Limite | Free | Note |
|---|---|---|
| Build al mese | ✅ **500** | 1 build alla volta (no concorrenza). Timeout build: **20 minuti**. |
| File per sito | ✅ **20.000** | Paid: 100.000 (richiede env `PAGES_WRANGLER_MAJOR_VERSION=4`). Il free è rimasto a 20k. |
| Dimensione singolo file | ✅ **25 MiB** | Per file più grandi: R2 + public bucket su sottodominio. |
| Dimensione totale sito | ✅ **non documentata** | Cloudflare non pubblica un tetto aggregato: i limiti operativi sono *numero di file* e *dimensione per file*. |
| Banda | ✅ **nessun limite documentato** | Cloudflare non documenta un cap di banda su Pages. 🧠 In pratica "illimitata" sotto fair use; per un sito personale è un non-problema. |
| Custom domain per progetto | ✅ 100 | |
| Preview deployment | ✅ illimitati | |
| Progetti per account | ✅ 100 | |
| `_headers` | ✅ 100 regole, 2.000 char per header | |
| `_redirects` | ✅ 2.000 statici + 100 dinamici (2.100 totali) | |

**Cosa mordono davvero, nel nostro caso** 🧠:
- **20.000 file** è l'unico limite che potrebbe mordere, e morde nella release **v1 (appunti universitari, 5 anni di corsi)**. Se l'ingestione LaTeX produce una pagina HTML per teorema + immagini/figure estratte, 20k file non è astratto. Da tenere sotto osservazione quando si misura il corpus (già in "Not yet specified" sulla mappa).
- **500 build/mese** è abbondante per un sito personale, ma il vincolo 2 della mappa (ingestione fuori dalla build) resta giusto anche per il **timeout di 20 minuti**: compilare 5 anni di LaTeX in CI non ci sta dentro.
- Build sequenziali (1 alla volta) → 🧠 nessun impatto, si pusha raramente.

### Build image
✅ [Build image](https://developers.cloudflare.com/pages/configuration/build-image/): v3 (default per progetti nuovi), Ubuntu 22.04, x86_64, gVisor. **Node.js 22** di default. Override con `NODE_VERSION` / `.nvmrc` / `.node-version`.
⚠️ Il v3 **non** rileva la versione Node da `package.json` → `engines`, né da `yarn.lock` / `pnpm-lock.yaml`. Va messo un `.node-version` esplicito.
✅ Politica di deprecation: v1 → migrazione forzata a v3 il **15 set 2026**, v2 → **23 feb 2027**. Poi "no further build image version changes", solo rolling update del software preinstallato.

---

## 2. Limiti Workers — free e paid

Fonte: [Workers · Limits](https://developers.cloudflare.com/workers/platform/limits/), [Workers · Pricing](https://developers.cloudflare.com/workers/platform/pricing/).

| Feature | Workers Free | Workers Paid (Standard) |
|---|---|---|
| Richieste | ✅ **100.000/giorno** (reset 00:00 UTC) | ✅ nessun limite; **10M/mese incluse**, poi **$0,30 / milione** |
| CPU time per invocazione | ✅ **10 ms** | ✅ default 30 s, max **5 min**; **30M CPU-ms/mese inclusi**, poi **$0,02 / milione di CPU-ms** |
| Memoria | ✅ 128 MB | 128 MB |
| Subrequest per invocazione | ✅ **50 esterne** (+1.000 verso servizi Cloudflare) | ✅ **10.000** di default, alzabile fino a 10M via config |
| Connessioni uscenti simultanee | 6 | 6 |
| Dimensione Worker | 64 MiB | 64 MiB |
| Startup time | 1 s | 1 s |
| Numero di Worker | 100 | 500 |
| Static asset: file per versione | ✅ 20.000 | 100.000 |
| **Richieste a static asset** | ✅ **gratuite e illimitate** | ✅ **gratuite e illimitate** |

**Costo base Paid**: ✅ **$5/mese** di sottoscrizione (poi l'uso incluso sopra).

### Cosa succede quando il free tier finisce
✅ Superate le 100.000 richieste/giorno il Worker restituisce **Error 1027**. Il comportamento è configurabile **per route**:
- **Fail open** — bypassa il Worker, la richiesta si comporta come se il Worker non esistesse;
- **Fail closed** — pagina di errore 1027.

🧠 Questo è il *primo* kill switch gratuito che abbiamo: un Worker su free plan **non può generare fattura**, e quando sfonda smette di girare senza portarsi dietro il sito.

### CPU 10 ms sul free: è un problema per la chat?
🧠 No, se il Worker è un **proxy puro**. Il tempo di attesa della risposta dell'LLM è I/O, non CPU: Cloudflare fattura la CPU time, non la wall-clock. Un proxy che valida l'input, aggiunge la chiave e fa `fetch()` in streaming sta sotto i 10 ms senza sforzo. Diventa un problema solo se si mette a fare parsing pesante, embedding locali o retrieval in-Worker.
⚠️ Attenzione al limite **50 subrequest esterne** su free: irrilevante per un proxy 1:1, rilevante se si fa RAG con molte chiamate.

### Custom limits per invocazione (bound sul costo unitario)
✅ [Wrangler `limits`](https://developers.cloudflare.com/workers/wrangler/configuration/#limits): si possono fissare `cpu_ms` e `subrequests` per invocazione.
```jsonc
{ "limits": { "cpu_ms": 200, "subrequests": 10 } }
```
✅ La doc di pricing lo dice esplicitamente: *"To prevent accidental runaway bills or denial-of-wallet attacks, configure the maximum amount of CPU time that can be used per invocation"*. Configurabile anche da dashboard (**Workers & Pages → Worker → Settings → CPU Limits**).
⚠️ **Limita il costo per richiesta, non il costo totale.** Non è un budget cap.
⚠️ I limits valgono solo sul modello **Standard usage**, e non sono applicati in local dev.

---

## 3. Come si lega simonepetta.com (già nell'account) al progetto

✅ Il dominio è già una **zone attiva** su Cloudflare (acquistato via Cloudflare Registrar → nameserver Cloudflare per costruzione). È esattamente il caso facile.

**Su Workers** ([Custom Domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/)):
1. Dashboard → **Workers & Pages** → il Worker → **Settings → Domains & Routes → Add → Custom Domain**;
2. si inserisce `simonepetta.com`; Cloudflare **crea il record DNS ed emette il certificato** da solo.

Oppure via Wrangler, dichiarativo:
```jsonc
{
  "routes": [
    { "pattern": "simonepetta.com", "custom_domain": true },
    { "pattern": "www.simonepetta.com", "custom_domain": true }
  ]
}
```

⚠️ Vincoli verificati:
- non si può creare un Custom Domain su un hostname che ha **già un record CNAME**;
- ✅ **Workers non supporta domini i cui nameserver non sono gestiti da Cloudflare** (Pages sì). Per noi è irrilevante — il dominio è su Cloudflare — ma è la differenza da ricordare se un giorno si cambia registrar.
- Un Custom Domain punta **tutti i path** del dominio al Worker. Per mandare solo `/api/chat` al Worker si usa una **route** invece di un custom domain.

**Su Pages** ([Custom domains](https://developers.cloudflare.com/pages/configuration/custom-domains/)): stesso flusso dal progetto Pages; se il dominio è nello stesso account il record viene creato in automatico.

🧠 Costo: **zero**. Nessun upgrade di piano zone richiesto: il piano Free della zone basta, e il Registrar vende a prezzo di costo (rinnovo ~$10-12/anno per un `.com`, già pagato).

---

## 4. Framework supportati e attriti noti

✅ Pages ha preset di build documentati ([Build configuration](https://developers.cloudflare.com/pages/configuration/build-configuration/)) per, tra gli altri:

| Framework | Build command | Output dir |
|---|---|---|
| **Astro** | `npm run build` | `dist` |
| **Eleventy** | `npx @11ty/eleventy` | `_site` |
| **SvelteKit** | `npm run build` | `.svelte-kit/cloudflare` |
| Hugo | `hugo` | `public` |
| Docusaurus | `npm run build` | `build` |
| React (Vite) | `npm run build` | `dist` |
| Next.js (static export) | `npx next build` | `out` |
| Nuxt, Qwik, Remix, Angular, Vue, Gatsby, Gridsome, Ember, Brunch, GitBook, Analog, Elder.js | — | — |

✅ Su Workers esiste l'[automatic configuration](https://developers.cloudflare.com/workers/framework-guides/automatic-configuration/): `create-cloudflare` configura da solo l'adapter — **Astro** → `@astrojs/cloudflare` (`astro add cloudflare`), **SvelteKit** → `@sveltejs/adapter-cloudflare` (`sv add sveltekit-adapter`), Nuxt/Solid via preset built-in, React Router / TanStack Start via Cloudflare Vite plugin.

### Attriti reali, per candidato

**Eleventy** 🧠 — attrito ~zero, ed è l'unico dei tre che non ha *nessun* adapter Cloudflare da mantenere. Produce HTML statico in `_site` e finisce lì. Nessun runtime, nessun adapter, nessuna dipendenza dal futuro di Cloudflare. Rovescio: nessuna architettura a isole nativa (l'isola chat va montata a mano con uno `<script type="module">` o un web component) — il che, visto che l'utente **vuole esplorare le isole**, è una nota a sfavore, non a favore.

**Astro** 🧠 — il candidato naturale per questo progetto: l'**architettura a isole è la sua tesi centrale** (esattamente ciò che la mappa dice di voler esplorare), output statico di default con zero JS, e l'isola React sulla sola chat (vincolo 7 della mappa) è letteralmente il caso d'uso canonico di `client:visible`/`client:load`. Attrito noto: l'adapter `@astrojs/cloudflare` serve **solo per SSR** — in modalità `output: 'static'` non serve affatto, e il build è HTML puro in `dist`. 🧠 Nel nostro caso non lo vogliamo: l'endpoint dinamico è **uno solo** e sta meglio come Worker separato (vedi §5) che come route SSR dentro l'app.

**SvelteKit** ⚠️ — l'attrito più concreto dei tre: la build output dir è `.svelte-kit/cloudflare`, cioè **passa obbligatoriamente per `adapter-cloudflare`**, che è un pezzo di toolchain in più che va tenuto aggiornato con la piattaforma. Per un sito prevalentemente statico paghi un adapter per non usarlo. `adapter-static` esiste, ma allora stai usando SvelteKit come generatore statico e tanto valeva Astro/Eleventy.

🧠 **Raccomandazione**: **Astro in `output: 'static'`**, con l'isola chat come unico componente idratato e il proxy LLM come Worker separato. Copre esplorazione-isole + statico-per-default + isola React ammessa, senza SSR e senza adapter.

⚠️ **Attrito trasversale** su Pages (tutti i framework): il v3 build image non legge `engines` da `package.json` né la versione dai lockfile — serve un `.node-version` committato o le build diventano non riproducibili nel tempo.

---

## 5. ⭐ Tetto di spesa DURO — la domanda che conta

### La risposta secca

> ✅ **A livello di account Cloudflare NON esiste un hard spending cap. Esistono solo alert.**

Citazione testuale da [Budget alerts](https://developers.cloudflare.com/billing/manage/budget-alerts/):

> *"Budget alerts are informational only. They do not pause or cap usage."*

E dal [changelog del 15 giu 2026](https://developers.cloudflare.com/changelog/post/2026-06-15-budget-alerts-default-on/) (budget alert attivati di default a $10 sui conti Pay-as-you-go):

> *"The alert is informational only. It does not cap your usage or impact your account in any way."*
> *"Usage is processed once per day for the prior day's activity, so budget alerts fire the day after the threshold is reached rather than in real time."*

⚠️ Quindi il peggior caso è: attacco alle 02:00, mail di alert **il giorno dopo**, fattura già maturata. **Non si può chiedere a Cloudflare di spegnere l'account a una certa cifra.** Va scritto nero su bianco nella SPEC come rischio accettato e mitigato altrove.

### I cap duri che invece esistono (e sono quattro)

**a) ✅ Restare sul Workers Free plan = hard cap per costruzione.**
Non essendoci billing attivo su Workers, non c'è spesa possibile. A 100.000 richieste/giorno il Worker smette (`1027`), con route in *fail open* per non rompere niente. È il cap più duro che esista, ed è gratis. 🧠 Per un sito personale, 100k richieste/giorno di **solo endpoint chat** sono un ordine di grandezza sopra il traffico realistico.

**b) ✅ AI Gateway spend limits — l'unico vero budget in dollari.**
[Spend limits](https://developers.cloudflare.com/ai-gateway/features/spend-limits/) (GA dal 5 giu 2026):
> *"When cumulative spend reaches the limit within a time window, AI Gateway blocks further requests with a `429` response until the window resets."*
- Budget **in dollari** su finestra temporale **fissa o rolling**;
- scopabile per **model**, **provider**, o **custom metadata** (es. user id, sessione);
- ✅ funziona sia con **Unified Billing** sia con **BYOK** (chiavi proprie), per i modelli con pricing noto;
- ✅ alternativa al blocco: **fallback a un modello più economico** via Dynamic Route, invece di restituire 429;
- ⚠️ max **20 regole per gateway**;
- ⚠️ **eventually consistent**: un burst concorrente può sforare brevemente prima che l'enforcement recuperi;
- ⚠️ il costo è **best-effort estimation** su token count e pricing del modello — per la cifra esatta vale la dashboard del provider.

🧠 **Questo è il pezzo che risolve il vincolo 1 della mappa.** "Se la chat esaurisce il budget" smette di essere un'ipotesi da gestire a mano e diventa una regola dichiarata: *$X/mese su questo modello, poi 429*. Ed è **gratis** — AI Gateway non costa nulla.

**c) ✅ Limiti per-invocazione in Wrangler** (`limits.cpu_ms`, `limits.subrequests`) — bound sul costo *unitario*, anti-denial-of-wallet per singola richiesta. Non un budget totale.

**d) 🧠 Cap lato provider LLM.** OpenAI/Anthropic/etc. espongono budget e usage limit sulla chiave. Da impostare comunque, come seconda rete: è il cap che vale anche se AI Gateway sbaglia la stima.

### Difesa in profondità proposta 🧠

```
1. WAF rate limiting rule (IP)      → taglia il flood prima che tocchi compute   [gratis]
2. Rate limiting binding nel Worker → cap per sessione/identificatore            [gratis]
3. Workers Free plan                → tetto duro 100k req/giorno, spesa impossibile
4. limits.cpu_ms + limits.subrequests → bound sul costo della singola invocazione
5. AI Gateway spend limit ($/finestra) → HARD CAP in dollari, 429 al superamento  [gratis]
6. Budget cap sulla chiave del provider → rete di sicurezza indipendente
7. Budget alert Cloudflare ($)      → solo notifica, ma è l'unico segnale che qualcosa è sfuggito
```
Nessuno di questi livelli tocca gli static asset. 🧠 Il sito non si rompe mai per budget **per costruzione**, non per configurazione fortunata.

### Come si tiene viva la statica quando il Worker è spento o a budget esaurito

✅ [Static assets · Billing and limitations](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/):
> *"Requests to static assets are free and unlimited."* — su free **e** su paid. *"There is no additional cost for storing Assets."*

✅ E su Pages ([Functions pricing](https://developers.cloudflare.com/pages/functions/pricing/)): *"On both free and paid plans, requests to static assets are free and unlimited. A request is considered static when it does not invoke Functions."*

⚠️ **L'unica trappola documentata**: con l'opzione `run_worker_first`, le richieste che matchano quei pattern invocano il Worker e **contano** verso il free tier; superate le 100k/giorno quelle richieste ricevono `429` **senza fallback allo static asset serving**.

🧠 **Regola architetturale che ne discende** (da mettere in SPEC): **il Worker non sta mai davanti agli asset.** Niente `run_worker_first` globale. Due forme accettabili:
- **(A) due deployment separati** — un Worker "sito" con solo `assets.directory` e nessun `main`, più un Worker "chat" separato montato su `api.simonepetta.com` o su route `/api/chat*`. Isolamento totale: il Worker chat può essere disabilitato, andare in 429 o sforare la quota, e il sito statico non se ne accorge.
- **(B) un solo Worker** con `assets` + `main`, dove il Worker gira solo sui path che non matchano un asset. Più semplice da deployare, ma la quota è condivisa e un'anomalia sulla chat consuma il budget richieste del Worker.

🧠 Preferisco **(A)**: rende il vincolo 1 della mappa una proprietà del deployment, non una disciplina di codice. Il kill switch diventa letteralmente "cancella la route del Worker chat" e la chat degrada a una sezione che dice "non disponibile", mentre letture e appunti non si accorgono di nulla.

---

## 6. Rate limiting per IP su un Worker — tre strade, tutte gratis

### a) ✅ Rate limiting binding (nativo Workers)
[Rate limiting binding](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/) — richiede Wrangler ≥ **4.36.0**.
```jsonc
{
  "ratelimits": [
    { "name": "CHAT_LIMITER", "namespace_id": "1001", "simple": { "limit": 20, "period": 60 } }
  ]
}
```
```js
const { success } = await env.CHAT_LIMITER.limit({ key: identificatore });
if (!success) return new Response("Rate limited", { status: 429 });
```
✅ Caratteristiche verificate:
- `period` accetta **solo 10 o 60 secondi**;
- il contatore è **per data center Cloudflare**, non globale — un limite di 100/min vale 100/min *a Sydney* e altri 100/min *a Londra*;
- *"permissive, eventually consistent, and intentionally designed to not be used as an accurate accounting system"*;
- nessuna visibilità in dashboard: si osserva via Workers Logs/Traces o Analytics Engine;
- ⚠️ **la doc sconsiglia esplicitamente di usare l'IP come chiave**: *"many users may share a single IP, especially on mobile networks or when using privacy-enabling proxies"*. Chiavi consigliate: API key, user id, tenant id, path.
- ⚠️ ✅ **Non disponibile su Pages Functions** — la compatibility matrix Pages↔Workers elenca "Rate Limiting bindings" tra le feature che Workers ha e Pages no.

💰 Costo: nessuna tariffa separata documentata. 🧠 Di fatto gratis, incluso nel piano Workers.

### b) ✅ WAF rate limiting rules (livello zone, prima del Worker)
[Rate limiting rules](https://developers.cloudflare.com/waf/rate-limiting-rules/) — disponibile **anche sul piano Free**, con parametri ridotti:

| | Free | Pro | Business | Enterprise |
|---|---|---|---|---|
| Numero di regole | ✅ **1** | 2 | 5 | 100 |
| Caratteristica di conteggio | ✅ **IP** (preimpostata) | IP | IP, IP con NAT | molte (path, header, JA4, body…) |
| Periodo max | ✅ **10 s** | 1 min | 10 min | 65.535 s |
| Durata mitigazione max | ✅ **10 s** | 1 h | 1 giorno | 1 giorno |
| Azioni | ✅ **Block** | + Managed Challenge | + | + throttle |

🧠 Il vantaggio grosso: la WAF rule agisce **prima** del Worker, quindi una richiesta bloccata non consuma né quota né CPU. Il free plan è però rigido (1 regola, finestra 10 s, blocco 10 s): serve a tagliare un flood, non a fare quote per utente. Esempio praticabile: `http.request.uri.path eq "/api/chat" and http.request.method eq "POST"` → più di N richieste / 10 s da un IP → Block per 10 s.

### c) 🧠 Durable Objects
Contatore forte e globalmente consistente per chiave. È l'unica delle tre che dà un conteggio esatto.
⚠️ **Non gratis in senso stretto**: i DO in JavaScript richiedono il piano Workers Paid, e si pagano per richiesta + duration. 🧠 Sproporzionato per un sito personale: introduce spesa proprio nel sistema che deve prevenire spesa. Da scartare.

### 🧠 Raccomandazione
**(b) come scudo esterno + (a) come quota applicativa.** Per la chiave del binding, non l'IP nudo: un token di sessione firmato emesso dal sito statico, oppure `hash(IP + User-Agent + giorno)` come degradazione accettabile. E, sopra tutto, il vero limite di spesa non è il rate limit — è lo spend limit di AI Gateway (§5b). Il rate limit protegge dal rumore; lo spend limit protegge dal portafoglio.

---

## 7. Workers AI e AI Gateway cambiano il quadro?

### AI Gateway — ✅ sì, e in meglio. Da adottare.
[Pricing](https://developers.cloudflare.com/ai-gateway/reference/pricing/): *"AI Gateway's core features available today are offered for free"*. Gratis: analytics, caching, rate limiting, DLP.

Cosa porta, verificato:
- ✅ **Spend limits** in dollari con blocco `429` (§5b) — il pezzo decisivo;
- ✅ **BYOK / Store Keys** ([doc](https://developers.cloudflare.com/ai-gateway/configuration/bring-your-own-keys/)): la chiave del provider vive in **Cloudflare Secrets Store**, referenziata dal gateway, e **non passa più nelle request**. 🧠 Questo **cambia la natura del ticket**: "un proxy che protegge una API key" diventa, in buona parte, un problema già risolto dalla piattaforma. Il Worker resta necessario — per auth/rate limit/validazione e per non esporre il gateway al mondo — ma non è più lui il custode del segreto;
- ✅ **caching** delle risposte (TTL fino a 1 mese, request ≤ 25 MB) → 🧠 su una chat sugli appunti, dove le domande si ripetono ("cos'è la trasformata di Fourier"), taglia costo reale;
- ✅ **fallback e retry** fra modelli/provider ([Dynamic routing](https://developers.cloudflare.com/ai-gateway/features/dynamic-routing/)): budget esaurito sul modello buono → degrada su uno economico invece di morire;
- ✅ **binding AI Gateway dentro il Worker** — la doc di authentication raccomanda esplicitamente il binding lato Worker invece dei token API, perché ⚠️ **i token AI Gateway sono account-scoped**: un token con `AI Gateway Run` può usare *ogni* gateway dell'account, incluse le chiavi BYOK. Da tenere a mente: quel token non va mai vicino al browser.

Limiti free ([Limits](https://developers.cloudflare.com/ai-gateway/reference/limits/)):
- ✅ **10 gateway** per account (paid: 20);
- ✅ **100.000 log** per account (paid: 10M per gateway); al raggiungimento si cancellano i più vecchi o si smette di salvare;
- ✅ 500 log/s per gateway; cache request ≤ 25 MB; 5 metadata custom per richiesta;
- ⚠️ Unified Billing: 200 richieste / 60 s per gateway (non si applica a BYOK) e **+5% sull'acquisto di crediti**.

🧠 Verdetto: **AI Gateway va messo nell'architettura a prescindere dal provider scelto.** È gratis, è l'unico posto dove esiste un hard cap in dollari, e sposta il segreto fuori dal codice.

### Workers AI — 🧠 opzione seria, ma non la prima scelta
[Pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/): **$0,011 / 1.000 Neuron**, con **10.000 Neuron/giorno gratis** su *entrambi* i piani (free e paid). Reset a 00:00 UTC; superato il limite, le operazioni falliscono con errore.

- ✅ Su Workers **Free** non si può andare oltre l'allocazione gratuita: **spesa impossibile per costruzione**. 🧠 È letteralmente un hard cap.
- ⚠️ [Alcuni modelli richiedono il piano Paid](https://developers.cloudflare.com/changelog/post/2026-07-28-models-require-workers-paid/) (da lug 2026: kimi-k2.6, kimi-k2.7-code, glm-5.2 → `403` / errore 5035 sul free). Restano disponibili su free modelli come `glm-4.7-flash`, `gemma-4-26b-a4b-it`, `nemotron-3-120b-a12b`.
- ✅ Rate limit per task: text generation **300 req/min** (default free).
- ✅ Nessuna chiave API da proteggere: si usa il binding `env.AI`. 🧠 Il problema originale del ticket — "un proxy che protegge una API key" — **sparisce del tutto**.

🧠 Perché comunque non lo metterei come prima scelta: la qualità di una chat su appunti universitari in italiano, con matematica, dipende quasi interamente dal modello. I modelli del catalogo free sono buoni ma non al livello dei frontier model, e questa è una vetrina pubblica ("il registro di uno che impara in pubblico") dove una chat mediocre danneggia più di quanto un costo zero aiuti.

🧠 **Strada consigliata**: modello frontier via **AI Gateway + BYOK**, con **spend limit** stretto, e **Workers AI come fallback dichiarato nella Dynamic Route** quando il budget è esaurito. Così budget finito ≠ chat morta: chat *degradata*, che è una storia migliore da raccontare su un sito che parla di imparare in pubblico. E se la misura del corpus dovesse dire che la v2 non regge economicamente, Workers AI puro resta il piano di ripiego a costo strutturalmente zero.

---

## 8. ⚠️ Pages o Workers? La scoperta che riapre la premessa del ticket

Il ticket assume "Pages + Workers". La documentazione 2026 dice altro.

✅ [Workers best practices](https://developers.cloudflare.com/workers/best-practices/workers-best-practices/):
> *"**Use Workers Static Assets for new projects.** Workers Static Assets is the recommended way to deploy static sites, single-page applications, and full-stack apps on Cloudflare. If you are starting a new project, use Workers instead of Pages. Pages continues to work, but new features and optimizations are focused on Workers."*

✅ E la pagina delle migration guide **di Pages stessa** apre con un banner:
> *"Are you sure you want to use Pages? Workers supports most Pages use cases and offers a broader feature set. It is Cloudflare's primary platform for building applications. **Start new projects with Workers.**"*

### Compatibility matrix (✅ dalla [migration guide](https://developers.cloudflare.com/workers/static-assets/migration-guides/migrate-from-pages/))

**Solo su Workers**: Cloudflare Vite plugin · Gradual Deployments · Remote Development · Quick Editor · Workers Logs / Logpush / Tail Workers / Source Maps · Cron Triggers · Queue Consumers · Email Workers · Image Resizing · **Rate Limiting bindings** · serving asset su path specifici · route non-root.

**Solo su Pages**: Early Hints (su Workers replicabile con header `Link`) · custom domain **fuori** dalle zone Cloudflare · controlli branch-deploy più granulari · custom branch alias ("coming soon" su Workers).

⚠️ Differenze operative da mettere in conto passando a Workers:
- il Git integration è **Workers Builds** (Node.js **24** di default da lug 2026), non le Pages build;
- ⚠️ a differenza di Pages, **Workers non condivide le variabili fra build-time e runtime** — vanno configurate separatamente;
- le preview vanno abilitate esplicitamente (`preview_urls`, `previews` in Wrangler + preview build), e ⚠️ i controlli per-branch sono oggi meno configurabili che su Pages.

### 🧠 Raccomandazione per la SPEC

**Workers Static Assets, non Pages.** Quattro ragioni, in ordine di peso:
1. ⚠️ **Il rate limiting binding non esiste su Pages Functions.** Il ticket chiede rate limiting per IP sull'endpoint chat: su Pages resterebbe solo la WAF rule (1 regola, finestra 10 s sul free). Da solo basta a decidere.
2. ✅ Cloudflare raccomanda formalmente Workers per i progetti nuovi, e concentra lì feature e ottimizzazioni. 🧠 Costruire nel 2026 su Pages significa costruire su un binario in manutenzione: non rompe domani, ma ogni feature nuova arriverà altrove.
3. 🧠 Il vincolo "una sola cosa dinamica, tutto il resto statico" si esprime meglio come **due Worker separati** (§5) che come progetto Pages + Functions, dove la Function vive dentro lo stesso deployment del sito.
4. 🧠 Il Cloudflare Vite plugin (solo Workers) è il dev loop migliore, e Astro sta su Vite.

Nessuna delle feature esclusive di Pages ci serve: il dominio **è** su Cloudflare (l'unica esclusiva davvero bloccante non ci tocca), e Early Hints si fa con gli header.

---

## 9. Sintesi dei costi reali attesi 🧠

| Scenario | Costo/mese |
|---|---|
| Solo statico (v0 + v1), Workers Free | **$0** — static asset gratuiti e illimitati, build incluse |
| + chat su Workers AI free (10k Neuron/die) | **$0** — hard cap per costruzione, ma modelli limitati |
| + chat su modello frontier via AI Gateway BYOK, Workers Free | **solo i token del provider**, con hard cap via spend limit. AI Gateway $0, Workers $0 |
| Se servisse Workers Paid (CPU > 10 ms o > 100k req/die) | **$5/mese** + eccedenze (10M req e 30M CPU-ms inclusi) |

🧠 Per il traffico realistico di un sito personale, **v0 e v1 costano zero e non possono costare altro**. Il solo costo variabile è la v2, ed è esattamente il costo che AI Gateway spend limits sa tagliare in modo duro.

---

## Domande che questa ricerca lascia aperte

🧠 Non sono decisioni che questo ticket può chiudere; le segnalo per la mappa:
1. **Quanti file produce il corpus appunti?** Il limite 20.000 file del free tier è l'unico limite di piattaforma che può mordere davvero, e dipende dalla misura del corpus (già in "Not yet specified").
2. **Chi identifica l'utente della chat?** Il rate limiting binding sconsiglia l'IP come chiave. Serve decidere se emettere un token di sessione dal sito statico, usare Turnstile, o accettare la degradazione `hash(IP+UA)`.
3. **Quale provider LLM**, e quindi quale integrazione AI Gateway (Unified Billing con +5% sui crediti vs BYOK con fatturazione diretta dal provider).
4. **Quanto vale il budget mensile della chat in dollari?** Lo spend limit è una cifra, e va decisa da una persona.
5. **Workers Builds vs GitHub Actions + `wrangler deploy`.** 🧠 La seconda dà più controllo sui branch (dove Workers Builds è oggi più povero di Pages) e nessun lock-in sulla CI; si lega a "Come si aggiorna il sito nel tempo" nella mappa.

---

## Fonti (tutte developers.cloudflare.com)

- [Pages · Limits](https://developers.cloudflare.com/pages/platform/limits/)
- [Pages · Functions pricing](https://developers.cloudflare.com/pages/functions/pricing/)
- [Pages · Build configuration](https://developers.cloudflare.com/pages/configuration/build-configuration/)
- [Pages · Build image](https://developers.cloudflare.com/pages/configuration/build-image/)
- [Pages · Migration guides](https://developers.cloudflare.com/pages/migrations/) (banner "Start new projects with Workers")
- [Workers · Limits](https://developers.cloudflare.com/workers/platform/limits/)
- [Workers · Pricing](https://developers.cloudflare.com/workers/platform/pricing/)
- [Workers · Best practices](https://developers.cloudflare.com/workers/best-practices/workers-best-practices/)
- [Workers · Wrangler configuration (limits)](https://developers.cloudflare.com/workers/wrangler/configuration/#limits)
- [Workers · Custom Domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/)
- [Workers · Static assets billing and limitations](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/)
- [Workers · Migrate from Pages (compatibility matrix)](https://developers.cloudflare.com/workers/static-assets/migration-guides/migrate-from-pages/)
- [Workers · Rate limiting binding](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/)
- [Workers · Framework automatic configuration](https://developers.cloudflare.com/workers/framework-guides/automatic-configuration/)
- [WAF · Rate limiting rules](https://developers.cloudflare.com/waf/rate-limiting-rules/)
- [Billing · Budget alerts](https://developers.cloudflare.com/billing/manage/budget-alerts/)
- [Changelog · Budget alerts on by default (15 giu 2026)](https://developers.cloudflare.com/changelog/post/2026-06-15-budget-alerts-default-on/)
- [Changelog · Subrequests limit (11 feb 2026)](https://developers.cloudflare.com/changelog/post/2026-02-11-subrequests-limit/)
- [Changelog · Pages file limit increase (23 gen 2026)](https://developers.cloudflare.com/changelog/post/2026-01-23-pages-file-limit-increase/)
- [AI Gateway · Spend limits](https://developers.cloudflare.com/ai-gateway/features/spend-limits/)
- [AI Gateway · Pricing](https://developers.cloudflare.com/ai-gateway/reference/pricing/)
- [AI Gateway · Limits](https://developers.cloudflare.com/ai-gateway/reference/limits/)
- [AI Gateway · BYOK (Store Keys)](https://developers.cloudflare.com/ai-gateway/configuration/bring-your-own-keys/)
- [AI Gateway · Authentication](https://developers.cloudflare.com/ai-gateway/configuration/authentication/)
- [Workers AI · Pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/)
- [Workers AI · Limits](https://developers.cloudflare.com/workers-ai/platform/limits/)
- [Changelog · Select models require Workers Paid (28 lug 2026)](https://developers.cloudflare.com/changelog/post/2026-07-28-models-require-workers-paid/)
