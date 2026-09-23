# Architettura a isole — ricerca per simonepetta.com

> Risponde a [#2 — Capire l'architettura a isole](https://github.com/Simi24/simonepetta.com/issues/2).
> Ricerca svolta il **2026-09-23**. Tutte le versioni e le misure di peso sono state verificate a quella data (npm registry, JSR, GitHub API, misurazione diretta dei bundle).
>
> **Convenzione di lettura**: le sezioni marcate `[VERIFICATO]` poggiano su documentazione ufficiale o su dati che ho misurato; quelle marcate `[VALUTAZIONE]` sono mie interpretazioni e possono essere contestate.

---

## 0. TL;DR

L'architettura a isole è una cosa semplice travestita da termine di moda: **la pagina è HTML statico, e solo i pezzi che devono essere interattivi ricevono JavaScript, ciascuno per conto suo**. Non è un framework, è un modo di decidere *dove* finisce il JS.

Per simonepetta.com la risposta alla domanda che conta — *"posso avere la chat in React e il resto no, senza sotto-domini?"* — è **sì, e il meccanismo è esattamente questo**. Il candidato di gran lunga più solido nel 2026 è **Astro**. Gli altri (Fresh, Eleventy + `<is-land>`, Enhance) sono o più di nicchia, o più scomodi, o fermi.

Ma il corollario onesto è più interessante: **per v0 e v1 di questo sito le isole quasi non servono**. Servono per una cosa sola, la chat di v2. Il valore di Astro qui non è "fa le isole", è che **rende le isole un non-problema quando arriveranno**, senza costringerti a pagarle prima.

---

## 1. Cos'è concretamente [VERIFICATO]

### Origine

Il termine "Component Islands" è stato coniato da **Katie Sylor-Miller** (frontend architect di Etsy) nel 2019, e diffuso da **Jason Miller** (Preact) nel post [*Islands Architecture*](https://jasonformat.com/islands-architecture/) del 2020. La definizione originale, testuale:

> "Render HTML pages on the server, and inject placeholders or slots around highly dynamic regions."

Ogni regione interattiva viene poi idratata separatamente, come "self-contained widget, reusing their server-rendered initial HTML".

### Il modello mentale

Immagina la pagina come **un mare di HTML statico con dentro delle isole**. Il mare (testo, immagini, layout, navigazione, tipografia) è HTML e CSS puri: zero JavaScript, arrivano già renderiti dal server o dalla build. Le isole (un player, una search box, una chat) sono componenti veri, con il loro stato e il loro runtime, che si "accendono" ognuna per conto sua.

Le tre proprietà che definiscono il modello, sempre dal post originale:

1. **Non c'è rendering top-down.** Una SPA con SSR deve idratare la radice dell'albero prima di arrivare al bottone in fondo alla pagina. Con le isole no: ogni isola è indipendente.
2. **Isolamento dei guasti.** "A performance issue in one unit doesn't affect the others" — se l'isola della chat esplode, la pagina resta leggibile.
3. **Il server rendering non è un optional per la SEO.** È il modo normale in cui la pagina viene consegnata; il JS è l'eccezione.

### Il problema che risolve

Il costo dell'**hydration**. In una SPA con SSR il server manda HTML già fatto, ma poi il browser deve scaricare l'intero albero dei componenti in JavaScript e ri-eseguirlo per "riattaccare" gli handler. Paghi due volte lo stesso contenuto: una in HTML, una in JS. E fino a che quell'hydration non finisce, la pagina è una fotografia: si vede, non risponde.

Le isole rompono questo accoppiamento: **l'HTML che non ha bisogno di diventare interattivo non ha un corrispettivo JavaScript**. Non viene rimandato, non viene idratato pigramente — semplicemente non esiste lato client.

### Il problema che NON risolve [VERIFICATO + VALUTAZIONE]

Questo è il punto che la maggior parte dei tutorial salta, e che dovrebbe interessarti di più.

- **Non risolve la condivisione di stato.** Le isole sono processi separati per costruzione. Due isole React sulla stessa pagina non condividono un Context, non condividono un `useState`. Se devono parlarsi servono meccanismi espliciti: uno store esterno (Nano Stores), custom event sul DOM, `URLSearchParams`, o promuovere l'isola a un'isola sola più grande. Fresh lo documenta esplicitamente come argomento a sé ("Sharing state between islands"). `[VERIFICATO]`
- **Non risolve le transizioni tra pagine.** Il modello nativo è multi-page: ogni navigazione è un caricamento pieno. Ci sono cerotti (View Transitions API, Astro `<ClientRouter>`, Turbo), ma la sensazione "app" con stato che sopravvive alla navigazione non è gratis. `[VALUTAZIONE]`
- **Non risolve il fetching duplicato.** Se tre isole vogliono lo stesso dato, fanno tre chiamate, salvo coordinarle a mano. `[VERIFICATO — è un problema noto e documentato nella letteratura sul pattern]`
- **Non riduce il costo del runtime del framework *dentro* l'isola.** Un'isola React resta React: paghi il runtime. Le isole riducono *quante* pagine e quante porzioni lo pagano, non quanto pesa. `[VALUTAZIONE, ma banale da verificare]`
- **Non è un sostituto della progettazione.** Come dice patterns.dev: *"You give up the simplicity of 'one component tree, one mental model'. You have to think explicitly about which components need to be interactive and how (if at all) they communicate."* `[VERIFICATO]`

---

## 2. Cosa cambia davvero nel codice e nell'output [VERIFICATO]

Prendiamo lo stesso identico contenuto — una pagina di appunti con un blocco di testo lungo e un bottone "copia il LaTeX" — nei tre modelli.

### SPA (React + Vite, client-side rendering)

**Output HTML del server:**

```html
<div id="root"></div>
<script type="module" src="/assets/index-a1b2c3.js"></script>
```

Il contenuto **non esiste** nell'HTML. Esiste solo dopo che il bundle è stato scaricato, parsato ed eseguito. Con SSR (Next, Remix) l'HTML contiene il testo, ma il bundle viene scaricato comunque perché serve a idratare tutto l'albero.

**JS spedito:** il runtime del framework + tutti i componenti della pagina + il router. Misurato da me il 2026-09-23 sui bundle di produzione UMD: `react@18.3.1` = 4,3 KB gzip, `react-dom@18.3.1` = 43,0 KB gzip, quindi **~47 KB gzip di solo runtime**, prima di una singola riga di codice tuo. (React 19 è nello stesso ordine di grandezza; Preact, per confronto, è 4,8 KB gzip.)

### SSG puro (Eleventy/Hugo/Jekyll senza JS, o Astro senza isole)

**Output HTML:**

```html
<article><h1>Analisi 2</h1><p>Sia \(f\) una funzione…</p></article>
<button id="copy">Copia LaTeX</button>
<script>document.getElementById('copy').onclick = …</script>
```

**JS spedito:** solo quello che scrivi tu, a mano. Nessun runtime. È imbattibile finché l'interattività resta al livello "un bottone, un toggle". Diventa doloroso quando il pezzo interattivo ha stato reale — una chat con cronologia, streaming, errori, retry — perché ti ritrovi a riscrivere a mano il sistema di rendering reattivo che i framework ti darebbero.

### Isole (Astro)

**Codice sorgente** — la differenza sta tutta in una parola:

```astro
---
import Prose from '../components/Prose.astro';
import Chat from '../components/Chat.tsx';   // React
---
<Prose />                    <!-- 0 KB di JS: renderizzato a HTML, il JS viene buttato via -->
<Chat client:visible />      <!-- isola: React arriva solo quando entra nel viewport -->
```

`client:visible` è una **direttiva**, cioè un'annotazione sul *quando*, non sul *cosa*. La documentazione ufficiale Astro le elenca così:

| Direttiva | Semantica testuale dai doc |
|---|---|
| `client:load` | "Load and hydrate the component JavaScript immediately on page load." |
| `client:idle` | "…once the page is done with its initial load and the `requestIdleCallback` event has fired." Opzione `timeout`. |
| `client:visible` | "…once the component has entered the user's viewport." Opzione `rootMargin`. |
| `client:media` | "…once a certain CSS media query is met." |
| `client:only={framework}` | "**skips** HTML server rendering, and renders only on the client." Il nome del framework è obbligatorio perché "Astro doesn't run the component during your build / on the server". |
| `server:defer` | rende il componente un **server island**: renderizzato on-demand, fuori dal rendering del resto della pagina. |

E il comportamento di default, testuale:

> "By default, Astro will automatically render every UI component to just HTML & CSS, **stripping out all client-side JavaScript automatically.**"

**Output HTML:** il contenuto statico è HTML normale. L'isola diventa un custom element con il suo payload isolato, circa così:

```html
<article><h1>Analisi 2</h1><p>…</p></article>   <!-- statico, 0 KB -->
<astro-island uid="Z1xk9" component-url="/_astro/Chat.DhF2.js"
              renderer-url="/_astro/client.Bq7.js" client="visible"
              props='{"endpoint":"/api/chat"}'>
  <!-- HTML pre-renderizzato della chat, visibile e leggibile subito -->
</astro-island>
```

Il punto strutturale: **il `component-url` viene richiesto solo quando la condizione si avvera**. Prima di allora la pagina ha spedito zero byte di React.

### La differenza che conta davvero [VALUTAZIONE]

Non è la dimensione del bundle in sé. È **dove si trova il default**.

- SPA: il default è "tutto è JavaScript"; togliere JS è lavoro.
- SSG puro: il default è "niente è JavaScript"; aggiungere interattività strutturata è lavoro.
- Isole: il default è "niente è JavaScript", ma **aggiungerlo costa una parola** e resta circoscritto.

Con un default sbagliato, in due anni il sito peggiora da solo. Con quello giusto, resta leggero anche se smetti di stare attento. Per un sito che vuoi mantenere con attrito ~zero per anni, questa è la proprietà che vale, non i KB.

---

## 3. I framework nel 2026 [VERIFICATO — versioni controllate il 2026-09-23]

### Astro — 7.3.4 (pubblicata il 2026-09-22)

62.757 stelle, 72 issue aperte, ultimo push il giorno prima della ricerca. È il progetto più vivo del gruppo, di parecchio.

- **Modello**: isole opt-in via `client:*`, più i **server islands** (`server:defer`) introdotti nella linea 5.x e ora maturi.
- **Multi-framework**: React, Preact, Vue, Svelte, Solid, Lit — anche **insieme nella stessa pagina**. Dai doc: *"Because they are independent, you can even mix several frameworks on each page."*
- **Anche senza framework**: i `<script>` normali sono processati, bundlati, deduplicati e convertiti in `type="module"` automaticamente (`is:inline` per uscirne). I doc dicono esplicitamente che questo *"avoids the overhead of shipping framework JavaScript and doesn't require you to know any additional framework"*. **Quindi puoi fare isole con web component vanilla e non installare mai React.**
- **Novità 7.0** (rilasciata il 2026-06-22): compilatore `.astro` riscritto in **Rust**, Vite 8 con **Rolldown**, pipeline Markdown Rust, build dal 15% al 61% più veloci, `src/fetch.ts` per controllare la request pipeline in stile Workers, route caching stabile con provider CDN incluso Cloudflare.
- **Contro onesti** `[VALUTAZIONE]`: è un progetto che si muove in fretta e fa major release frequenti (5 → 6 → 7 in circa un anno e mezzo); Astro 6 ha rimosso le legacy content collections, Astro 7 ha cambiato compilatore. Non è instabilità, ma non è nemmeno "installo e non ci penso per cinque anni". Va messo in conto un upgrade ogni tanto.

### Fresh (Deno) — 2.3.3 su JSR

Repo migrato a `freshframework/fresh`, 13.789 stelle, 158 issue aperte, ultimo push 2026-08-02.

- **Modello**: convenzione di cartella invece di direttive. *"Islands are defined by creating a file in the `islands/` folder"*. Tutto il resto è statico per costruzione. Concettualmente più pulito di Astro: non c'è modo di sbagliare per distrazione.
- **Runtime**: Preact + Signals, punto. Niente React, niente Vue.
- **Vincoli reali, dai doc**: le props devono essere serializzabili, *"Passing functions to an island is not supported"*; le API del browser vanno protette con `IS_BROWSER`. In compenso puoi passare **JSX server-renderizzato come children di un'isola**, che è una bella proprietà.
- **Stato del progetto** `[VALUTAZIONE, su base verificata]`: Fresh 2 è stato annunciato con largo anticipo e ha sforato parecchio. Il post ufficiale di Deno del 2025-05-15 ammette testualmente *"we have announced plans to start working on Fresh 2 a long while ago and it isn't out yet a year later"*, con target stabile "late Q3 2025". È arrivato, gira su Vite e ora supporta Cloudflare Workers — ma la traiettoria dice "progetto sano legato alla roadmap commerciale di Deno", non "scommessa sicura per cinque anni". E ti vincola all'ecosistema Deno.

### Eleventy + `<is-land>` — Eleventy 3.1.6 (2026-06-02), is-land 5.0.1 (2025-12-02)

- **Modello**: `<is-land>` è un **web component indipendente da qualunque framework**, 1,79 kB compressi. Avvolgi il markup e dichiari la condizione: `on:visible`, `on:idle`, `on:interaction`, `on:media`, `on:save-data`, `on:load`. Dentro può esserci Preact, Svelte, Vue, Lit, Solid, Alpine, Petite Vue, o un custom element tuo.
- **Pro**: è la versione più onesta e meno magica del pattern. Nessun compilatore, nessuna convenzione nascosta, funziona su qualsiasi generatore statico — non solo Eleventy. Se vuoi *capire* le isole, questo è il codice da leggere: è piccolo abbastanza da starci dentro tutto.
- **Contro** `[VERIFICATO sui dati]`: Eleventy 4.0 è ancora in **alpha** (`4.0.0-alpha.10` sul canale canary), la stabile è la 3.1.6 di giugno. `<is-land>` non riceve commit da dicembre 2025 e ha 636 stelle. Non è abbandonato — è *piccolo e finito* — ma non c'è una comunità dietro. E soprattutto: **Eleventy non fa SSR di componenti di framework per te**. Il pezzo "renderizza il componente sul server e poi idratalo" te lo cabli tu. `[VALUTAZIONE]` È il percorso didattico migliore e il percorso di manutenzione peggiore.

### Enhance — in declino [VERIFICATO]

Questo è il caso in cui vale la pena essere espliciti invece che diplomatici.

Enhance si descrive come *"an HTML-first full-stack web framework"* basato su **custom element renderizzati sul server** e progressive enhancement. Concettualmente bello e vicino agli standard. Ma i numeri dicono un'altra cosa:

- `@enhance/ssr` — ultima pubblicazione **2024-07-22** (oltre due anni fa)
- `@enhance/element` — **2024-07-04**
- `@enhance/types` — **2024-02-02**
- repo `enhance-ssr` — 169 stelle, ultimo commit **2025-09-18** (un aggiornamento di CI)

Inoltre è pensato per girare su **Begin / Architect / AWS Lambda**, non per l'hosting statico, e i doc non trattano la generazione statica come caso d'uso primario. `[VALUTAZIONE]` Per un sito personale che deve reggere anni con manutenzione minima, **non lo considererei**.

### Gli altri, in breve [VERIFICATO sulle versioni]

- **Qwik** — non è isole, è **resumability**: invece di idratare, serializza lo stato nell'HTML e scarica il singolo handler alla prima interazione. Idea bellissima. Ma Qwik 2 è a `2.0.0-beta.45` al 2026-09-22: **beta da moltissimo tempo**, ecosistema piccolo, sintassi con i `$` che è un costo cognitivo reale. `[VALUTAZIONE]` Non per un sito che vuoi finire.
- **Marko 6** — attivissimo (`@marko/runtime-tags` 6.3.53, pubblicata il giorno della ricerca), fa streaming SSR e hydration granulare a livello più fine delle isole. Ma la comunità è essenzialmente eBay più pochi altri. `[VALUTAZIONE]` Fuori scala per questo caso.
- **SvelteKit / Nuxt** — hanno modalità "no-JS per route" (`export const csr = false`, i componenti `.server.vue` di Nuxt). Si avvicinano al risultato, ma partono dal default opposto: sono framework per app che si possono alleggerire, non generatori statici che si possono appesantire. `[VALUTAZIONE]` SvelteKit 3 è peraltro in `next` (`3.0.0-next.27` del 2026-09-08).
- **React Server Components** — risolvono un problema imparentato (mandare meno JS) ma dentro un albero React unico, con il modello mentale di React e un server Node. Non è il caso d'uso di un sito di contenuti.

### Tabella di sintesi

| | Astro 7 | Fresh 2 | 11ty + is-land | Enhance |
|---|---|---|---|---|
| Versione (2026-09-23) | **7.3.4** | **2.3.3** | 3.1.6 / 5.0.1 | 4.0.3 *(lug 2024)* |
| Salute del progetto | molto attiva | attiva | bassa ma stabile | **ferma** |
| Come dichiari un'isola | direttiva `client:*` | cartella `islands/` | tag `<is-land>` | n/d (non è isole) |
| Framework ammessi | React, Preact, Vue, Svelte, Solid, Lit, vanilla | solo Preact | quasi tutti, ma li cabli tu | custom element |
| SSR dei componenti incluso | sì | sì | **no, a carico tuo** | sì |
| Output statico | sì, default | sì | sì | non primario |
| Cloudflare | adapter ufficiale + guida CF | via Vite plugin | banale (è statico) | no (AWS) |
| Zero-JS di default | sì | sì | sì | sì |

---

## 4. Quando le isole NON convengono [VERIFICATO + VALUTAZIONE]

Il pattern è sbagliato quando **l'interattività è globale invece che locale**. In ordine di gravità:

1. **Stato condiviso tra molte zone della pagina.** Carrello, editor collaborativo, dashboard con filtri che ricalcolano mezza schermata. Più isole devono parlarsi, più stai ricostruendo a mano quello che un framework ti dà gratis — e senza single source of truth i bug diventano cattivi.
2. **La superficie è *intrinsecamente* un'applicazione.** Inbox, editor di testo collaborativo, videochiamata, admin. Qui la SPA non è pigrizia, è la scelta giusta. Anche i doc di Astro lo ammettono di riflesso: altri framework *"excel at building more complex, application-like experiences: logged-in admin dashboards, inboxes, social networks, todo lists"*.
3. **Serve stato che sopravvive alla navigazione.** Un player audio che continua a suonare mentre cambi pagina è precisamente la cosa che le isole non fanno bene.
4. **Migrazione di una SPA esistente.** patterns.dev: *"Migrating an existing SPA to islands is non-trivial."* Non è un refactor, è una riscrittura.
5. **La pagina ha una sola isola grossa e nient'altro di statico.** Se il 90% della pagina è l'isola, le isole non ti stanno dando niente: hai una SPA con più cerimoniale.
6. **`[VALUTAZIONE]` Quando il sito è piccolo e l'interattività è un bottone.** Questo è il caso più frequente e il meno detto. Se l'unica cosa dinamica è un toggle del tema, un `<script>` di dodici righe batte qualunque isola, e la scelta giusta è un SSG puro. Le isole cominciano a ripagarsi quando esiste **almeno un componente con stato reale** che non vuoi scrivere a mano.

---

## 5. "Alcune sezioni con framework, altre no": il bundling basta? [VERIFICATO]

**Sì. Completamente. I sotto-domini non servono, e sarebbero anzi la soluzione peggiore.**

Il meccanismo, in Astro, sta su tre livelli indipendenti:

**a) Livello componente.** Un componente senza `client:*` viene renderizzato a HTML e il suo JavaScript **buttato via in build** — *"stripping out all client-side JavaScript automatically"*. Non "caricato dopo": eliminato. Quindi "React solo nella chat" significa letteralmente che nessun altro componente del sito genera un byte di React.

**b) Livello pagina.** Ogni pagina è una entry a sé e importa solo i chunk delle proprie isole. `/letture` non conosce l'esistenza del bundle di `/chat`. Non c'è un bundle applicativo condiviso da alleggerire: non c'è proprio.

**c) Livello rendering.** Con un adapter installato, la documentazione è esplicita: *"By default, your entire Astro site will be prerendered, and static HTML pages will be sent to the browser"*, e per rendere dinamica una sola rotta basta *"add `export const prerender = false` at the top of the individual page or endpoint you want to render on demand. The rest of your site will remain a static site."*

Questo terzo punto merita di essere notato, perché **mappa uno-a-uno sul vincolo 1 della mappa** ("statico per default, un solo endpoint dinamico"): un unico file `src/pages/api/chat.ts` con `export const prerender = false`, e tutto il resto del sito resta HTML su CDN. Se la chat finisce il budget, le letture e gli appunti non se ne accorgono — che è precisamente il comportamento richiesto, ottenuto per costruzione invece che per disciplina.

### Perché i sotto-domini sarebbero peggio `[VALUTAZIONE]`

Separare `chat.simonepetta.com` risolverebbe il bundling (che non è un problema) e creerebbe tre problemi veri: due deploy, due shell da tenere in pari, e cookie/CORS/sessioni tra origin diverse. La mappa dice esplicitamente che le tre release sono "release dello stesso sito, non progetti separati: stesso repo, stessa origin, stesso shell" — i sotto-domini contraddirebbero quel vincolo per risolvere un problema che il bundler risolve da solo.

---

## 6. Cosa significa per simonepetta.com `[VALUTAZIONE]`

Ricerca finita, qui comincia la mia opinione. È materiale per la SPEC, non una decisione presa.

**La quantità di interattività vera in questo sito è molto piccola.**

- *chi sono* — prosa. Zero JS.
- *letture* — elenco più reazioni scritte a mano. Zero JS. Eventualmente un filtro per anno, che è HTML più venti righe di script.
- *appunti universitari* — il rendering della matematica si fa **in build**. KaTeX/MathJax girano server-side e sputano HTML + CSS: il visitatore riceve formule già impaginate e **zero JavaScript**. Questa è la scelta che conta per la sezione più pesante del sito, ed è una scelta di pipeline, non di isole. Se servirà la ricerca sugli appunti, **Pagefind** fa un indice statico a build-time e carica i suoi chunk WASM solo quando si digita: è un'isola in tutto tranne il nome, e non richiede un framework.
- *chat* (v2) — **l'unica cosa che è davvero un'applicazione**. Stato di conversazione, streaming dei token, errori, retry, annullamento. Qui scriverla a mano è un lavoro noioso e pieno di bug, e un'isola è la risposta giusta.

Ne seguono tre osservazioni.

1. **Un SSG puro basterebbe per v0 e v1.** Detto senza giri: non è vero che ti *serve* l'architettura a isole oggi. Serve a v2.
2. **Ma sceglierla ora è comunque la scelta corretta**, perché il costo di adottarla adesso è zero (Astro senza isole *è* un SSG) e il costo di non averla a v2 è una migrazione. Compri un'opzione che non paghi.
3. **L'isola della chat non deve necessariamente essere React.** Il vincolo 7 della mappa dice "preferenza a evitarlo, non un divieto". Le alternative sono reali e misurate: Preact è **4,8 KB gzip** contro i **~47 KB** di React + react-dom, e per un widget di chat la differenza funzionale è nulla. Svelte è un'altra opzione sensata — il suo runtime non si misura allo stesso modo perché il compilatore emette codice specifico del componente, ma per un widget di queste dimensioni resta nell'ordine di pochi KB. `[VALUTAZIONE]` La ragione per scegliere React sarebbe voler riusare una libreria di chat già fatta; se la chat la scrivi tu, Preact vince su tutta la linea e rispetta la preferenza dichiarata invece di derogarci.

**Nota sull'hosting.** La mappa dice Cloudflare Pages, ma nel 2026 Cloudflare indirizza i progetti nuovi su **Workers con static assets**: la guida ufficiale Cloudflare per Astro non nomina più Pages, e l'adapter `@astrojs/cloudflare` è pensato per Workers. Pages non è deprecato e i progetti esistenti continuano a funzionare, ma le feature nuove vanno su Workers. `[VALUTAZIONE]` Vale la pena aprirci un ticket a sé, perché cambia il "dove vive l'endpoint della chat": su Workers, il sito statico e il proxy della chiave stanno nello stesso deploy, che è esattamente ciò che serve.

---

## 7. Domande che questa ricerca lascia aperte

Non le risolvo qui perché appartengono ad altri ticket, ma emergono da questa ricerca:

- **Pages o Workers?** Vedi sopra: incide sull'endpoint della chat e sul deploy. Il vincolo "Cloudflare" regge in entrambi i casi, il "come" no.
- **Quale runtime per l'isola della chat** — Preact, Svelte o React. Decidibile solo quando si sa se la chat riusa una libreria o no.
- **Il rendering LaTeX è una decisione di pipeline, non di framework.** È indipendente dalla scelta fatta qui e probabilmente è il pezzo tecnicamente più rischioso di tutto il progetto (5 anni di corsi, `\input` fragili, macro personali). Merita un ticket suo, ed è il vero collo di bottiglia di v1 — non l'architettura.

---

## Fonti

Documentazione ufficiale (primaria):

- [Astro — Islands architecture](https://docs.astro.build/en/concepts/islands/)
- [Astro — Template directives reference](https://docs.astro.build/en/reference/directives-reference/)
- [Astro — Server islands](https://docs.astro.build/en/guides/server-islands/)
- [Astro — On-demand rendering](https://docs.astro.build/en/guides/on-demand-rendering/)
- [Astro — Client-side scripts](https://docs.astro.build/en/guides/client-side-scripts/)
- [Astro — Why Astro](https://docs.astro.build/en/concepts/why-astro/)
- [Astro 7.0 release](https://astro.build/blog/astro-7/) (2026-06-22)
- [Fresh — Islands](https://usefresh.dev/docs/concepts/islands)
- [Deno — An Update on Fresh](https://deno.com/blog/an-update-on-fresh) (2025-05-15)
- [11ty/is-land](https://github.com/11ty/is-land)
- [Enhance docs](https://enhance.dev/docs/)
- [Cloudflare — Astro on Workers](https://developers.cloudflare.com/workers/framework-guides/web-apps/astro/)
- [Cloudflare — Migrate from Pages to Workers](https://developers.cloudflare.com/workers/static-assets/migration-guides/migrate-from-pages/)

Secondarie:

- [Jason Miller — Islands Architecture](https://jasonformat.com/islands-architecture/) (2020, post che ha diffuso il termine)
- [patterns.dev — Islands Architecture](https://www.patterns.dev/vanilla/islands-architecture/)

Dati misurati direttamente il 2026-09-23 (npm registry, JSR, GitHub API, `gzip -c | wc -c` sui bundle di produzione): versioni e date di pubblicazione di tutti i pacchetti citati; pesi di react, react-dom, preact.
