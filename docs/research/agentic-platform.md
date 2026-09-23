# AWS o Cloudflare per il carico agentico

> Research ticket: [Simi24/simonepetta.com#15](https://github.com/Simi24/simonepetta.com/issues/15) — mappa: [#1](https://github.com/Simi24/simonepetta.com/issues/1) — dipende da: [#3](https://github.com/Simi24/simonepetta.com/issues/3)
> Data ricerca: 2026-09-23. Fonti primarie: `docs.aws.amazon.com`, `aws.amazon.com/*/pricing`, `developers.cloudflare.com`, listino modelli Anthropic.
>
> **Convenzione**: ✅ = verificato su documentazione ufficiale, con link. 🧠 = mia valutazione / inferenza architetturale, non un fatto documentato.

---

## TL;DR — la raccomandazione

**Il sistema agentico va su AWS. Il sito resta su Cloudflare. Il tetto di spesa duro si compra su Cloudflare, gratis, e si usa anche per il backend AWS.**

Non è un pareggio travestito: l'agente — loop, tool, stato, valutazione — gira su AWS (Lambda + Terraform + DynamoDB + S3 Vectors), perché è lo stack che vale due volte e perché regge le domande di follow-up di un colloquio. Cloudflare contribuisce due cose che AWS **non ha**: il Worker davanti come unica porta pubblica (che elimina la questione CORS) e l'**AI Gateway spend limit**, che è l'unico tetto di spesa in dollari con blocco reale dell'intero confronto.

Le sei conclusioni che portano lì:

1. ✅ **Il tetto di spesa duro su AWS non esiste.** AWS Budgets si aggiorna "at least once per day" e le sue azioni sanno applicare una IAM policy / SCP o spegnere EC2/RDS — **nessuna tocca Lambda o Bedrock**. Perfino la quota di API Gateway è documentata come *best-effort*: "should be thought of as targets rather than guaranteed request ceilings".
2. ✅ **Su Cloudflare il tetto duro esiste ed è gratis**: AI Gateway spend limits, "blocks further requests with a `429` response until the window resets", funzionante anche in BYOK.
3. 🧠 **Il costo non decide niente.** A poche centinaia di richieste/mese l'infrastruttura costa **< $1/mese su AWS** e **$0–5/mese su Cloudflare**; i token del modello sono l'80–95% della bolletta su entrambe. Scegliere la piattaforma per risparmiare $4 è rumore.
4. 🧠 **Tenere sito e backend separati costa molto meno del previsto, a una condizione**: il Worker sta *davanti* alla Lambda, non accanto. Stessa origin → **CORS sparisce**, e il rate limiting binding di [#3](https://github.com/Simi24/simonepetta.com/issues/3) resta dov'era pensato.
5. 🧠 **AWS racconta meglio in un colloquio in Italia, ma non perché Cloudflare sia un giocattolo** — Durable Objects è un primitivo distribuito serio. AWS vince perché è la lingua che la stanza parla, e perché è il terreno dove *le domande di approfondimento gli fanno guadagnare punti* invece di doverle disinnescare spiegando cos'è un Worker.
6. 🧠 **Una chat RAG "retrieve → stuff → answer" NON è un esercizio agentico**: è una pipeline con una sola chiamata al modello. La versione genuinamente agentica dello stesso caso d'uso (3–4 tool, loop multi-step, stato in DynamoDB, citazioni verificabili, eval in CI) costa **~2–3× i token** — cioè pochi euro al mese — e mostra dieci volte tanto.

---

## 1. Cosa offre AWS per un carico agentico, nel 2026

### 1.1 ⚠️ Bedrock Agents è chiuso ai nuovi clienti

Il fatto che riscrive la mappa mentale di chiunque abbia studiato AWS agentic prima del 2026:

✅ [Amazon Bedrock Agents Classic maintenance mode](https://docs.aws.amazon.com/bedrock/latest/userguide/agents-classic-maintenance-mode.html):

> "Amazon Bedrock Agents (launched November 2023) is now Amazon Bedrock Agents Classic and will no longer be open to new customers starting on **July 30, 2026**."

E, senza scappatoie:

> "Can I request an exception to Bedrock Agents in a new account after July 30? **No. There is no exception process.** AWS automatically determines the allowlist based on whether your account has had Bedrock Agents activity in the past 12 months."

Un account nuovo che chiama `CreateAgent` riceve `AccessDeniedException` (HTTP 403). Il catalogo modelli di Classic è **congelato** alla data di maintenance mode.

🧠 **Conseguenza operativa**: se l'account AWS personale non ha usato Bedrock Agents nei 12 mesi precedenti, quella strada è chiusa in partenza. Non è un problema — è un regalo: elimina l'opzione peggiore (un agente definito in console, poco leggibile e poco raccontabile) e costringe alle due che restano.

### 1.2 Bedrock AgentCore — la piattaforma agentica ufficiale

✅ GA da ottobre 2025, con i componenti andati GA a scaglioni nel 2026. Due modi d'uso, entrambi documentati nella pagina di migrazione sopra:

- **Managed harness** (`agentcore create` / `add tool` / `deploy` / `invoke`): dichiarativo — modello, tool, system prompt. AgentCore mette compute, memoria, identity, observability.
- **Code-defined agents**: deploy di *qualunque* framework sul runtime AgentCore — ✅ "Strands, LangChain, OpenAI Agents SDK, Claude Agent SDK, or custom".

Componenti (✅ [pricing page](https://aws.amazon.com/bedrock/agentcore/pricing/)):

| Componente | Cosa fa | Prezzo |
|---|---|---|
| **Runtime** (microVM serverless) | esegue l'agente, sessioni fino a 8h | ✅ v1 **$0,0895 / vCPU-ora** + **$0,00945 / GB-ora**; v2 $0,1276 + $0,0169 |
| **Gateway** | espone REST API / Lambda / `@tool` come tool MCP; auth IAM o OAuth | ✅ **$0,005 / 1.000 invocazioni**, Search API $0,025/1.000, indicizzazione $0,02 / 100 tool/mese |
| **Memory** | memoria breve e lungo termine, per `actor-id` | ✅ **$0,25 / 1.000 eventi** (short-term); long-term $0,75/1.000 record/mese + $0,50/1.000 retrieval |
| **Identity** | token OAuth / API key verso risorse non-AWS | ✅ $0,010 / 1.000 — **gratis** se usato tramite Runtime o Gateway |
| **Code Interpreter / Browser** | sandbox di esecuzione codice e browser headless | ✅ stesso prezzo del Runtime v1 |
| **Policy** | autorizzazione per singola azione dell'agente | ✅ $0,000025 / richiesta + $0,13 / 1.000 token input |
| **Observability** | ✅ "powered by CloudWatch", telemetria **OTEL-compatibile**: sessioni, latenza, durata, token, error rate | costi CloudWatch standard |
| **Evaluations** | ✅ GA **31 marzo 2026**. LLM-as-judge su sessioni, singole risposte e **singole tool call**; *trajectory evaluation* sul percorso, non solo sull'output; online (traffico campionato) e on-demand (CI/CD) | ✅ built-in $0,0024/1.000 token input, $0,012/1.000 output |

🧠 **AgentCore Evaluations è l'arma più forte di AWS in questo confronto** e non c'entra nulla con l'hosting: è l'unica cosa nei due stack che trasforma "ho fatto un agente" in "ho fatto un agente e so **quanto è buono**, con un numero, rigenerato in CI". Su Cloudflare l'equivalente non esiste (§2.5).

⚠️ **Non c'è free tier su AgentCore Runtime**: la pagina di pricing elenca solo i $200 di credito Free Tier per nuovi clienti AWS e un free tier permanente sull'Agent Registry (5.000 record, 1M Search API). Il Runtime si paga dal primo secondo.

### 1.3 Le alternative AWS "a mano", che sono quelle vere per questo progetto

| Strada | Cosa comporta | 🧠 Verdetto per questo caso |
|---|---|---|
| **Lambda + loop tool-use scritto a mano** | una invocazione tiene tutto il loop; streaming via Lambda response streaming; stato in DynamoDB | ✅ **La scelta giusta.** Leggibile riga per riga, zero magia, costa $0 (free tier), e il loop agentico *è* il pezzo da mostrare — non va nascosto dentro un harness |
| **Step Functions** come orchestratore | ✅ Standard $0,000025 / state transition, **4.000 transizioni/mese gratis**; Express $1,00/milione richieste + $0,00001667/GB-s | 🧠 Sovradimensionato per un loop che dura 10 s. Ha senso solo per l'**ingestione** offline degli appunti (chunk → embed → upsert), dove il retry per step e la visualizzazione a grafo valgono davvero |
| **AgentCore Runtime** | container su ECR, microVM, memoria e gateway gestiti | 🧠 Ottimo su CV, pesante per 300 richieste/mese: si paga vCPU-ora e si costruisce un'immagine per una cosa che sta in una Lambda. **Ma Evaluations si può usare da solo**, senza spostarci sopra il runtime |
| **Strands Agents SDK** | ✅ open source (mag 2025), gira su Lambda/Fargate/EC2/AgentCore | 🧠 Buon compromesso se non si vuole scrivere il loop; ma il loop scritto a mano mostra di più |

### 1.4 Il retrieval su AWS: S3 Vectors ha cambiato i conti

✅ [S3 Vectors](https://aws.amazon.com/s3/pricing/), GA dicembre 2025:

- storage **$0,06 / GB-mese**
- upload **$0,20 / GB** (minimo 128 KB per PUT)
- query: **$2,50 / milione di query** + dato processato a scaglioni (**$0,004/TB** sotto i 100k vettori) + dato restituito $0,01/GB, **primi 512 KB per query gratis**

⚠️ **Il confronto che conta**: OpenSearch Serverless in collection *Classic* ha un pavimento di 2 OCU a $0,24/OCU-ora ≈ **$350/mese**, che è il [classico incidente](https://cloudburn.io/blog/amazon-bedrock-pricing) di chi crea una Knowledge Base con "Quick create" e si dimentica la collection accesa. 🧠 **Per un corpus di appunti universitari S3 Vectors è la scelta ovvia** e rende il costo del retrieval indistinguibile da zero (§3).

### 1.5 Osservabilità e sicurezza

✅ CloudWatch + X-Ray, AgentCore Observability in OTEL. ✅ IAM per tutto, Secrets Manager per la chiave del provider. 🧠 Nulla di sorprendente: è il terreno dove è già a casa, e per un colloquio italiano è esattamente il vocabolario che serve.

---

## 2. Cosa offre Cloudflare, nel 2026

Gran parte è già chiusa in [#3](https://github.com/Simi24/simonepetta.com/issues/3). Qui solo il pezzo agentico.

### 2.1 Agents SDK e Durable Objects

✅ [Agents SDK](https://developers.cloudflare.com/agents/) — ogni agente **è** un Durable Object: stato proprio, storage SQLite proprio, ciclo di vita proprio, WebSocket, scheduling, MCP. ✅ Durable Objects sono sul **free plan** dal 7 aprile 2025 (solo backend SQLite): **100.000 richieste/giorno** e **13.000 GB-s/giorno** gratis; sul paid 1M richieste/mese + $0,15/milione e 400.000 GB-s + $12,50/milione.

🧠 Questo è il pezzo tecnicamente più elegante dei due stack: "una istanza dell'agente per conversazione, con il suo database SQLite dentro, nello stesso thread del codice" è un modello che risolve lo stato agentico senza che tu debba pensarci. Su AWS lo stesso risultato richiede DynamoDB + una chiave di sessione + attenzione alla concorrenza.

### 2.2 Workflows

✅ [Workflows](https://developers.cloudflare.com/workflows/reference/pricing/) GA da aprile 2025, control plane riarchitettato ad aprile 2026 per concorrenza più alta. Fatturato come Workers (richieste + CPU) + storage a GB-mese + step. Ritenzione stato: 3 giorni sul free, 30 sul paid. ✅ `step.do()` supporta ora anche i **rollback** con retry configurabili.

### 2.3 AI Gateway

✅ Gratis. ✅ Dal 21 maggio 2026 espone una REST API unificata con endpoint **`POST /ai/v1/messages` compatibile con l'SDK Anthropic**, quindi il codice non cambia se lo si mette in mezzo. ✅ Caching, logging (con user agent dal 12 giu 2026), custom metadata, Dynamic Routing con fallback, BYOK. ✅ Integrabile con Cloudflare Access per avere `cf.user_id` verificato nei log e negli spend limit **senza passare l'id utente dal client**.

### 2.4 Retrieval: Vectorize, AI Search, Workers AI

| | Stato | Costo |
|---|---|---|
| **Vectorize** | ✅ fino a **20 milioni di vettori per indice** (4 ago 2026), max 1536 dimensioni | ⚠️ ✅ "Vectorize is currently only available on the Workers **paid** plan" → **$5/mese obbligatori**. Poi 50M dimensioni interrogate/mese incluse + $0,01/milione |
| **AI Search** (ex AutoRAG) | ✅ RAG gestito end-to-end: R2 → chunking → embedding → Vectorize → AI Gateway → risposta | ✅ **gratis durante l'open beta**, entro i limiti; Workers AI e AI Gateway fatturati a parte. ⚠️ Su Workers Free il crawl è limitato a **500 pagine/giorno** |
| **Workers AI** | ✅ inferenza sul bordo, binding `env.AI` | ✅ **10.000 Neuron/giorno gratis** su free *e* paid, poi $0,011/1.000 Neuron. ⚠️ Dal 28 lug 2026 i modelli più pesanti (Kimi K2.6, GLM-5.2) richiedono il piano Paid: sul Free tornano `403` |

### 2.5 ⚠️ Il buco: la valutazione su Cloudflare è deprecata

✅ [AI Gateway · Evaluations](https://developers.cloudflare.com/ai-gateway/evaluations/), pagina aggiornata 28 luglio 2026:

> "**Deprecated.** Evaluations are deprecated and no longer supported for new accounts."

🧠 Questo è il punto di rottura sul requisito "valutazione" del ticket. Su Cloudflare restano observability ottime (Workers Logs, **tracing automatico** senza modifiche al codice, export OTLP verso Honeycomb/Grafana/Sentry, span custom via `tracing.startActiveSpan()`) ma **nessun evaluator gestito**: la eval suite te la scrivi tu. Su AWS AgentCore Evaluations è GA con 13 evaluator built-in e valutazione della *traiettoria*. Per un progetto il cui scopo dichiarato è essere **mostrabile**, "so dire quanto è buono il mio agente, con un numero" pesa parecchio.

---

## 3. Esiste un tetto di spesa DURO? — la domanda che decide

### 3.1 AWS: no, e va detto senza attenuanti

✅ Cosa sanno fare le **budget actions** ([doc](https://docs.aws.amazon.com/cost-management/latest/userguide/budgets-controls.html)):

> "Your available actions include applying an IAM policy or a service control policy (SCP). They also include targeting specific Amazon EC2 or Amazon RDS instances in your account."

Tre e basta: IAM policy, SCP, stop/terminate di EC2 o RDS. 🧠 **Nessuna di queste ferma una Lambda già deployata che sta chiamando un modello in loop.** Una SCP di `Deny` su `bedrock:InvokeModel` funzionerebbe, ma solo in un'organizzazione con management account, e comunque solo dopo che il budget se ne accorge — ed è qui che casca tutto:

✅ [Best practices for AWS Budgets](https://docs.aws.amazon.com/cost-management/latest/userguide/budgets-best-practices.html):

> "AWS billing data, which Budgets uses to monitor resources, is updated **at least once per day**. Keep in mind that budget information and associated alerts are updated and sent according to this data refresh cadence."

🧠 Tradotto: nello scenario peggiore un loop impazzito o un endpoint pubblico abusato alle 2 di notte brucia **un giorno intero** di spesa prima che il meccanismo si accorga di esistere. Il ticket #3 aveva trovato lo stesso identico difetto su Cloudflare ("alerts fire the day after"): **la differenza non è nell'alert, è che Cloudflare ha anche un blocco vero e AWS no.**

✅ E anche il ripiego più ovvio è documentato come approssimativo — [API Gateway request throttling](https://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-request-throttling.html):

> "Both throttles and quotas are applied on a **best-effort basis** and should be thought of as **targets rather than guaranteed request ceilings**."

**Cosa esiste davvero su AWS, in ordine di durezza** 🧠:

| Leva | Cosa limita | Durezza |
|---|---|---|
| **Contatore di spesa in DynamoDB + pre-flight check in Lambda** | dollari, in tempo reale | 🟢 **Dura davvero** — ma è codice tuo, ~40 righe: update atomico condizionale sul contatore mensile, `429` se sopra soglia |
| Lambda **reserved concurrency** | parallelismo → limita il *tasso* di combustione | 🟢 Dura, ma limita $/ora, non $/mese |
| Quota **TPM/RPM** di Bedrock per modello | token al minuto | 🟡 Dura come throttle, ma la soglia di default è altissima: non è un budget |
| Quota di un **usage plan** API Gateway | numero di richieste | 🟡 ✅ dichiarata *best-effort* |
| **AWS Budgets + action** (IAM/SCP) | risorse, non spesa già fatta | 🔴 Latenza ≥ 1 giorno, non copre Lambda/Bedrock |
| **Budget alert** | niente | 🔴 È una mail |

⚠️ Nota su come *non* farlo: il "Free plan" dei nuovi account AWS (dal 15 luglio 2025) **chiude l'account** quando i crediti finiscono. È un tetto durissimo — e totalmente inutilizzabile per un sito pubblico, perché la "protezione" è la distruzione delle risorse.

### 3.2 Cloudflare: sì, dove serve

✅ [AI Gateway · Spend limits](https://developers.cloudflare.com/ai-gateway/features/spend-limits/), GA dal 5 giugno 2026:

> "When cumulative spend reaches the limit within a time window, AI Gateway **blocks further requests with a `429` response** until the window resets."
> "Before sending a request to the provider, AI Gateway evaluates all applicable spend limit rules at once. If any individual rule is over budget, the request is blocked."
> "Spend limits apply to both Unified Billing requests and **BYOK** requests for models with known pricing."

Limiti dichiarati: ⚠️ eventually consistent ("a burst of concurrent requests can briefly exceed the limit"), ⚠️ max 20 regole per gateway, ⚠️ stima best-effort del costo. Alternativa al blocco: ✅ Dynamic Route con fallback su modello economico — *budget finito ≠ chat morta, chat degradata*.

### 3.3 🧠 Il verdetto sul punto 2 del ticket, e la conseguenza architetturale

**AWS non ha un tetto duro in dollari. Cloudflare sì, ed è gratis, e funziona anche sulle chiavi proprie.**

Ma — e qui sta la cosa non ovvia — **AI Gateway non gli importa da dove arriva la richiesta.** È un gateway HTTP: una Lambda che chiama `https://gateway.ai.cloudflare.com/.../anthropic/v1/messages` è protetta dallo spend limit esattamente come un Worker. 🧠 Quindi la debolezza di AWS **non obbliga a scegliere Cloudflare**: obbliga a mettere l'unica risorsa illimitata del sistema (i token) dietro l'unico tetto duro disponibile, che sta su Cloudflare e non costa niente.

🧠 Difesa in profondità proposta, tutta a costo zero, dal bordo al portafoglio:

```
WAF rule            → traffico palesemente ostile                 (Cloudflare, free)
rate limiting binding → N messaggi / finestra / sessione           (Cloudflare Worker, free — vedi #3)
Workers Free 100k/die → cap strutturale di richieste               (Cloudflare, free)
contatore DynamoDB   → $/mese, verificato PRIMA di chiamare, 429   (AWS, codice tuo)
Lambda reserved concurrency = 2..5 → cap sul tasso di combustione  (AWS, free)
AI Gateway spend limit → $/finestra, 429 duro + fallback           (Cloudflare, free)
budget cap sulla chiave del provider → ultima rete                 (Anthropic console)
AWS Budget alert     → segnale postumo, non protezione             (AWS)
```

🧠 Il contatore in DynamoDB **non è ridondante** rispetto allo spend limit: è la parte che si racconta. Lo spend limit è configurazione (una riga in una dashboard); il pre-flight check è la dimostrazione che ha capito *perché* serve. In colloquio la frase è: *"AWS non ha un hard cap. L'ho scritto io, e ne ho messo un secondo fuori dal mio codice perché il mio codice può avere bug."* Quella frase, da sola, vale più di metà del progetto.

---

## 4. Costi reali a basso traffico

🧠 **Scenario di riferimento** (esplicito, così si può contestare): 300 messaggi di chat al mese, agente multi-step con in media **3 chiamate al modello per messaggio** (≈900 chiamate/mese), contesto medio 6.000 token in / 500 out, corpus di ~20.000 chunk di appunti.

### 4.1 Infrastruttura AWS

| Voce | Conto | $/mese |
|---|---|---|
| Lambda | 300 invocazioni × ~20 s × 512 MB ≈ 3.000 GB-s — ✅ free tier 400.000 GB-s + 1M richieste (always free) | **$0** |
| DynamoDB on-demand | sessioni + contatore spesa; ✅ 25 GB storage free | **~$0** |
| S3 Vectors | storage ~0,1 GB → $0,006; 900 query → $0,0023 + dato processato trascurabile | **< $0,01** |
| Embedding indicizzazione | ~10M token una tantum su modello di embedding | **~$0,20 una tantum** |
| CloudWatch Logs | ⚠️ la voce che sorprende sempre; con retention 7 giorni | **~$0,10–0,50** |
| API Gateway | non necessario (§5) | **$0** |
| Step Functions (solo ingest) | ✅ 4.000 transizioni/mese gratis | **$0** |
| **Totale infra AWS** | | **≈ $0,5 / mese** |
| *(variante AgentCore Runtime)* | 300 sessioni × ~60 s attivi × 1 vCPU + 2 GB ≈ 5 vCPU-h + 10 GB-h | *+ ~$0,55* + ECR |

### 4.2 Infrastruttura Cloudflare

| Voce | $/mese |
|---|---|
| Workers + static assets (sito) | ✅ **$0** — asset statici gratuiti e illimitati (#3) |
| Worker chat, Durable Objects, Workflows sotto i limiti free | ✅ **$0** |
| AI Gateway (cache, log, spend limit) | ✅ **$0** |
| Workers AI (embedding/fallback, ≤10k Neuron/die) | ✅ **$0** |
| ⚠️ **Vectorize** | ✅ **$5** (richiede Workers Paid) |
| AI Search invece di Vectorize | ✅ **$0** finché dura l'open beta |
| **Totale infra Cloudflare** | **$0 o $5** |

### 4.3 I token — cioè la bolletta vera

Listino ✅ Anthropic (skill `claude-api`, giugno 2026), 900 chiamate = 5,4M token in / 0,45M out:

| Modello | in / out per MTok | $/mese senza caching | 🧠 con prompt caching sul prefisso (system + tool + chunk riusati nel turno) |
|---|---|---|---|
| Claude Haiku 4.5 | $1 / $5 | $7,65 | **~$4** |
| Claude Sonnet 5 | $3 / $15 | $22,95 | **~$12** |
| Claude Opus 5 | $5 / $25 | $38,25 | **~$20** |

🧠 **La conclusione che conta**: l'infrastruttura è **il 2–10%** del costo su entrambe le piattaforme. Il delta AWS↔Cloudflare è al massimo $5/mese, cioè meno del delta fra scegliere Sonnet e scegliere Haiku. **Il costo non è un criterio di scelta fra le due piattaforme.** È un criterio di scelta del *modello* e della *strategia di caching*, e quelli sono ortogonali all'hosting.

⚠️ Corollario: siccome è il modello a costare, il tetto duro deve stare **sul modello** — non sulla piattaforma. È esattamente dove AI Gateway lo mette (§3.2).

---

## 5. Sito su Cloudflare + backend su AWS: quanto costa davvero in complessità

### 5.1 CORS — si elimina, non si gestisce

🧠 L'errore da non fare è il layout ovvio:

```
browser → [CF] sito statico
browser → [AWS] API Gateway / Lambda URL     ← cross-origin: preflight, header, 2 domini
```

Il layout giusto mette il Worker **davanti**, non accanto:

```
browser → simonepetta.com/api/chat  → [CF Worker]  → [AWS Lambda Function URL] → agente
                (stessa origin)        Turnstile/sessione
                                       rate limiting binding (#3)
                                       kill switch = cancella la route
```

Conseguenze, tutte a favore:
- ✅ **Nessun CORS**: stessa origin, nessun preflight, nessun header da mantenere.
- ✅ Il **rate limiting binding** resta dove [#3](https://github.com/Simi24/simonepetta.com/issues/3) l'aveva messo — ed è la ragione per cui quella ricerca aveva scartato Pages. La scelta non si rimangia.
- ✅ Il vincolo 1 della mappa (*un solo endpoint dinamico*) resta letteralmente vero: il browser vede **una** rotta dinamica.
- ✅ Il kill switch resta a costo zero: si cancella la route del Worker chat, sito e appunti non se ne accorgono.
- 🧠 La Lambda non è pubblica: Function URL con `AWS_IAM` e SigV4 dal Worker, oppure — più semplice — un secret condiviso in header, rotabile. Niente API Gateway → una risorsa in meno e $0.

### 5.2 Latenza

🧠 Un hop in più, ma i numeri sono a favore:
- Worker → Lambda in **eu-south-1 (Milano)**: il visitatore è in Italia, il PoP Cloudflare è a Milano, la region è a Milano. **Sotto i 30 ms**.
- Il vero costo di latenza è il **TTFT del modello** (centinaia di ms–secondi). L'hop è nel rumore.
- ⚠️ Lo streaming deve reggere l'hop: Lambda **response streaming** → il Worker fa da proxy passando lo `ReadableStream`. È il caso d'uso canonico di un Worker, non un workaround.
- ⚠️ Cold start della Lambda (~0,5–1 s in Python): 🧠 su 300 richieste/mese **quasi tutte sono a freddo**. Mitigazioni: runtime leggero, niente import pesanti, `SnapStart` non serve. In pratica il cold start si nasconde dietro il TTFT del modello se si inizia a streammare subito un token di "sto cercando".

### 5.3 Due account, due IaC

🧠 Onestamente: è il vero costo, e non è enorme.

| Attrito | Mitigazione |
|---|---|
| Due set di credenziali in CI | **OIDC** GitHub → AWS (nessuna chiave long-lived) + un API token Cloudflare scoped al minimo |
| Due provider Terraform | ✅ Il provider Cloudflare **v5 è GA** (feb 2025, generato da OpenAPI, copertura 100% delle proprietà API). Due stack separati (`infra/aws/`, `infra/cloudflare/`) in **un solo repo**, due state. ⚠️ Cloudflare stessa ha ammesso un tasso alto di issue sul v5 (≈15% delle risorse) — 🧠 le risorse che servono qui (worker, route, custom domain, AI Gateway) sono fra le più usate, ma conviene pinnare la versione |
| Due dashboard da guardare | 🧠 Non-problema: i log applicativi stanno in CloudWatch, i log delle chiamate al modello in AI Gateway. Sono **due viste diverse sulla stessa cosa**, non due posti dove cercare la stessa |
| Deploy da coordinare | 🧠 Il Worker e la Lambda sono accoppiati da un contratto JSON di due campi. Deploy indipendenti, nessuna orchestrazione |

🧠 **E c'è un rovescio positivo**: un repo con `infra/aws/` e `infra/cloudflare/`, OIDC, due provider e una ragione scritta per ogni confine **è più mostrabile di un repo mono-piattaforma**. "Perché due cloud?" è una domanda a cui ha una risposta forte (il tetto di spesa duro non esiste su AWS) — ed è esattamente il tipo di domanda che in colloquio si spera di ricevere.

---

## 6. Quale racconta meglio in un colloquio in Italia, nel 2026

⚠️ Da qui in poi è quasi tutto 🧠. La ricerca sugli annunci italiani conferma solo il banale — AWS è ovunque negli annunci per cloud/DevOps engineer e le certificazioni AWS sono richieste esplicitamente; **nessun annuncio trovato menziona Cloudflare Workers come competenza richiesta**. Che è debole come evidenza ma coerente con l'esperienza.

**AWS è più spendibile professionalmente in Italia. Sì, nettamente.** Il mercato italiano è a forte componente enterprise e consulenziale: il vocabolario condiviso è AWS/Azure, il filtro dei recruiter cerca quelle parole, e l'intervistatore tecnico medio ha AWS nelle mani tutti i giorni.

**Cloudflare Workers è percepito come giocattolo?** 🧠 **No — ma è percepito come *nicchia*, che ai fini pratici del colloquio è peggio.** Chi conosce la piattaforma sa che Durable Objects è un primitivo distribuito serio (attore single-threaded con storage co-locato: risolve problemi che su AWS richiedono tre servizi). Chi non la conosce non la classifica come "hobby": la classifica come **"non rilevante per noi"** e la conversazione non parte. Il rischio non è il disprezzo, è l'indifferenza.

🧠 **Il vero argomento, però, è un altro, e va contro l'intuizione.** Lui AWS ce l'ha già sul CV, dal lavoro. Il valore marginale di *un altro progetto AWS* non è "dimostrare che sa AWS" — quello è già dato. È che **AWS è il terreno dove le domande di approfondimento gli fanno guadagnare punti.** Su un progetto Cloudflare la prima domanda è "cos'è un Durable Object" e i primi cinque minuti li passa a spiegare la piattaforma. Su un progetto AWS la prima domanda è "come hai gestito i cold start / come hai messo in sicurezza la chiave / quanto costa" — e a ognuna ha una risposta che lo qualifica. **Un colloquio si vince nel follow-up, non nel titolo.**

🧠 **Il pezzo Cloudflare, però, non va tolto: va raccontato come una decisione.** "Il sito è su Cloudflare perché gli asset statici sono gratis e illimitati e la parte pubblica non può rompersi. L'agente è su AWS. Il tetto di spesa l'ho lasciato su Cloudflare perché **AWS non ne ha uno**, e citare quella riga di documentazione è più convincente di qualunque cosa io possa dire di me." Questo è un candidato che ha letto la documentazione e ha scelto, non uno che ha seguito un tutorial. È il segnale più raro e più costoso da fingere.

---

## 7. Una chat RAG è un buon esercizio "agentico"?

### 7.1 No. E il caso d'uso lo dimostra da solo

🧠 Una RAG classica — embed della domanda, top-k, stuff nel prompt, una chiamata — **non ha nessuna delle tre proprietà agentiche**: non decide (il numero di passi è fisso), non usa tool (la retrieval è cablata), non ha stato (ogni turno riparte). È una pipeline. Mostrarla come "sistema agentico" in colloquio è il modo più veloce per perdere credibilità con chi sa la differenza.

🧠 E sugli **appunti universitari** è anche funzionalmente debole, perché le domande vere non sono a singola retrieval:
- *"che differenza c'è fra X e Y?"* → servono **due** ricerche e un confronto
- *"in che corso avevo visto Z?"* → è una query sui **metadati**, non sul testo
- *"spiegami la dimostrazione del teorema K"* → un chunk non basta: serve **leggere la sezione intera**
- *"fammi tre esercizi su W"* → serve recuperare *e poi generare*, due passi distinti

### 7.2 La forma genuinamente agentica dello stesso caso d'uso

🧠 Stesso corpus, stesso obiettivo, +2–3× token (§4.3: **da ~$4 a ~$12/mese**), incomparabilmente più mostrabile.

**Tool (4, non di più):**

| Tool | Cosa fa | Perché è lì |
|---|---|---|
| `search_notes(query, corso?, anno?)` | ricerca semantica filtrabile su S3 Vectors | l'agente decide **quante volte** cercare e **dove** |
| `list_courses()` / `get_programma(corso)` | metadati strutturati da DynamoDB | risponde alle domande che il vettoriale sbaglia sempre |
| `read_section(doc_id, section_id)` | **legge la sezione intera, verbatim** | 🧠 il singolo miglioramento di qualità più grande: il chunking è lossy, lasciare che l'agente *apra il file* quando serve è ciò che distingue un agente da una pipeline |
| `list_prerequisiti(concetto)` *(opzionale)* | grafo dei prerequisiti fra corsi | 🧠 il tool che nessuno si aspetta e che racconta il dominio |

**Le altre tre proprietà:**
- **Multi-step**: loop tool-use con criterio di arresto esplicito e `max_steps` (leggibile, testabile, mostrabile). ✅ Adaptive thinking di Claude (`thinking: {type:"adaptive"}`) + `effort: "low"` per i passi di routing tiene giù il costo senza spegnere il ragionamento.
- **Stato**: conversazione in DynamoDB per `session_id`, più un **registro delle citazioni** — ogni affermazione risale al file di appunti da cui viene. 🧠 È la stessa regola della sua LLM Wiki (*"cita sempre la fonte immutabile"*) applicata qui: coerenza che si nota.
- **Valutazione**: golden set di ~30 domande con i file-fonte attesi → misura di **recall della retrieval** e **correttezza delle citazioni**, rigenerata in CI. ✅ Con AgentCore Evaluations (§1.2) si aggiunge gratis la *trajectory evaluation*: se l'agente chiama due volte lo stesso tool o prende un ramo inutile, lo vedi. ✅ La Batch API di Anthropic dimezza il costo di far girare le eval.

### 7.3 🧠 Il moltiplicatore: rendere visibile il ragionamento

Una cosa sola, che costa poche ore e cambia la natura del progetto: **ogni risposta linka una pagina di traccia** — i passi compiuti, i tool chiamati con gli argomenti, i chunk letti, le fonti citate, i token spesi.

Perché conta: rende il comportamento agentico **visibile a chi non legge il codice** — recruiter compresi — e trasforma "ho fatto una chat" in "ho fatto un sistema che sa spiegare cosa ha fatto". È anche, di fatto, un mini pannello di osservabilità: lo stesso artefatto risponde alla domanda tecnica *"come lo debuggi?"* e a quella non tecnica *"cosa fa?"*. Insieme al report di eval pubblicato come pagina statica, sono i due artefatti con il miglior rapporto ore/impressione dell'intero progetto.

---

## 8. Raccomandazione

**Il carico agentico va su AWS.** Non AgentCore Runtime: **Lambda con il loop tool-use scritto a mano**, stato in DynamoDB, retrieval su **S3 Vectors**, tutto in Terraform. Il sito resta dov'è, su **Cloudflare Workers Static Assets** (#3), e un **Worker fa da unica porta pubblica davanti alla Lambda** — che elimina CORS, conserva il rate limiting binding e mantiene letterale il vincolo "un solo endpoint dinamico".

**Le quattro ragioni, in ordine di peso:**

1. 🧠 **Il colloquio.** AWS è la lingua che la stanza parla in Italia, e soprattutto è il terreno dove le domande di follow-up lo premiano invece di costringerlo a spiegare la piattaforma. Cloudflare non è un giocattolo — è nicchia, e in colloquio la nicchia produce indifferenza, che è peggio dello scetticismo.
2. 🧠 **Le ore compongono.** Lambda, DynamoDB, IAM, Terraform, cold start, costi: ogni ora spesa qui vale anche lunedì mattina. Su Cloudflare varrebbe solo per il progetto.
3. ✅ **La valutazione.** AgentCore Evaluations è GA da marzo 2026 con valutazione della traiettoria; le Evaluations di AI Gateway sono **deprecate e chiuse ai nuovi account**. Per un progetto il cui scopo è essere mostrabile, saper dire *quanto è buono* con un numero non è un dettaglio.
4. 🧠 **Il costo non decide.** ≈$0,5/mese su AWS contro $0–5 su Cloudflare, con i token a fare il 90% della bolletta su entrambe. Chi sceglie la piattaforma per $5 sta ottimizzando la cosa sbagliata.

**Il prezzo di questa scelta, dichiarato:** ✅ AWS non ha un tetto di spesa duro. Si paga con due contromisure, entrambe volute:
- **si scrive** (contatore mensile in DynamoDB, update condizionale atomico, `429` prima di chiamare il modello) — ed è il pezzo di codice più raccontabile del progetto;
- **si compra gratis su Cloudflare** (AI Gateway spend limit in BYOK, `429` duro, fallback su modello economico). AI Gateway non sa e non gli importa che il chiamante sia una Lambda.

**E il caso d'uso va riformulato prima di scrivere codice**: non una chat RAG, ma un agente con 4 tool (`search_notes`, `get_programma`, `read_section`, `list_prerequisiti`), loop multi-step con `max_steps`, stato e registro delle citazioni in DynamoDB, eval in CI su un golden set di ~30 domande, e **una pagina di traccia pubblica per ogni risposta**. Costa ~$8/mese in più e vale l'intera differenza fra "ho fatto una chat sui miei appunti" e "ho messo in produzione un sistema agentico e so dimostrare quanto funziona".

---

## Cosa questa ricerca lascia aperto

1. **Il modello.** Haiku 4.5 (~$4/mese) o Sonnet 5 (~$12/mese)? Su appunti universitari con matematica in italiano 🧠 la qualità dipende quasi tutta da qui. Proposta: Sonnet 5 come primario, Haiku come fallback dichiarato nella Dynamic Route quando lo spend limit morde.
2. **La cifra del budget mensile.** Lo spend limit è un numero, e lo decide una persona. Serve prima di scrivere la prima riga di Terraform.
3. **Bedrock o Anthropic API diretta?** 🧠 L'API diretta passa pulita da AI Gateway ed è il percorso più semplice; Bedrock è più "AWS" da raccontare ma aggiunge una region, un listino partner e un livello di quota in più. Da decidere insieme al punto 1.
4. **Chi identifica l'utente della chat** — già aperta da [#3](https://github.com/Simi24/simonepetta.com/issues/3), ora con un'opzione in più: ✅ Cloudflare Access davanti al gateway dà un `cf.user_id` verificato usabile direttamente negli spend limit per-utente, senza passare id dal client.
5. **La misura del corpus appunti**, che è già bloccante sulla mappa: determina il numero di chunk, la strategia di chunking e se `read_section` è praticabile.
6. **Se l'ingestione merita Step Functions.** 🧠 Probabilmente sì — è il posto dove il retry per step vale davvero, ed è gratis sotto le 4.000 transizioni/mese.
