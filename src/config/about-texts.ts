export type Lang = "it" | "en";

export interface PathEntry {
  when: string;
  text: string;
}

/**
 * The about-page texts. The author approved these agent drafts on 2026-10-02 and may rewrite
 * them at any time (SPEC.md §1.2 point 3, §15.2).
 */
export const lede: Record<Lang, string> = {
  it: "Software engineer a Milano. Qui tengo traccia di cosa leggo, cosa ho studiato e cosa costruisco.",
  en: "Software engineer in Milan. This site is where I keep track of what I build and what I have studied.",
};

export const bio: Record<Lang, readonly string[]> = {
  it: [
    "Sono un software engineer e vivo a Milano. Lavoro in AdKaora, dove mi occupo soprattutto di backend e di infrastruttura su AWS con Terraform. Prima ho sviluppato app mobile in Zucchetti, su un'app per le risorse umane usata da centinaia di migliaia di persone.",
    "Ho studiato Informatica alla Statale di Milano, prima la triennale in Informatica per la comunicazione digitale e poi la magistrale. In questo sito metto gli appunti dei corsi, i libri che leggo con due righe su cosa mi hanno lasciato, e i progetti a cui lavoro nel tempo libero.",
  ],
  en: [
    "I'm a software engineer based in Milan. At AdKaora I work mostly on backend services and AWS infrastructure with Terraform; before that I built mobile apps at Zucchetti, on an HR app used by hundreds of thousands of people.",
    "I studied Computer Science at the University of Milan (BSc in Computer Science for Digital Communication, MSc in Computer Science). The rest of this site is in Italian: my reading log and my university notes.",
  ],
};

export const path: Record<Lang, readonly PathEntry[]> = {
  it: [
    {
      when: "2025–oggi",
      text: "Software engineer, AdKaora (Milano). Backend e infrastruttura su AWS, Terraform.",
    },
    {
      when: "2024–2026",
      text: "Laurea magistrale in Informatica, Università degli Studi di Milano. Tesi sulla progettazione e l'automazione di una farm di microservizi su AWS con Terraform e CI/CD.",
    },
    {
      when: "2023–2024",
      text: "Mobile developer, Zucchetti (Lodi). App HR per iOS e Android, tracciamento GPS in tempo reale e anti-spoofing.",
    },
    {
      when: "2020–2023",
      text: "Laurea triennale in Informatica per la comunicazione digitale, Università degli Studi di Milano. Tesi sui servizi basati sulla posizione in un'app di rilevazione presenze.",
    },
  ],
  en: [
    {
      when: "2025–now",
      text: "Software engineer, AdKaora (Milan). Backend and AWS infrastructure, Terraform.",
    },
    {
      when: "2024–2026",
      text: "MSc in Computer Science, University of Milan. Thesis on designing and automating a microservices farm on AWS with Terraform and CI/CD.",
    },
    {
      when: "2023–2024",
      text: "Mobile developer, Zucchetti (Lodi). HR app for iOS and Android, real-time GPS tracking and anti-spoofing.",
    },
    {
      when: "2020–2023",
      text: "BSc in Computer Science for Digital Communication, University of Milan. Thesis on location-based services in an attendance-tracking app.",
    },
  ],
};

/**
 * Project descriptions by project name, one per language. The Quits text was approved verbatim by
 * the author on 2026-10-05 (Quits issue #13, SPEC.md §13).
 */
export const projectDescriptions: Record<
  Lang,
  Readonly<Record<string, string>>
> = {
  it: {
    Quits:
      "un'app per dividere le spese di un viaggio con gli amici, anche senza rete. Come Splitwise, ma senza limiti a pagamento.",
    dynantic:
      "un ORM per DynamoDB in Python, tipizzato con Pydantic v2: query, indici secondari, transazioni. Pubblicato su PyPI.",
    "ralph-gh":
      "un orchestratore che fa lavorare agenti di Claude Code sulle issue di GitHub, una alla volta, con una review automatica prima di ogni merge.",
    rideIt:
      "un'app iOS che registra accelerometro e GPS e riconosce lo stile di guida con modelli Core ML sul telefono.",
    SaltinoInterpreter:
      "un interprete per un piccolo linguaggio funzionale, con parser ANTLR4 e trasformazione delle chiamate in coda.",
    "kafka-secure-ha-cluster":
      "un cluster Kafka ad alta disponibilità in Docker, con TLS, SASL e ACL.",
  },
  en: {
    Quits:
      "an app for splitting trip expenses with friends, even offline. Like Splitwise, without the paywall.",
    dynantic:
      "a typed DynamoDB ORM for Python built on Pydantic v2, with queries, secondary indexes and transactions. Published on PyPI.",
    "ralph-gh":
      "an orchestrator that runs Claude Code agents on GitHub issues one at a time, with an automated review gate before every merge.",
    rideIt:
      "an iOS app that records motion and GPS data and classifies driving style with on-device Core ML models.",
    SaltinoInterpreter:
      "an interpreter for a small functional language, with an ANTLR4 parser and tail-call transformation.",
    "kafka-secure-ha-cluster":
      "a highly available Kafka cluster in Docker, with TLS, SASL and ACLs.",
  },
};

export const sectionLedes = {
  letture:
    "Tutti i libri che leggo, anche quelli che lascio a metà. Per alcuni c'è un testo breve su cosa mi hanno lasciato; per gli altri, solo voto e date.",
  appunti:
    "Gli appunti che ho scritto durante la triennale e la magistrale in Informatica alla Statale di Milano. Sono tutti in PDF; alcuni si leggono anche qui come pagine web.",
} as const;
