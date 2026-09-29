# Modello economico per l'agente della chat

> Research ticket: [Modello economico per l'agente della chat](https://github.com/Simi24/simonepetta.com/issues/17), mappa: [#1](https://github.com/Simi24/simonepetta.com/issues/1).
> Data ricerca: 2026-09-29. Fonti primarie: `developers.cloudflare.com`, AWS Price List API (`pricing.us-east-1.amazonaws.com`, pubblicazione 2026-09-28), model card Bedrock su `docs.aws.amazon.com`, `api-docs.deepseek.com`, model card su Hugging Face, leaderboard BFCL.
>
> **Convenzione**: ✅ = verificato su fonte ufficiale, con link. 🧠 = mia inferenza o stima, non un fatto documentato. ❓ = non verificabile oggi, da testare.

---

## TL;DR

1. **Primario: DeepSeek V4 Flash (`@cf/deepseek-ai/deepseek-v4-flash-0731`) su Workers AI, chiamato dalla Lambda attraverso AI Gateway**, pagato con i crediti prepagati di Unified Billing. Costo al carico di riferimento: ✅ listino $0,44 / $1,32 per MTok, quindi **~$3,0/mese senza cache, ~$1,8 con prefix caching** (🧠 stima al 50% di input in cache).
2. **Fallback: GLM-4.7-Flash (`@cf/zai-org/glm-4.7-flash`)** su Workers AI tramite Dynamic Route quando lo spend limit del primario scatta: **~$0,50/mese** allo stesso carico.
3. **Embedding: Cohere Embed v4 su Bedrock** (`eu.cohere.embed-v4:0` da eu-south-1): ✅ $0,12 / MTok, cioè **~$1,2 una tantum** per indicizzare ~10M token e centesimi al mese per le query.
4. ⚠️ **Il punto che decide il provider**: AI Gateway supporta Bedrock come provider, ma **nessuna pagina documenta che lo spend limit sappia prezzare i modelli non-Claude su Bedrock** (Qwen, DeepSeek, GLM, gpt-oss). Lo spend limit vale solo "for models with known pricing". Su Workers AI il prezzo lo fissa Cloudflare stessa: è l'unico percorso in cui il tetto duro è certo.
5. ⚠️ **Amazon Nova 2 Lite è il candidato "più AWS" ma il meno sicuro sul criterio 1**: Amazon dichiara τ²-bench 76 e BFCL v4 60,3; la leaderboard BFCL indipendente lo misura a **27,1% overall e 2,12% sul multi-turn**. Costa inoltre ~$3,8-4,8/mese in EU, a ridosso del tetto.

---

## 1. Il carico di riferimento

300 messaggi/mese × ~3 chiamate × ~6.000 token in / 500 out = **5,4M token in + 0,45M token out al mese** (stesso scenario di [AWS o Cloudflare per il carico agentico](https://github.com/Simi24/simonepetta.com/issues/15)).

🧠 Colonna "con cache": ipotizzo che metà dell'input sia prefisso ripetuto (system prompt, definizioni dei 3 tool, turni precedenti del loop) e venga fatturato al prezzo di cache read. È un'ipotesi prudente per un loop a 3 step; va misurata sul traffico vero.

---

## 2. AI Gateway: chi è compatibile con lo spend limit

| Fatto | Stato | Fonte |
|---|---|---|
| Spend limit blocca con `429` quando la spesa supera il budget della finestra | ✅ | [Spend limits](https://developers.cloudflare.com/ai-gateway/features/spend-limits/) (agg. 9 set 2026) |
| Vale per Unified Billing e BYOK, **"for models with known pricing"** | ✅ | idem |
| Il costo è una stima "best-effort"; eventualmente consistente, burst concorrenti possono sforare di poco | ✅ | idem |
| Al limite si può fare fallback su un modello più economico con Dynamic Route (l'esempio ufficiale usa proprio un modello `@cf/`) | ✅ | idem |
| Il costo si calcola solo se la risposta contiene token **e nome del modello** | ✅ | [Costs](https://developers.cloudflare.com/ai-gateway/observability/costs/) (agg. 24 set 2026) |
| Header `cf-aig-custom-cost` per imporre il prezzo per token | ✅ | [Custom costs](https://developers.cloudflare.com/ai-gateway/configuration/custom-costs/) |
| Lo spend limit usa il custom cost per i modelli che il gateway non sa prezzare | ❓ non documentato | 🧠 plausibile, da testare prima di fidarsi |
| Provider supportati: Workers AI, **Amazon Bedrock**, **DeepSeek**, OpenRouter, Groq, Mistral e altri | ✅ | [Providers](https://developers.cloudflare.com/ai-gateway/usage/providers/) |
| Bedrock: firma SigV4 fatta dal gateway con BYOK; API supportate InvokeModel, Mantle (Messages), Unified API **solo per Claude e Nova** | ✅ | [Amazon Bedrock](https://developers.cloudflare.com/ai-gateway/usage/providers/bedrock/) (agg. 10 set 2026) |
| DeepSeek: endpoint `/deepseek/chat/completions`, BYOK supportato | ✅ | [DeepSeek](https://developers.cloudflare.com/ai-gateway/usage/providers/deepseek/) (agg. 22 set 2026) |
| Unified Billing: **5% di fee sui crediti**, prezzi dei provider senza markup | ✅ | [Unified Billing](https://developers.cloudflare.com/ai-gateway/features/unified-billing/) (agg. 23 set 2026) |
| I crediti prepagati danno accesso ai modelli Workers AI "paid-only" (DeepSeek V4, GLM-5.x, Kimi K2.6) **senza Workers Paid** | ✅ | idem + [Workers AI pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/) (agg. 17 set 2026) |

🧠 **Lettura**: tre livelli di certezza sullo spend limit.

- **Workers AI**: certo (prezzo di Cloudflare, esempio ufficiale).
- **DeepSeek API diretta**: molto probabile (DeepSeek V4 è nel [catalogo modelli](https://developers.cloudflare.com/ai/models/) con prezzo), ma il nome modello dell'API è appena cambiato in `deepseek-flash` (V4.1): se il gateway non lo riconosce il costo è zero e il tetto non morde. Rimedio: `cf-aig-custom-cost`, da verificare.
- **Bedrock non-Claude/Nova**: incerto. Serve un test con richiesta vera e lettura del costo nei log del gateway prima di sceglierlo.

---

## 3. Candidati: prezzo, regione, compatibilità

Prezzi in $ per MTok. Costo mensile = 5,4 × input + 0,45 × output.

| Modello · provider | In / Out (cache read) | $/mese | $/mese con cache 🧠 | Regione | Spend limit | Fonte prezzo |
|---|---|---|---|---|---|---|
| **DeepSeek V4 Flash 0731 · Workers AI** | 0,44 / 1,32 (0,014) | **2,97** | **1,82** | rete Cloudflare, nessuna garanzia UE documentata ❓ | ✅ certo | [WAI pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/) |
| **GLM-4.7-Flash · Workers AI** | 0,06 / 0,40 | **0,50** | n/d | idem | ✅ certo | idem |
| GLM-5.3-Flash · Workers AI | 0,15 / 0,50 (0,03) | 1,04 | 0,71 | idem | ✅ certo | idem |
| gpt-oss-120b · Workers AI | 0,35 / 0,75 | 2,23 | n/d | idem | ✅ certo | idem |
| Gemma 4 26B A4B · Workers AI | 0,10 / 0,30 | 0,68 | n/d | idem | ✅ certo | idem |
| Kimi K2.6 · Workers AI | 0,95 / 4,00 (0,16) | 6,93 | 4,80 | idem | ✅ certo | idem |
| DeepSeek V4.1 Flash · API diretta, ore di punta | 0,30 / 1,20 (0,006) | 2,16 | 1,37 | ✅ dati trattati in Cina | 🟡 probabile | [DeepSeek pricing](https://api-docs.deepseek.com/quick_start/pricing) |
| DeepSeek V4.1 Flash · API diretta, fuori punta | 0,15 / 0,60 (0,003) | 1,08 | 0,68 | idem | 🟡 probabile | idem |
| Nova 2 Lite · Bedrock, geo EU da Milano | 0,528 / 4,411 (0,132) | 4,84 | 3,77 | ✅ geo EU (6 regioni UE) | 🟡 Unified API supporta Nova | Price List eu-south-1 |
| Nova 2 Lite · Bedrock, global | 0,481 / 4,10 (0,0825) | 4,44 | 3,37 | ✅ global (anche fuori UE) | 🟡 | idem |
| Qwen3 235B A22B 2507 · Bedrock Milano | 0,29 / 1,16 | 2,09 | n/d | ✅ in-region eu-south-1 | ❓ | idem |
| Qwen3 Next 80B A3B · Bedrock Milano | 0,168 / 1,44 | 1,56 | n/d | ✅ in-region eu-south-1 | ❓ | idem |
| gpt-oss-120b · Bedrock Milano | 0,20 / 0,79 | 1,44 | n/d | ✅ in-region eu-south-1 | ❓ | idem |
| MiniMax M2.5 · Bedrock Milano | 0,36 / 1,44 | 2,59 | n/d | ✅ in-region eu-south-1 | ❓ | idem |
| GLM 4.7 Flash · Bedrock Milano | 0,08 / 0,48 | 0,65 | n/d | 🧠 SKU presente a Milano | ❓ | idem |
| Mistral Large 3 · Bedrock Milano | 0,60 / 1,80 | 4,05 | n/d | 🧠 SKU Mantle a Milano, model card elenca solo regioni non UE | ❓ | idem |
| DeepSeek V3.2 · Bedrock | 0,74 / 2,22 | 5,00 | n/d | ✅ in-region solo eu-north-1 e eu-west-2 | ❓ | idem |
| Kimi K2.5 · Bedrock | 0,72 / 3,60 | 5,51 | n/d | ✅ in-region solo eu-north-1 e eu-west-2 | ❓ | idem |

Note di verifica:

- ✅ Prezzi Bedrock letti dal JSON ufficiale della Price List API, offerte `AmazonBedrock` e `AmazonBedrockFoundationModels`, regione eu-south-1 (pubblicazione 2026-09-28): `https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AmazonBedrock/current/eu-south-1/index.json`. Per confronto Nova 2 Lite in us-east-1 costa $0,33 / $2,75: **in UE il geo-routing costa ~60% in più**.
- ✅ Disponibilità regionale dalle model card Bedrock: [Nova 2 Lite](https://docs.aws.amazon.com/bedrock/latest/userguide/model-card-amazon-nova-2-lite.html) (geo `eu.` da Milano, nessun in-region), [Qwen3 235B](https://docs.aws.amazon.com/bedrock/latest/userguide/model-card-qwen-qwen3-235b-a22b-2507.html), [DeepSeek V3.2](https://docs.aws.amazon.com/bedrock/latest/userguide/model-card-deepseek-deepseek-v3-2.html), [Kimi K3](https://docs.aws.amazon.com/bedrock/latest/userguide/model-card-moonshot-ai-kimi-k3.html) (in UE solo global, $3 / $15: fuori budget).
- ✅ Su Bedrock i modelli open-weight (Qwen, DeepSeek V3.2, GLM, gpt-oss, MiniMax) **non hanno SKU di cache read** nel listino: niente sconto sul prefisso ripetuto.
- ✅ DeepSeek API: "we directly collect, process and store your Personal Data in People's Republic of China" ([privacy policy](https://cdn.deepseek.com/policies/en-US/deepseek-privacy-policy.html), agg. 10 feb 2026). Il thinking mode è attivo di default su `deepseek-flash`.
- ✅ Workers AI, free allocation di 10.000 Neuron/giorno ([pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/)). ❓ Non è documentato se si applica anche alle richieste pagate con Unified Billing: nel conto la considero zero.

---

## 4. Affidabilità nel tool use (criterio 1)

Nessun benchmark indipendente copre tutti i candidati del 2026: BFCL è fermo al 12 aprile 2026 e non include DeepSeek V4, GLM-4.7-Flash né gpt-oss. Quindi confronto due tipi di numeri e li tengo separati.

**Leaderboard indipendente**: ✅ [BFCL v4](https://gorilla.cs.berkeley.edu/leaderboard.html), CSV `data_overall.csv`, "Last Updated: 2026-04-12"

| Modello (modalità) | Overall | Multi-turn | Rank |
|---|---|---|---|
| Claude Haiku 4.5 (FC), riferimento | 68,70% | 53,62% | 6 |
| DeepSeek V3.2-Exp (FC) | 54,12% | 37,38% | 19 |
| Qwen3 235B A22B 2507 (FC) | 47,99% | 45,38% | 31 |
| **Amazon Nova 2 Lite (FC)** | **27,10%** | **2,12%** | 80 |
| Amazon Nova Micro (FC) | 22,29% | 1,38% | 95 |

**Numeri dichiarati dai vendor** (stessa etichetta non vuol dire stesso harness: non confrontabili 1:1)

| Modello | Tool use multi-step | Fonte |
|---|---|---|
| DeepSeek V4 Flash (non-think / high / max) | MCPAtlas 64,0 / 67,4 / 69,0; Toolathlon 40,7 / 43,5 / 47,8 | ✅ [HF DeepSeek-V4-Flash](https://huggingface.co/deepseek-ai/DeepSeek-V4-Flash) |
| DeepSeek V4 Flash 0731 (release ufficiale) | Toolathlon-Verified 70,3 (preview 49,7) | ✅ [HF V4-Flash-0731](https://huggingface.co/deepseek-ai/DeepSeek-V4-Flash-0731) |
| DeepSeek V4.1 Flash (API diretta) | AutomationBench 54,8, Agent's Last Exam 31,8 | ✅ [HF V4.1-Flash](https://huggingface.co/deepseek-ai/DeepSeek-V4.1-Flash) |
| GLM-4.7-Flash | τ²-Bench 79,5 | ✅ [HF GLM-4.7-Flash](https://huggingface.co/zai-org/GLM-4.7-Flash) |
| GLM-4.7-Flash (Reasoning) | τ²-Bench Telecom 98,8, misurato da terzi | ✅ [Artificial Analysis](https://artificialanalysis.ai/evaluations/tau2-bench) |
| Nova 2 Lite | τ²-bench Telecom 76,0, Retail 76,5, Airline 64,8; BFCL v4 60,3; MCP Atlas 24,6 | ✅ [Nova 2 tech report](https://cdn.amazon.science/c5/3d/84514a224666b5be6de4b43ef4aa/nova-2-0-technical-report2.pdf), Tab. 2 |
| Qwen3 235B 2507 | BFCL-v3 70,9; τ²-Retail 74,6, Airline 50,0, Telecom 32,5 | ✅ [HF Qwen3-235B-2507](https://huggingface.co/Qwen/Qwen3-235B-A22B-Instruct-2507) |
| Gemma 4 26B A4B | Tau2 (media su 3) 68,2 | ✅ [HF Gemma 4 26B](https://huggingface.co/google/gemma-4-26b-a4b-it) |

🧠 **Lettura**:

- DeepSeek V4 Flash è il candidato con il segnale agentico più forte **a prezzo "Flash"**: anche in non-thinking (il modo che conviene a un loop di 3 step, per non gonfiare l'output) sta sopra il 60 su MCPAtlas, dove Nova 2 Lite dichiara 24,6 su MCP Atlas (probabilmente la stessa suite Scale, ma non ne ho la certezza).
- **Nova 2 Lite: 60,3 dichiarato contro 27,1 indipendente su BFCL, e 2,12% sul multi-turn.** Un crollo così sul multi-turn fa pensare più a un problema di integrazione nel harness che a un modello incapace, ma è esattamente il tipo di fragilità (formato delle chiamate, loop) che il criterio 1 vuole evitare. Da non scegliere senza un test proprio.
- GLM-4.7-Flash è un 30B-A3B: buono sul tool calling per la sua taglia, ma 🧠 meno conoscenza generale e meno italiano di un 284B-A13B. Ruolo giusto: fallback economico.

---

## 5. Italiano e matematica (criterio 2)

❓ **Nessun benchmark italiano pubblico copre i candidati del 2026** (cercati ITALIC, ITA-Bench, EVALITA 2026: nessuna tabella con DeepSeek V4, GLM-4.7/5.3, Nova 2). Proxy disponibili:

| Modello | Multilingue | Matematica | Fonte |
|---|---|---|---|
| DeepSeek V4 Flash | MMLU-Pro 83,0 (non-think) | HMMT 2026 Feb 40,8 non-think, 91,9 high | ✅ HF V4-Flash |
| Nova 2 Lite | n/d | AIME 2025 91,0 | ✅ tech report Nova 2 |
| Qwen3 235B 2507 | MMLU-ProX 79,4, INCLUDE 79,5 | AIME25 70,3 | ✅ HF Qwen3 |
| GLM-4.7-Flash | n/d | AIME 25 91,6 | ✅ HF GLM-4.7-Flash |
| Gemma 4 26B | MMMLU 86,3 | AIME 2026 88,3 | ✅ HF Gemma 4 |

🧠 Per spiegare appunti di analisi e algoritmi non serve il livello olimpiade: serve non sbagliare la notazione e restare fedeli al chunk citato. Il vero test è il **golden set in italiano** già previsto in CI: le prime 30 domande vanno fatte girare su primario e fallback **prima** di chiudere la scelta. Il loop scritto a mano rende il cambio di modello una riga di configurazione.

---

## 6. Embedding per S3 Vectors (criterio 6)

| Modello · provider | $/MTok | Regione | Italiano | Fonte |
|---|---|---|---|---|
| **Cohere Embed v4 · Bedrock** | ✅ 0,12 | ✅ in-region eu-west-1, geo `eu.` da eu-south-1 | 🧠 multilingue per Cohere; la [pagina docs](https://docs.cohere.com/docs/cohere-embed) non lo dice esplicitamente | Price List + [model card](https://docs.aws.amazon.com/bedrock/latest/userguide/model-card-cohere-embed-v4.html) |
| Cohere Embed Multilingual v3 · Bedrock | ✅ 0,10 | ✅ in-region eu-central-1, eu-west-1 | ✅ multilingue per nome; contesto 512 token | Price List + [model card](https://docs.aws.amazon.com/bedrock/latest/userguide/model-card-cohere-embed-multilingual.html) |
| Titan Text Embeddings V2 · Bedrock | ✅ 0,023 (Milano) | ✅ in-region eu-south-1 | ⚠️ "English (100+ languages in preview)", cross-lingua "sub-optimal" | [Titan embeddings](https://docs.aws.amazon.com/bedrock/latest/userguide/titan-embedding-models.html) |
| bge-m3 · Workers AI | ✅ 0,012 | rete Cloudflare | 🧠 multilingue | [WAI pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/) |
| Qwen3-Embedding-0.6B · Workers AI | ✅ 0,012 | rete Cloudflare | 🧠 multilingue | idem |
| Nova Multimodal Embeddings · Bedrock | n/d | ✅ solo us-east-1 | n/d | [model card](https://docs.aws.amazon.com/bedrock/latest/userguide/model-card-amazon-amazon-nova-multimodal-embeddings.html) |

🧠 **Scelta: Cohere Embed v4 su Bedrock.** Indicizzare ~10M token costa ~$1,2 una tantum; le query (~900/mese × poche decine di token) costano frazioni di centesimo. Resta dentro AWS con IAM, senza segreti in più, e il contesto da 128K non impone vincoli al chunking. Titan V2 costa 5 volte meno ma l'italiano è "in preview": su appunti in italiano il risparmio vale meno di un punto di recall. Se il golden set mostrasse recall peggiore, Multilingual v3 è l'alternativa a costo quasi identico.

Gli embedding **non passano dal gateway** (lo spend limit su Bedrock non è verificato, vedi §2): 🧠 il rischio è limitato perché l'unica spesa non banale è la reindicizzazione, che parte solo da un job di ingestione.

---

## 7. Raccomandazione

| Ruolo | Scelta | Percorso | $/mese al carico di rif. |
|---|---|---|---|
| Primario | **DeepSeek V4 Flash 0731** (`@cf/deepseek-ai/deepseek-v4-flash-0731`), non-thinking nel loop | Lambda → AI Gateway REST (`/ai/v1/chat/completions`, OpenAI-compatibile) → Workers AI, Unified Billing, header `x-session-affinity` per il prefix caching (🧠 documentato per altri modelli `@cf/`, il prezzo di cache read di V4 Flash è a listino) | 1,8-3,0 |
| Fallback | **GLM-4.7-Flash** (`@cf/zai-org/glm-4.7-flash`) | Dynamic Route sullo stesso gateway, scatta sullo spend limit del primario | 0,5 |
| Embedding | **Cohere Embed v4** | Bedrock, geo EU da eu-south-1 | ~1,2 una tantum + ~0 |

**Configurazione dei tetti** (🧠 proposta):

- spend limit sul **primario**: $3,50 / mese, poi Dynamic Route verso il fallback (chat degradata, non morta);
- spend limit **totale del gateway**: $4,50 / mese, blocco `429`. Con il 5% di fee sui crediti fa ~$4,73 addebitati: sta sotto i 5 € finché l'euro vale più del dollaro (🧠 cambio non verificato in questa ricerca, ricontrollare quando si caricano i crediti);
- i crediti prepagati sono essi stessi un tetto: se se ne caricano 5 € non si può spendere di più (✅ salvo il caso raro di saldo negativo documentato in [Unified Billing](https://developers.cloudflare.com/ai-gateway/features/unified-billing/)).

🧠 **Margine**: con $4,50 di tetto il primario regge ~450 messaggi/mese senza cache e ~700 con la cache ipotizzata, prima che intervenga il fallback.

### Perché non le alternative

- **DeepSeek API diretta**: più economica (~$1,4-2,2) e modello più nuovo (V4.1), ma i dati vanno in Cina, lo spend limit dipende dal fatto che il gateway riconosca il nuovo nome `deepseek-flash`, e ci sarebbe un secondo fornitore e un secondo saldo prepagato. Resta il piano B se Workers AI desse problemi di capacità (✅ con i crediti i modelli frontier documentati, Kimi K2.6 e GLM-5.2, hanno 50 req/min; ❓ il limite per DeepSeek V4 Flash non è pubblicato nella stessa nota).
- **Nova 2 Lite su Bedrock**: il più raccontabile in chiave AWS e l'unico non-Claude con Unified API di Bedrock sul gateway, ma BFCL indipendente al 2,12% sul multi-turn e ~$3,8-4,8/mese in UE, cioè quasi tutto il budget senza margine.
- **Qwen3 235B / gpt-oss-120b su Bedrock Milano**: prezzo ottimo ($1,4-2,1) e dati in-region a Milano, ma lo spend limit sul gateway non è verificato per questi modelli su Bedrock. Diventano la scelta giusta **solo** se un test mostra che il gateway ne calcola il costo (o che rispetta `cf-aig-custom-cost`).

### Cosa si accetta

- 🧠 **Inferenza fuori dall'UE garantita**: Workers AI non documenta una giurisdizione UE per l'inferenza. Per domande pubbliche su appunti universitari pubblici, senza dati personali nel prompt, è un compromesso accettabile.
- **Benchmark in gran parte dichiarati dal vendor** e nessun dato italiano: la scelta è condizionata al golden set.
- **Stima di costo best-effort** lato gateway e sforamenti brevi con richieste concorrenti (✅ documentato): a 300 messaggi/mese l'effetto è di centesimi.
- **5% di fee** sui crediti Unified Billing, in cambio di non dover attivare Workers Paid ($5/mese, che da solo esaurirebbe il budget).

---

## 8. Da verificare al primo deploy

1. Richiesta vera Lambda → gateway → `@cf/deepseek-ai/deepseek-v4-flash-0731` con 3 tool: controllare nei log del gateway che il **costo sia valorizzato** e che i `cached_tokens` compaiano con `x-session-affinity`.
2. Spend limit a $0,01 su un gateway di prova: verificare il `429` e il passaggio al fallback via Dynamic Route.
3. Golden set (30 domande) su primario e fallback: tool call malformate, loop oltre `max_steps`, qualità dell'italiano e della notazione.
4. Se si vuole tenere aperta la strada Bedrock: una chiamata a Qwen3 235B via gateway con e senza `cf-aig-custom-cost`, per vedere se lo spend limit la conta.
