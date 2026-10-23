# Legal: the managed standby under Swiss law, with the EU edge (22 October 2026)

Report for the standby exploration in `BRIEF.md`. Subject: the law that
shapes a managed standby sold by devguard AG (the copyright holder named in
`LICENSE`) to a business customer (the "host") whose end users write to a
support widget while the host's product is down.

This is not legal advice and nothing here is privileged (Art. 321 StGB and
Art. 13 BGFA protect lawyers, not an AI tool); what the maintainer typed went
to a third-party processor. The last section says where a Rechtsanwalt is
needed.

## What I read, and how to read this report

Repository: `docs/research/2026-10/standby/BRIEF.md`, `docs/product.md`,
`AGENTS.md`, `ROADMAP.md`, `LICENSE`, `package.json`,
`site/content/docs/operations/production.mdx`,
`site/app/(site)/privacy/page.tsx`, `site/app/(site)/page.tsx` (lines
480-497), `site/app/(site)/components/continuity-form.tsx`,
`site/lib/helpdesk.ts`, `site/lib/submit.ts`, `src/export.ts` (header),
`src/config.ts` (`retentionDays`), `src/widget/widget.tsx` (the context
block at lines 1095-1109), `src/http.ts` (visitor token).

Statutes, read in full for every article quoted, from the verbatim Fedlex
copies in `/Users/finalangel/Sites/devguard/flow/references/context/swiss-federal-law/`
(fetched 24 September 2026): DSG (SR 235.1, Stand 7 July 2025), DSV
(SR 235.11, Stand 1 December 2025), OR (SR 220, Stand 1 January 2026), UWG
(SR 241, Stand 1 January 2025), BV (SR 101, Stand 3 March 2024), ZGB
(SR 210, Stand 1 July 2026). The OR file carries `next_version: 2026-10-01`,
which is already in force: I fetched the 1 October 2026 consolidation from
Fedlex and compared every OR article quoted below (Art. 19, 20, 97, 99, 100,
101, 160, 161, 163, 394, 398, 399, 404); none changed. The 1 October 2026
amendments come from the BG vom 26. September 2025 über die Transparenz
juristischer Personen (Aktienbuch, Konkurs) and do not touch this report.
MSchG (SR 232.11, Stand 1 July 2025) and URG (SR 231.1, Stand 1 July 2025)
fetched from Fedlex this session.

GDPR articles quoted from the German text reproduced at dsgvo-gesetz.de
(Art. 3, 4, 13, 27, 28, 33, 44, 45); EUR-Lex refused automated access, so
the authentic Official Journal text was not compared. Commission Decision
2000/518/EC (Swiss adequacy): title and date verified on legislation.gov.uk
and on the Commission's adequacy page; its article text could not be
retrieved. EDÖB guide on breach notification, version 1.2 of 23 April 2025
(PDF from edoeb.admin.ch, text extracted locally). Case law from
entscheidsuche.ch and search.bger.ch: BGE 115 II 464, BGE 133 III 43,
BGE 138 III 411.

Every section separates **Verified text** (quoted) from **Interpretation**
(mine). Anything marked **[UNVERIFIED]** I believe but could not fetch this
session; it never carries a conclusion.

## Facts I am working from (Sachverhalt)

- devguard AG, a Swiss company with one maintainer and far fewer than 250
  employees, would run the standby and be the contracting party.
- The standby holds, only while the host's product is down: names, email
  addresses, message bodies, attachments, and the browser context the
  widget captures (`url`, `title`, `userAgent`, `viewport`, language, the
  last errors on the page; the form shows these and they can be unticked).
  The package counts anonymous posts per IP address for an hour and does
  not store the address with the message (privacy page, `anonymousRateLimit`).
- After the outage the standby exports the conversations as JSON Lines
  (`src/export.ts`), the host imports them, and the standby deletes its copy.
- Hosts are Swiss companies first (the Divio scenario). Some hosts, or
  their end users, will be in the EU.
- Sub-processors: a hosting provider (not chosen; Divio for the website
  today), an outbound email provider (Postmark and Mailgun are the examples
  in the docs; both US companies), and possibly Cloudflare (the example
  inbound relay is a Cloudflare Email Worker).
- The website already collects a private list: email plus the checkbox
  "I'd pay for this", stored as a conversation in the `continuity` inbox
  with `host.pay: yes|no` in its context and a PostHog event
  `continuity_joined { would_pay }`. No receipt email is sent for that inbox.

Assumed, and a question back if wrong: devguard uses the standby data for
nothing of its own (no analytics on message content, no training, no
product research on the host's conversations).

---

## 1. Roles: processor under the DSG, processor under the GDPR, and the DPA

### Verified text

Art. 5 lit. j and k DSG (SR 235.1, Stand 7.7.2025):

> j. Verantwortlicher: private Person oder Bundesorgan, die oder das allein
> oder zusammen mit anderen über den Zweck und die Mittel der Bearbeitung
> entscheidet;
> k. Auftragsbearbeiter: private Person oder Bundesorgan, die oder das im
> Auftrag des Verantwortlichen Personendaten bearbeitet.

Art. 9 DSG:

> 1 Die Bearbeitung von Personendaten kann vertraglich oder durch die
> Gesetzgebung einem Auftragsbearbeiter übertragen werden, wenn:
> a. die Daten so bearbeitet werden, wie der Verantwortliche selbst es tun
> dürfte; und
> b. keine gesetzliche oder vertragliche Geheimhaltungspflicht die
> Übertragung verbietet.
> 2 Der Verantwortliche muss sich insbesondere vergewissern, dass der
> Auftragsbearbeiter in der Lage ist, die Datensicherheit zu gewährleisten.
> 3 Der Auftragsbearbeiter darf die Bearbeitung nur mit vorgängiger
> Genehmigung des Verantwortlichen einem Dritten übertragen.
> 4 Er kann dieselben Rechtfertigungsgründe geltend machen wie der
> Verantwortliche.

Art. 7 DSV (SR 235.11, Stand 1.12.2025):

> 1 Die vorgängige Genehmigung des Verantwortlichen, die dem
> Auftragsbearbeiter erlaubt, die Datenbearbeitung einem Dritten zu
> übertragen, kann spezifischer oder allgemeiner Art sein.
> 2 Bei einer allgemeinen Genehmigung informiert der Auftragsbearbeiter den
> Verantwortlichen über jede beabsichtigte Änderung in Bezug auf die
> Hinzuziehung oder die Ersetzung anderer Dritter. Der Verantwortliche kann
> Widerspruch gegen diese Änderung erheben.

Art. 12 Abs. 3 DSG (the processor's record) and Art. 24 DSV (the exemption):

> 3 Das Verzeichnis des Auftragsbearbeiters enthält Angaben zur Identität
> des Auftragsbearbeiters und des Verantwortlichen, zu den Kategorien von
> Bearbeitungen, die im Auftrag des Verantwortlichen durchgeführt werden,
> sowie die Angaben nach Absatz 2 Buchstaben f und g.

> Unternehmen und andere privatrechtliche Organisationen, die am 1. Januar
> eines Jahres weniger als 250 Mitarbeiterinnen und Mitarbeiter
> beschäftigen, sowie natürliche Personen sind von der Pflicht befreit, ein
> Verzeichnis der Bearbeitungstätigkeiten zu führen, ausser eine der
> folgenden Voraussetzungen ist erfüllt:
> a. Es werden besonders schützenswerte Personendaten in grossem Umfang
> bearbeitet.
> b. Es wird ein Profiling mit hohem Risiko durchgeführt.

Art. 25 Abs. 4 DSG: "Lässt der Verantwortliche Personendaten von einem
Auftragsbearbeiter bearbeiten, so bleibt er auskunftspflichtig."

Art. 61 lit. b DSG (penalty, on the controller's side):

> Mit Busse bis zu 250 000 Franken werden private Personen auf Antrag
> bestraft, die vorsätzlich: [...] b. die Datenbearbeitung einem
> Auftragsbearbeiter übergeben, ohne dass die Voraussetzungen nach Artikel 9
> Absätze 1 und 2 erfüllt sind;

Art. 3 Abs. 2 DSGVO (as reproduced at dsgvo-gesetz.de):

> Diese Verordnung findet Anwendung auf die Verarbeitung personenbezogener
> Daten von betroffenen Personen, die sich in der Union befinden, durch
> einen nicht in der Union niedergelassenen Verantwortlichen oder
> Auftragsverarbeiter, wenn die Datenverarbeitung im Zusammenhang damit
> steht a) betroffenen Personen in der Union Waren oder Dienstleistungen
> anzubieten, unabhängig davon, ob von diesen betroffenen Personen eine
> Zahlung zu leisten ist; b) das Verhalten betroffener Personen zu
> beobachten, soweit ihr Verhalten in der Union erfolgt.

Art. 28 DSGVO, the parts that shape the DPA (same source):

> 1 Erfolgt eine Verarbeitung im Auftrag eines Verantwortlichen, so arbeitet
> dieser nur mit Auftragsverarbeitern, die hinreichend Garantien dafür
> bieten, dass geeignete technische und organisatorische Maßnahmen so
> durchgeführt werden, dass die Verarbeitung im Einklang mit den
> Anforderungen dieser Verordnung erfolgt und den Schutz der Rechte der
> betroffenen Person gewährleistet.
> 2 Der Auftragsverarbeiter nimmt keinen weiteren Auftragsverarbeiter ohne
> vorherige gesonderte oder allgemeine schriftliche Genehmigung des
> Verantwortlichen in Anspruch. Im Fall einer allgemeinen schriftlichen
> Genehmigung informiert der Auftragsverarbeiter den Verantwortlichen immer
> über jede beabsichtigte Änderung in Bezug auf die Hinzuziehung oder die
> Ersetzung anderer Auftragsverarbeiter, wodurch der Verantwortliche die
> Möglichkeit erhält, gegen derartige Änderungen Einspruch zu erheben.
> 3 Die Verarbeitung durch einen Auftragsverarbeiter erfolgt auf der
> Grundlage eines Vertrags oder eines anderen Rechtsinstruments [...], in
> dem Gegenstand und Dauer der Verarbeitung, Art und Zweck der Verarbeitung,
> die Art der personenbezogenen Daten, die Kategorien betroffener Personen
> und die Pflichten und Rechte des Verantwortlichen festgelegt sind. Dieser
> Vertrag [...] sieht insbesondere vor, dass der Auftragsverarbeiter
> a) die personenbezogenen Daten nur auf dokumentierte Weisung des
> Verantwortlichen – auch in Bezug auf die Übermittlung personenbezogener
> Daten an ein Drittland oder eine internationale Organisation –
> verarbeitet [...];
> b) gewährleistet, dass sich die zur Verarbeitung der personenbezogenen
> Daten befugten Personen zur Vertraulichkeit verpflichtet haben [...];
> c) alle gemäß Artikel 32 erforderlichen Maßnahmen ergreift;
> d) die in den Absätzen 2 und 4 genannten Bedingungen für die
> Inanspruchnahme der Dienste eines weiteren Auftragsverarbeiters einhält;
> e) [...] den Verantwortlichen [...] dabei unterstützt, seiner Pflicht zur
> Beantwortung von Anträgen auf Wahrnehmung der in Kapitel III genannten
> Rechte der betroffenen Person nachzukommen;
> f) [...] den Verantwortlichen bei der Einhaltung der in den Artikeln 32
> bis 36 genannten Pflichten unterstützt;
> g) nach Abschluss der Erbringung der Verarbeitungsleistungen alle
> personenbezogenen Daten nach Wahl des Verantwortlichen entweder löscht
> oder zurückgibt und die vorhandenen Kopien löscht, sofern nicht nach dem
> Unionsrecht oder dem Recht der Mitgliedstaaten eine Verpflichtung zur
> Speicherung der personenbezogenen Daten besteht;
> h) dem Verantwortlichen alle erforderlichen Informationen zum Nachweis
> der Einhaltung der in diesem Artikel niedergelegten Pflichten zur
> Verfügung stellt und Überprüfungen – einschließlich Inspektionen – [...]
> ermöglicht und dazu beiträgt.
> 4 [...] Kommt der weitere Auftragsverarbeiter seinen Datenschutzpflichten
> nicht nach, so haftet der erste Auftragsverarbeiter gegenüber dem
> Verantwortlichen für die Einhaltung der Pflichten jenes anderen
> Auftragsverarbeiters.
> 9 Der Vertrag oder das andere Rechtsinstrument im Sinne der Absätze 3 und
> 4 ist schriftlich abzufassen, was auch in einem elektronischen Format
> erfolgen kann.
> 10 [...] gilt ein Auftragsverarbeiter, der unter Verstoß gegen diese
> Verordnung die Zwecke und Mittel der Verarbeitung bestimmt, in Bezug auf
> diese Verarbeitung als Verantwortlicher.

Art. 27 Abs. 1 and Abs. 2 lit. a DSGVO:

> 1 In den Fällen gemäß Artikel 3 Absatz 2 benennt der Verantwortliche oder
> der Auftragsverarbeiter schriftlich einen Vertreter in der Union.
> 2 Die Pflicht gemäß Absatz 1 des vorliegenden Artikels gilt nicht für
> a) eine Verarbeitung, die gelegentlich erfolgt, nicht die umfangreiche
> Verarbeitung besonderer Datenkategorien [...] einschließt und unter
> Berücksichtigung der Art, der Umstände, des Umfangs und der Zwecke der
> Verarbeitung voraussichtlich nicht zu einem Risiko für die Rechte und
> Freiheiten natürlicher Personen führt [...]

### Interpretation

**devguard is the Auftragsbearbeiter, the host is the Verantwortliche.**
The host decides why the data exist (support for its customers) and the
means (its widget, its inboxes, its agents answering). devguard stores and
routes. That holds under both definitions (Art. 5 lit. j/k DSG, Art. 4
Nr. 7/8 DSGVO). It stops holding the moment devguard uses the conversations
for a purpose of its own; Art. 28 Abs. 10 DSGVO then makes devguard a
controller for that use, and under the DSG the definition in Art. 5 lit. j
does the same. So the product rule follows from the role: the standby reads
the host's data for nothing but the standby.

**What the DSG requires of the DPA.** Less than the GDPR. Art. 9 Abs. 1
DSG wants a contract ("vertraglich"); it prescribes no form and no content
list. The three substantive points the DSG does prescribe are: the data may
be processed only as the host itself could (Abs. 1 lit. a), the host must
satisfy itself that devguard can keep the data secure (Abs. 2, with Art. 61
lit. b DSG as the penalty for the host that does not), and sub-processors
need prior approval (Abs. 3, with Art. 7 DSV allowing a general approval
plus notice and objection). Add the processor's own statutory duties that
the DPA should mirror: security (Art. 8 Abs. 1 DSG, next section), breach
notice to the controller (Art. 24 Abs. 3 DSG), assistance with Auskunft
(Art. 25 Abs. 4 DSG keeps the host liable to answer), and the record of
processing (Art. 12 Abs. 3 DSG; devguard is exempt under Art. 24 DSV unless
it processes sensitive data at scale, which support conversations do not
systematically, but a one-page record costs nothing and answers the host's
Abs. 2 question).

Art. 9 Abs. 1 lit. b DSG is the clause nobody expects: a host under a
statutory or contractual secrecy duty (a bank, a clinic, a lawyer, or any
host whose own customer contracts forbid subcontracting) may not hand the
data to a standby at all. The AGB should make the host warrant that no such
duty applies, and the onboarding should ask.

**What the GDPR requires.** When the host is an EU controller, Art. 28
Abs. 3 DSGVO lists the mandatory content and Abs. 9 requires written form
(electronic suffices). When the host is Swiss but its end users are in the
EU, whether Art. 3 Abs. 2 reaches a Swiss processor directly is a question
the EDPB has addressed in its Guidelines 3/2018 on territorial scope
**[UNVERIFIED: not fetched this session]**; what is certain is that an EU
host may only engage processors bound by an Art. 28-compliant contract, so
the DPA is the entry ticket regardless of who the GDPR formally binds.
Art. 27 (EU representative) has an exception for occasional, low-risk
processing; a standby that runs only during outages is "gelegentlich" by
design, but "umfangreich" is a question of volume and the exemption is a
judgement call for a lawyer once a first EU host is in sight.

**Is a standard DPA plus the AGB enough?** Yes, if the DPA is drafted to
Art. 28 Abs. 3 DSGVO and adds the three Swiss lines (the EDÖB as the
authority, Art. 24 Abs. 3 DSG breach notice "so rasch als möglich", the
Art. 9 Abs. 1 lit. b warranty). A DPA that satisfies Art. 28 DSGVO
satisfies Art. 9 DSG a fortiori, so one document serves both. The AGB alone
are not enough for an EU host because the Art. 28 Abs. 3 content must be
there in terms, and the deletion-or-return choice (lit. g) and the audit
right (lit. h) rarely are. The AGB and the DPA must not contradict each
other on liability (section 5): the DPA says what devguard must do, the
AGB say what it pays when it does not.

**Sub-processors.** List them in an annex to the DPA: name, function (hosting,
outbound email, edge/relay), country, and the transfer basis (section 2).
Use a general approval (Art. 7 Abs. 1 DSV, Art. 28 Abs. 2 DSGVO) with a
notice period (30 days is the market norm, not a statutory figure) and an
objection right whose only consequence can realistically be termination,
since a one-person company cannot run a second hosting stack for one host.
Bind each sub-processor back-to-back (Art. 28 Abs. 4 DSGVO); under Swiss
contract law devguard answers for them anyway as Hilfspersonen (Art. 101
Abs. 1 OR) or substitutes (Art. 399 OR), section 5.

**Zwingend or dispositiv.** Art. 9 DSG and Art. 28 DSGVO are public-law
duties: the parties cannot contract out of them, and Art. 61 lit. b DSG
puts a fine on the host that tries. What the parties may shape is the
how: the form of approval (Art. 7 DSV), the notice periods, the audit
mechanics.

---

## 2. Data location and transfers

### Verified text

Art. 16 Abs. 1 and Abs. 2 DSG:

> 1 Personendaten dürfen ins Ausland bekanntgegeben werden, wenn der
> Bundesrat festgestellt hat, dass die Gesetzgebung des betreffenden Staates
> oder das internationale Organ einen angemessenen Schutz gewährleistet.
> 2 Liegt kein Entscheid des Bundesrates nach Absatz 1 vor, so dürfen
> Personendaten ins Ausland bekanntgegeben werden, wenn ein geeigneter
> Datenschutz gewährleistet wird durch: a. einen völkerrechtlichen Vertrag;
> b. Datenschutzklauseln in einem Vertrag zwischen dem Verantwortlichen oder
> dem Auftragsbearbeiter und seiner Vertragspartnerin oder seinem
> Vertragspartner, die dem EDÖB vorgängig mitgeteilt wurden; c. spezifische
> Garantien, die das zuständige Bundesorgan erarbeitet und dem EDÖB
> vorgängig mitgeteilt hat; d. Standarddatenschutzklauseln, die der EDÖB
> vorgängig genehmigt, ausgestellt oder anerkannt hat; oder e. verbindliche
> unternehmensinterne Datenschutzvorschriften [...]

Art. 17 Abs. 1 DSG (exceptions), the two that could be argued:

> a. Die betroffene Person hat ausdrücklich in die Bekanntgabe eingewilligt.
> b. Die Bekanntgabe steht in unmittelbarem Zusammenhang mit dem Abschluss
> oder der Abwicklung eines Vertrags: 1. zwischen dem Verantwortlichen und
> der betroffenen Person; oder 2. zwischen dem Verantwortlichen und seiner
> Vertragspartnerin oder seinem Vertragspartner im Interesse der betroffenen
> Person.

Art. 5 lit. e DSG: "Bekanntgeben: das Übermitteln oder Zugänglichmachen von
Personendaten". Art. 61 lit. a DSG fines up to CHF 250 000 for an
intentional disclosure abroad outside Art. 16/17.

Art. 8 Abs. 1 DSV: "Die Staaten, Gebiete, spezifischen Sektoren in einem
Staat und internationalen Organe mit einem angemessenen Datenschutz werden
in Anhang 1 aufgeführt." Anhang 1 DSV (footnote: "Bereinigt gemäss Ziff. I
der V vom 14. Aug. 2024, in Kraft seit 15. Sept. 2024 (AS 2024 435)") lists
among others Deutschland, Österreich, Frankreich, Italien, Irland,
Liechtenstein, Niederlande, Vereinigtes Königreich, and:

> Vereinigte Staaten***
> Für Personendaten, die von Organisationen bearbeitet werden, die gemäss
> den Grundsätzen des Datenschutzrahmens zwischen der Schweiz und den USA
> zertifiziert sind, gilt ein angemessenes Schutzniveau als gewährleistet
> [...]

Art. 8 Abs. 4 and 6 DSV: "Die Angemessenheit des Datenschutzes wird
periodisch neu beurteilt." / "Wenn die Beurteilung [...] zeigen, dass kein
angemessener Datenschutz mehr gewährleistet ist, wird Anhang 1 geändert;
dies hat keine Auswirkungen auf die bereits erfolgten Datenbekanntgaben."

Art. 10 Abs. 1 DSV: "Gibt der Verantwortliche oder der Auftragsbearbeiter
Personendaten mittels Standarddatenschutzklauseln [...] ins Ausland bekannt,
so trifft er angemessene Massnahmen, um sicherzustellen, dass die
Empfängerin oder der Empfänger diese beachtet."

Art. 19 Abs. 4 DSG: "Werden die Personendaten ins Ausland bekanntgegeben, so
teilt er der betroffenen Person auch den Staat oder das internationale Organ
und gegebenenfalls die Garantien nach Artikel 16 Absatz 2 oder die Anwendung
einer Ausnahme nach Artikel 17 mit."

Art. 45 Abs. 1 and 9 DSGVO:

> 1 Eine Übermittlung personenbezogener Daten an ein Drittland [...] darf
> vorgenommen werden, wenn die Kommission beschlossen hat, dass das
> betreffende Drittland [...] ein angemessenes Schutzniveau bietet. Eine
> solche Datenübermittlung bedarf keiner besonderen Genehmigung.
> 9 Von der Kommission auf der Grundlage von Artikel 25 Absatz 6 der
> Richtlinie 95/46/EG erlassene Feststellungen bleiben so lange in Kraft,
> bis sie durch einen [...] Beschluss der Kommission geändert, ersetzt oder
> aufgehoben werden.

Commission Decision 2000/518/EC of 26 July 2000 "on the adequate protection
of personal data provided in Switzerland" (title and date verified on
legislation.gov.uk; the Commission's adequacy page lists Switzerland and
says it published, on 15 January 2024, its "Report on the first review of
the functioning of the eleven adequacy decisions adopted pursuant to
Directive 95/46/EC"; the same page dates the EU-US Data Privacy Framework
adequacy decision 10 July 2023 and its first review report 9 October 2024).
The EDÖB's notice of 15 August 2024 says the Swiss-US framework applies
"from 15 September 2024" to exchanges "between Switzerland and certified US
companies".

### Interpretation

**Switzerland to Switzerland: no transfer.** A Swiss host with a Swiss
standby and Swiss sub-processors has no Art. 16 question at all. That is
the cheapest configuration and the one to sell first.

**Switzerland to the EU (standby or sub-processor in Germany, say).** Every
EU and EEA state is in Anhang 1 DSV, so Art. 16 Abs. 1 DSG allows it
without further guarantees. Two residual duties: the host must tell its end
users the state (Art. 19 Abs. 4 DSG), and the host's record (Art. 12
Abs. 2 lit. g) and devguard's (Abs. 3) must name it.

**EU host to a Swiss standby.** The reverse direction is adequate under
Decision 2000/518/EC, kept alive by Art. 45 Abs. 9 DSGVO and confirmed by
the Commission's review of 15 January 2024. No SCCs, no transfer impact
assessment; the Art. 28 DPA is the whole paperwork. This is a real selling
point against a US-hosted helpdesk and may be said in marketing as long as
it is phrased as the current legal position, not a guarantee
(Art. 8 Abs. 4 DSV and Art. 45 Abs. 3 DSGVO both foresee periodic review).

**A US sub-processor (Postmark, Mailgun, Cloudflare).** Passing an email
body to a US provider, or letting a US edge terminate TLS, is a
Bekanntgabe (Art. 5 lit. e: "Zugänglichmachen"), and the standby does it on
the host's behalf, so the host's Art. 16 duty becomes devguard's
contractual duty. Three bases, in order of preference:

1. The recipient is certified under the Swiss-US Data Privacy Framework:
   adequacy by Anhang 1 DSV, nothing more needed. The certification must be
   current (the US list at dataprivacyframework.gov is the only evidence;
   check it at onboarding and yearly, since the search I ran confirms the
   self-certification is renewed annually). Whether Postmark, Mailgun or
   Cloudflare are certified for the Swiss framework I did not verify
   **[UNVERIFIED]**; it is a five-minute lookup before any is chosen.
2. Standard data protection clauses recognised by the EDÖB (Art. 16 Abs. 2
   lit. d DSG) with the duty in Art. 10 Abs. 1 DSV to see that the recipient
   observes them. The EDÖB has recognised the EU standard contractual
   clauses with Swiss amendments **[UNVERIFIED this session; the EDÖB page I
   tried returned 404]**.
3. Do not lean on Art. 17 exceptions. Lit. a needs the end user's explicit
   consent, which a support widget cannot collect meaningfully; lit. b
   Ziff. 2 ("im Interesse der betroffenen Person") is arguable for support
   delivery but is an exception to be construed narrowly, and Art. 17 Abs. 2
   lets the EDÖB ask about it.

**What the Swiss-US DPF changes.** For a certified recipient it replaces
clauses and the recipient-side verification with a list lookup; it changes
nothing for a non-certified one. It does not change what the host must tell
end users (Art. 19 Abs. 4: the state and, for a non-certified recipient, the
guarantee). And it is a political instrument subject to review (Art. 8
Abs. 4 DSV); a sub-processor list that can be swapped to an EU provider in a
week is worth more than a legal memo on the framework's durability.

**For an EU host, the chain continues under Art. 44 DSGVO** ("dies gilt
auch für die etwaige Weiterübermittlung [...] an ein anderes Drittland"):
the onward transfer from the Swiss standby to a US email provider needs an
EU-recognised basis too (EU-US DPF certification, or EU SCCs), and the DPA
must say which. The simplest product answer is to make the EU/CH email
provider the default and the US one an opt-in the host chooses.

**Zwingend.** Art. 16 and 17 DSG are mandatory and penal (Art. 61 lit. a);
the DPA can only allocate who does the paperwork, not waive it.

---

## 3. Security, breach notification, and what "we delete it" must mean

### Verified text

Art. 8 DSG:

> 1 Der Verantwortliche und der Auftragsbearbeiter gewährleisten durch
> geeignete technische und organisatorische Massnahmen eine dem Risiko
> angemessene Datensicherheit.
> 2 Die Massnahmen müssen es ermöglichen, Verletzungen der Datensicherheit
> zu vermeiden.
> 3 Der Bundesrat erlässt Bestimmungen über die Mindestanforderungen an die
> Datensicherheit.

Art. 61 lit. c DSG: a fine up to CHF 250 000, on complaint, for private
persons who intentionally "die Mindestanforderungen an die Datensicherheit,
die der Bundesrat nach Artikel 8 Absatz 3 erlassen hat, nicht einhalten."

Art. 2 DSV (the four objectives):

> Der Verantwortliche und der Auftragsbearbeiter müssen technische und
> organisatorische Massnahmen treffen, damit die bearbeiteten Daten ihrem
> Schutzbedarf entsprechend: a. nur Berechtigten zugänglich sind
> (Vertraulichkeit); b. verfügbar sind, wenn sie benötigt werden
> (Verfügbarkeit); c. nicht unberechtigt oder unbeabsichtigt verändert
> werden (Integrität); d. nachvollziehbar bearbeitet werden
> (Nachvollziehbarkeit).

Art. 3 DSV, the measures that bite for a standby (Abs. 1 lit. a-c and
Abs. 2 lit. d-f and Abs. 3 lit. a-c; full text in `dsv.md`):

> 1 [...] a. berechtigte Personen nur auf diejenigen Personendaten Zugriff
> haben, die sie zur Erfüllung ihrer Aufgaben benötigen (Zugriffskontrolle);
> [...] c. unbefugte Personen automatisierte Datenbearbeitungssysteme nicht
> mittels Einrichtungen zur Datenübertragung benutzen können
> (Benutzerkontrolle).
> 2 [...] c. unbefugte Personen bei der Bekanntgabe von Personendaten oder
> beim Transport von Datenträgern Personendaten nicht lesen, kopieren,
> verändern, löschen oder vernichten können (Transportkontrolle); d. die
> Verfügbarkeit der Personendaten und der Zugang zu ihnen bei einem
> physischen oder technischen Zwischenfall rasch wiederhergestellt werden
> können (Wiederherstellung); [...] f. Betriebssysteme und
> Anwendungssoftware stets auf dem neusten Sicherheitsstand gehalten und
> bekannte kritische Lücken geschlossen werden (Systemsicherheit).
> 3 [...] a. überprüft werden kann, welche Personendaten zu welcher Zeit und
> von welcher Person im automatisierten Datenbearbeitungssystem eingegeben
> oder verändert werden (Eingabekontrolle); b. überprüft werden kann, wem
> Personendaten mit Hilfe von Einrichtungen zur Datenübertragung
> bekanntgegeben werden (Bekanntgabekontrolle); c. Verletzungen der
> Datensicherheit rasch erkannt (Erkennung) und Massnahmen zur Minderung
> oder Beseitigung der Folgen ergriffen werden können (Beseitigung).

Art. 1 Abs. 4 and 5 DSV: the measures weigh "Stand der Technik" and
"Implementierungskosten" and "sind über die gesamte Bearbeitungsdauer
hinweg zu überprüfen".

Art. 4 Abs. 1 DSV (mandatory logging) applies only "Werden besonders
schützenswerte Personendaten in grossem Umfang automatisiert bearbeitet
oder wird ein Profiling mit hohem Risiko durchgeführt [...]"; Abs. 5 then
wants logs kept "während mindestens einem Jahr getrennt vom System". Art. 5
Abs. 1 DSV (Bearbeitungsreglement) has the same trigger.

Art. 24 DSG:

> 1 Der Verantwortliche meldet dem EDÖB so rasch als möglich eine Verletzung
> der Datensicherheit, die voraussichtlich zu einem hohen Risiko für die
> Persönlichkeit oder die Grundrechte der betroffenen Person führt.
> [...]
> 3 Der Auftragsbearbeiter meldet dem Verantwortlichen so rasch als möglich
> eine Verletzung der Datensicherheit.
> 4 Der Verantwortliche informiert die betroffene Person, wenn es zu ihrem
> Schutz erforderlich ist oder der EDÖB es verlangt.
> [...]
> 6 Eine Meldung, die aufgrund dieses Artikels erfolgt, darf in einem
> Strafverfahren gegen die meldepflichtige Person nur mit deren
> Einverständnis verwendet werden.

Art. 5 lit. h DSG: "Verletzung der Datensicherheit: eine Verletzung der
Sicherheit, die dazu führt, dass Personendaten unbeabsichtigt oder
widerrechtlich verlorengehen, gelöscht, vernichtet oder verändert werden
oder Unbefugten offengelegt oder zugänglich gemacht werden".

Art. 15 Abs. 1 and 4 DSV (content of the notice; documentation):

> 1 Die Meldung einer Verletzung der Datensicherheit an den EDÖB muss
> folgende Angaben enthalten: a. die Art der Verletzung; b. soweit möglich
> den Zeitpunkt und die Dauer; c. soweit möglich die Kategorien und die
> ungefähre Anzahl der betroffenen Personendaten; d. soweit möglich die
> Kategorien und die ungefähre Anzahl der betroffenen Personen; e. die
> Folgen, einschliesslich der allfälligen Risiken, für die betroffenen
> Personen; f. welche Massnahmen getroffen wurden oder vorgesehen sind, um
> den Mangel zu beheben und die Folgen [...] zu mindern; g. den Namen und
> die Kontaktdaten einer Ansprechperson.
> 4 Der Verantwortliche muss die Verletzungen dokumentieren. [...] Sie ist
> ab dem Zeitpunkt der Meldung nach Absatz 1 mindestens zwei Jahre
> aufzubewahren.

EDÖB, Leitfaden betreffend die Meldung von Datensicherheitsverletzungen
und Information der Betroffenen nach Art. 24 DSG, version 1.2 of 23 April
2025, Ziff. 1.2:

> Meldungen an den EDÖB (wie auch die Information der Betroffenen) obliegen
> dem Verantwortlichen. Der Auftragsbearbeiter hat seinerseits die Pflicht,
> den oder die Verantwortlichen über eine Verletzung der Datensicherheit zu
> informieren. Diese Informationspflicht ist nicht an eine Risikoabwägung
> wie in Art. 24 Abs. 1 DSG gebunden; der Auftragsbearbeiter hat den
> Verantwortlichen über jede Verletzung der Datensicherheit zu informieren,
> unabhängig davon, ob diese voraussichtlich zu einem hohen Risiko [...]
> führt.

Same guide, Ziff. 1.3: "Der Verantwortliche muss nach dem Gesetz «so rasch
als möglich» melden und kann demzufolge in solchen Fällen nicht die
Durchführung länger dauernder Abklärungen abwarten"; Ziff. 1.5: the EDÖB
provides a portal ("www.edoeb.admin.ch > Meldeportale > DataBreach") which
"stellt eine Bestätigung über den Zeitpunkt der Meldung aus"; Ziff. 1.6
(on encryption): "Wurden von einer Datensicherheitsverletzung betroffene
Personendaten vom Verantwortlichen wirksam verschlüsselt, bleiben sie für
alle unlesbar, die den Schlüssel nicht besitzen. Solche Daten gelten damit
datenschutzrechtlich für alle nicht zugriffsberechtigten Dritten als anonym,
weshalb eine Meldepflicht nach Art. 24 Abs. 1 DSG entfällt." Ziff. 1.8:
"Die gänzliche oder teilweise Missachtung der Meldepflicht an sich ist nach
DSG nicht strafbewehrt. Strafrechtlich relevant kann eine
Datensicherheitsverletzung aber dann sein, wenn der Verantwortliche z.B. die
Mindestanforderungen an die Datensicherheit nicht eingehalten hat (Art. 61
lit. c DSG)."

Art. 33 Abs. 1, 2 and 5 DSGVO:

> 1 Im Falle einer Verletzung des Schutzes personenbezogener Daten meldet
> der Verantwortliche unverzüglich und möglichst binnen 72 Stunden, nachdem
> ihm die Verletzung bekannt wurde, diese der [...] zuständigen
> Aufsichtsbehörde, es sei denn, dass die Verletzung [...] voraussichtlich
> nicht zu einem Risiko für die Rechte und Freiheiten natürlicher Personen
> führt. [...]
> 2 Wenn dem Auftragsverarbeiter eine Verletzung des Schutzes
> personenbezogener Daten bekannt wird, meldet er diese dem Verantwortlichen
> unverzüglich.
> 5 Der Verantwortliche dokumentiert Verletzungen des Schutzes
> personenbezogener Daten einschließlich aller [...] Fakten, ihrer
> Auswirkungen und der ergriffenen Abhilfemaßnahmen. [...]

Art. 6 Abs. 4 DSG: "Sie werden vernichtet oder anonymisiert, sobald sie zum
Zweck der Bearbeitung nicht mehr erforderlich sind." Art. 28 Abs. 3 lit. g
DSGVO (quoted in section 1): delete or return at the controller's choice,
and delete existing copies.

### Interpretation

**The processor's own duty.** Art. 8 Abs. 1 DSG names the Auftragsbearbeiter
directly, Art. 61 lit. c DSG applies to "private Personen" without
distinction, so devguard carries a statutory, penal security duty of its own
and not only a contractual one. The DSV sets objectives, not a checklist;
for a standby holding support conversations the measures that a reasonable
reader of Art. 3 DSV would expect are: TLS everywhere (Transportkontrolle),
encryption at rest with keys the hosting provider does not hold for
backups and attachments (which also, per the EDÖB's Ziff. 1.6, takes a lost
backup out of the Art. 24 Abs. 1 notification duty), agent access only via
the host's identity token with `isAgent` (Zugriffskontrolle; the package
already does this), audit log of agent actions (Eingabekontrolle; the
package's audit log already does this), an outbound log of which
sub-processor received what (Bekanntgabekontrolle; the email adapter should
log message id, recipient and provider, not the body), patching
(Systemsicherheit), restore tested (Wiederherstellung), and monitoring that
detects a breach (Erkennung). Mandatory logging under Art. 4 DSV and a
Bearbeitungsreglement under Art. 5 DSV are not triggered by support data
unless a host puts sensitive data through the widget at scale; the DPA
should let the host say if it does.

Note the irony the law hands the product: "Verfügbarkeit" (Art. 2 lit. b
DSV) and "Wiederherstellung" (Art. 3 Abs. 2 lit. d) are security objectives
of the host. The standby is itself one of the host's Art. 8 measures, and
the host's security documentation may list it as such.

**Breach flow.** Processor to controller "so rasch als möglich" (Art. 24
Abs. 3 DSG), "unverzüglich" (Art. 33 Abs. 2 DSGVO), for every breach
without a risk filter (EDÖB Ziff. 1.2). The controller then has the risk
call and, under the GDPR, a 72-hour clock that starts when the controller
learns of it. The DPA should therefore promise notice within a fixed short
window (24 hours is defensible for a one-person company; "without undue
delay and in any case within 24 hours of becoming aware") with the Art. 15
Abs. 1 DSV content so the host can file the EDÖB portal form or its
Art. 33 notice without a second round. The processor does not file with the
EDÖB; the guide says so. devguard should keep its own incident log for two
years, mirroring Art. 15 Abs. 4 DSV, so it can hand the host the facts.
Art. 24 Abs. 6 DSG (notices unusable in criminal proceedings against the
notifier without consent) is worth knowing when the maintainer hesitates.

**"We delete it after handback" in practice.** The statutes say when
(Art. 6 Abs. 4 DSG: as soon as no longer required; Art. 28 Abs. 3 lit. g
DSGVO: after the service, at the controller's choice between return and
deletion) but not how. The product has to define "deleted", because the
host's Auskunft duty (Art. 25 Abs. 4 DSG) and the EU host's accountability
both end at devguard's word. A definition that holds up:

- Live data: conversations, messages, attachments in object storage,
  contacts created in the standby, and the visitor tokens are deleted
  within a stated time after the host confirms the import (24 hours is
  realistic; the package's export marks what was exported, and the import
  report says what landed).
- Backups: state the rotation (for example "encrypted backups expire within
  30 days; a backup restored for disaster recovery in that window is
  re-deleted within 24 hours"). A promise of immediate deletion from
  backups is one that nobody can keep, and the Stanford caution applies to
  contracts as to answers: do not promise what the system cannot show.
- Logs: application logs carry references, timestamps, sizes and
  sub-processor message ids, never message bodies or attachment content,
  and expire on a stated schedule. If a log must contain a body for
  debugging, it is a copy under lit. g and must be in the deletion scope.
- The deletion certificate: no statute requires one; Art. 28 Abs. 3 lit. h
  DSGVO (information to demonstrate compliance) is the hook a host will cite
  when asking. Issue one per outage: what was deleted, when, the backup
  expiry date, the exceptions, signed by the maintainer. Better still, make
  the package's export/import produce it: the import report already counts
  what landed, and the standby's deletion job can emit the matching record.
- The handback is the "Rückgabe" of lit. g. Document the host's instruction
  to export and delete (an API call with the host's secret counts as a
  documented instruction, Art. 28 Abs. 3 lit. a) so the sequence is on
  record.

**Zwingend.** Art. 8 DSG and Art. 1-3 DSV are mandatory minimums with a
penalty; the DPA describes them, it cannot lower them. Art. 24 Abs. 3 DSG
is mandatory; the DPA can only make "so rasch als möglich" concrete.

---

## 4. The host's duties the product must make easy

### Verified text

Art. 19 DSG:

> 1 Der Verantwortliche informiert die betroffene Person angemessen über die
> Beschaffung von Personendaten; [...]
> 2 Er teilt der betroffenen Person bei der Beschaffung diejenigen
> Informationen mit, die erforderlich sind, damit sie ihre Rechte nach
> diesem Gesetz geltend machen kann und eine transparente Datenbearbeitung
> gewährleistet ist; er teilt ihr mindestens mit: a. die Identität und die
> Kontaktdaten des Verantwortlichen; b. den Bearbeitungszweck;
> c. gegebenenfalls die Empfängerinnen und Empfänger oder die Kategorien
> von Empfängerinnen und Empfängern, denen Personendaten bekanntgegeben
> werden.
> [...]
> 4 Werden die Personendaten ins Ausland bekanntgegeben, so teilt er der
> betroffenen Person auch den Staat oder das internationale Organ und
> gegebenenfalls die Garantien nach Artikel 16 Absatz 2 oder die Anwendung
> einer Ausnahme nach Artikel 17 mit.

Art. 20 Abs. 1 lit. a DSG: the duty "entfällt, wenn [...] a. Die betroffene
Person verfügt bereits über die entsprechenden Informationen." Art. 13 DSV:
"Der Verantwortliche muss der betroffenen Person die Information über die
Beschaffung von Personendaten in präziser, transparenter, verständlicher und
leicht zugänglicher Form mitteilen." Art. 60 Abs. 1 lit. b DSG: a fine up to
CHF 250 000 for those who intentionally omit "die betroffene Person nach den
Artikeln 19 Absatz 1 [...] zu informieren, oder [...] ihr die Angaben nach
Artikel 19 Absatz 2 zu liefern."

Art. 5 lit. a DSG: "Personendaten: alle Angaben, die sich auf eine bestimmte
oder bestimmbare natürliche Person beziehen". Art. 6 Abs. 3 DSG:
"Personendaten dürfen nur zu einem bestimmten und für die betroffene Person
erkennbaren Zweck beschafft werden; sie dürfen nur so bearbeitet werden, dass
es mit diesem Zweck vereinbar ist." Art. 7 Abs. 1 DSG: "Der Verantwortliche
ist verpflichtet, die Datenbearbeitung technisch und organisatorisch so
auszugestalten, dass die Datenschutzvorschriften eingehalten werden [...].
Er berücksichtigt dies ab der Planung."

Art. 13 Abs. 1 DSGVO, the items that the standby touches:

> Werden personenbezogene Daten bei der betroffenen Person erhoben, so teilt
> der Verantwortliche der betroffenen Person zum Zeitpunkt der Erhebung
> dieser Daten Folgendes mit: a) den Namen und die Kontaktdaten des
> Verantwortlichen [...]; c) die Zwecke, für die die personenbezogenen Daten
> verarbeitet werden sollen, sowie die Rechtsgrundlage für die Verarbeitung;
> [...] e) gegebenenfalls die Empfänger oder Kategorien von Empfängern der
> personenbezogenen Daten und f) gegebenenfalls die Absicht des
> Verantwortlichen, die personenbezogenen Daten an ein Drittland [...] zu
> übermitteln, sowie das Vorhandensein oder das Fehlen eines
> Angemessenheitsbeschlusses der Kommission [...]

Art. 13 Abs. 2 lit. a DSGVO: "die Dauer, für die die personenbezogenen Daten
gespeichert werden oder, falls dies nicht möglich ist, die Kriterien für die
Festlegung dieser Dauer". Art. 13 Abs. 4: "Die Absätze 1, 2 und 3 finden
keine Anwendung, wenn und soweit die betroffene Person bereits über die
Informationen verfügt."

### Interpretation

**What the host must say, and when.** At collection (Art. 19 Abs. 2 DSG,
"bei der Beschaffung"; Art. 13 Abs. 1 DSGVO, "zum Zeitpunkt der Erhebung").
The widget's existing privacy line (`form.privacy` with the inbox's
`privacyUrl`) is the right instrument, and it must point to the host's
notice, never devguard's. Whether an Auftragsbearbeiter is an "Empfänger"
to be named under Art. 19 Abs. 2 lit. c is a question of doctrine I could
not read this session (the onlinekommentar.ch commentary on Art. 19 exists
but its PDF could not be text-extracted); the safe reading, and the one the
GDPR text supports with "Empfänger oder Kategorien von Empfängern", is to
name the category and, because it costs nothing, the company. The state
(Art. 19 Abs. 4) is mandatory if the standby or a sub-processor is abroad.

A wording the host can paste, English:

> When our product is unavailable, the support widget and inbox run on a
> standby operated for us by devguard AG, Switzerland, which stores your
> name, email address, messages, attachments and the page details you
> choose to send only for the duration of the outage. Afterwards the
> conversations are moved into our own systems and the standby's copy is
> deleted within [30] days. [If applicable: Replies are sent through
> [provider], [country]; see "Transfers" below.]

German (Swiss Standard German, "Sie"):

> Ist unser Produkt nicht erreichbar, laufen Support-Widget und Posteingang
> auf einem Ausfallsystem, das die devguard AG, Schweiz, in unserem Auftrag
> betreibt. Es speichert Ihren Namen, Ihre E-Mail-Adresse, Ihre Nachrichten,
> Anhänge und die von Ihnen freigegebenen Seitenangaben nur für die Dauer
> des Ausfalls. Danach werden die Gespräche in unsere eigenen Systeme
> übernommen und die Kopie des Ausfallsystems innert [30] Tagen gelöscht.

The product should ship this text as a documented snippet in the host's
language set and show, in standby mode, a one-line banner in the widget
("You are writing to our standby support; your message reaches the team and
is kept in our own system afterwards") so that Art. 20 Abs. 1 lit. a DSG and
Art. 13 Abs. 4 DSGVO (information already held) do the rest.

**The visitor without an email.** Still personal data where the person is
"bestimmbar" (Art. 5 lit. a DSG): a visitor token in `localStorage`, the
page URL, the browser string and the message text together usually are. So
the same notice applies; nothing weaker. What changes is the product, not
the law: a visitor who left no email can read a reply only through the
token, and after handback the host's install knows nothing of the standby's
token or the standby reference (`context.imported` keeps the old reference,
and an imported conversation gets a new one). That is a product gap with a
legal edge: the person was told their conversation would be kept, and
cannot find it. Either the standby keeps answering reads for its old
references for a grace period (which conflicts with deletion) or the import
maps old references and tokens so the host's widget resolves them. The
package must solve this; the host's notice should not promise more than
the package does.

**The handback import.** Same controller, two processors: the export from
the standby to the host is a "Rückgabe" to the controller, covered by the
DPA, and needs no new legal basis, no consent and no notice of its own.
Art. 16 DSG arises only if the host's database is abroad (adequate for the
EU and EEA; for the UK, Anhang 1 lists it). Two accuracy points from
Art. 6 Abs. 5 DSG: the import must keep authorship and timestamps (the
export carries `author`, `name`, `email`, `createdAt`, `emailMessageId` and
the events, so it does), and it must not re-trigger notifications or SLA
clocks (it does not start an SLA clock; emails to the contact on import
would be a second processing the person did not expect and should stay
off). The host's retention statement (Art. 13 Abs. 2 lit. a DSGVO) should
cover the standby's copy ("deleted within N days after the outage") so the
total lifetime is disclosed.

**Zwingend.** Art. 19 DSG and Art. 13 DSGVO are mandatory and, for an
intentional omission, penal (Art. 60 DSG). The product cannot do the
host's informing; it can make it a one-line configuration and a documented
snippet, which is what Art. 7 Abs. 1 DSG ("ab der Planung") asks of the
host and what the host will expect of the package.

---

## 5. Liability for selling "support that stays up"

### Verified text

Art. 19 Abs. 2 OR (SR 220, Stand 1.1.2026, unchanged on 1.10.2026): "Von
den gesetzlichen Vorschriften abweichende Vereinbarungen sind nur zulässig,
wo das Gesetz nicht eine unabänderliche Vorschrift aufstellt oder die
Abweichung nicht einen Verstoss gegen die öffentliche Ordnung, gegen die
guten Sitten oder gegen das Recht der Persönlichkeit in sich schliesst."

Art. 97 Abs. 1 OR: "Kann die Erfüllung der Verbindlichkeit überhaupt nicht
oder nicht gehörig bewirkt werden, so hat der Schuldner für den daraus
entstehenden Schaden Ersatz zu leisten, sofern er nicht beweist, dass ihm
keinerlei Verschulden zur Last falle."

Art. 99 Abs. 1 and 2 OR: "1 Der Schuldner haftet im Allgemeinen für jedes
Verschulden. 2 Das Mass der Haftung richtet sich nach der besonderen Natur
des Geschäftes und wird insbesondere milder beurteilt, wenn das Geschäft für
den Schuldner keinerlei Vorteil bezweckt."

Art. 100 OR:

> 1 Eine zum voraus getroffene Verabredung, wonach die Haftung für
> rechtswidrige Absicht oder grobe Fahrlässigkeit ausgeschlossen sein würde,
> ist nichtig.
> 2 Auch ein zum voraus erklärter Verzicht auf Haftung für leichtes
> Verschulden kann nach Ermessen des Richters als nichtig betrachtet werden,
> wenn der Verzichtende zur Zeit seiner Erklärung im Dienst des anderen
> Teiles stand, oder wenn die Verantwortlichkeit aus dem Betriebe eines
> obrigkeitlich konzessionierten Gewerbes folgt.

Art. 101 OR:

> 1 Wer die Erfüllung einer Schuldpflicht [...] durch eine Hilfsperson [...]
> vornehmen lässt, hat dem andern den Schaden zu ersetzen, den die
> Hilfsperson in Ausübung ihrer Verrichtungen verursacht.
> 2 Diese Haftung kann durch eine zum voraus getroffene Verabredung
> beschränkt oder aufgehoben werden.
> 3 Steht aber der Verzichtende im Dienst des andern oder folgt die
> Verantwortlichkeit aus dem Betriebe eines obrigkeitlich konzessionierten
> Gewerbes, so darf die Haftung höchstens für leichtes Verschulden
> wegbedungen werden.

Art. 160 Abs. 1 OR: "Wenn für den Fall der Nichterfüllung oder der nicht
richtigen Erfüllung eines Vertrages eine Konventionalstrafe versprochen ist,
so ist der Gläubiger mangels anderer Abrede nur berechtigt, entweder die
Erfüllung oder die Strafe zu fordern." Art. 161 OR: "1 Die Konventionalstrafe
ist verfallen, auch wenn dem Gläubiger kein Schaden erwachsen ist.
2 Übersteigt der erlittene Schaden den Betrag der Strafe, so kann der
Gläubiger den Mehrbetrag nur so weit einfordern, als er ein Verschulden
nachweist." Art. 163 OR: "1 Die Konventionalstrafe kann von den Parteien in
beliebiger Höhe bestimmt werden. 2 Sie kann nicht gefordert werden, [...]
mangels anderer Abrede, wenn die Erfüllung durch einen vom Schuldner nicht
zu vertretenden Umstand unmöglich geworden ist. 3 Übermässig hohe
Konventionalstrafen hat der Richter nach seinem Ermessen herabzusetzen."

Art. 394 Abs. 2 OR: "Verträge über Arbeitsleistung, die keiner besondern
Vertragsart dieses Gesetzes unterstellt sind, stehen unter den Vorschriften
über den Auftrag." Art. 398 Abs. 2 and 3 OR: "2 Er haftet dem Auftraggeber
für getreue und sorgfältige Ausführung des ihm übertragenen Geschäftes.
3 Er hat das Geschäft persönlich zu besorgen, ausgenommen, wenn er zur
Übertragung an einen Dritten ermächtigt [...] ist [...]." Art. 399 Abs. 2
OR: "War er zur Übertragung befugt, so haftet er nur für gehörige Sorgfalt
bei der Wahl und Instruktion des Dritten." Art. 404 OR: "1 Der Auftrag kann
von jedem Teile jederzeit widerrufen oder gekündigt werden. 2 Erfolgt dies
jedoch zur Unzeit, so ist der zurücktretende Teil zum Ersatze des dem
anderen verursachten Schadens verpflichtet."

BGE 115 II 464 E. 2a (read on search.bger.ch; the host dropped umlauts,
restored here): "Nach der Rechtsprechung des Bundesgerichts ist das
jederzeitige Auflösungsrecht zwingend und beschlägt sowohl reine
Auftragsverhältnisse als auch gemischte Verträge, für welche hinsichtlich
der zeitlichen Bindung der Parteien die Bestimmungen des Auftragsrechtes
als sachgerecht erscheinen". Regeste: "Das jederzeitige Widerrufsrecht im
Auftragsverhältnis ist zwingender Natur und darf vertraglich weder
wegbedungen noch beschränkt werden; Bestätigung der Rechtsprechung."

BGE 138 III 411 E. 3.1 (AGB, Ungewöhnlichkeitsregel): "Danach sind von der
global erklärten Zustimmung zu allgemeinen Vertragsbedingungen alle
ungewöhnlichen Klauseln ausgenommen, auf deren Vorhandensein die schwächere
oder weniger geschäftserfahrene Partei nicht gesondert aufmerksam gemacht
worden ist. [...] Die Ungewöhnlichkeitsregel kommt jedoch nur dann zur
Anwendung, wenn neben der subjektiven Voraussetzung des Fehlens von
Branchenerfahrung die betreffende Klausel objektiv beurteilt einen
geschäftsfremden Inhalt aufweist. [...] Je stärker eine Klausel die
Rechtsstellung des Vertragspartners beeinträchtigt, desto eher ist sie als
ungewöhnlich zu qualifizieren".

BGE 133 III 43, Regeste: "Bei Beurteilung der Übermässigkeit der
Konventionalstrafe ist nicht abstrakt vom höchstmöglichen Schaden
auszugehen, sondern es sind die konkreten Umstände zu berücksichtigen unter
Einschluss des Schadensrisikos, dem der Gläubiger ausgesetzt war."

Art. 8 UWG (SR 241, Stand 1.1.2025): "Unlauter handelt insbesondere, wer
allgemeine Geschäftsbedingungen verwendet, die in Treu und Glauben
verletzender Weise zum Nachteil der Konsumentinnen und Konsumenten ein
erhebliches und ungerechtfertigtes Missverhältnis zwischen den vertraglichen
Rechten und den vertraglichen Pflichten vorsehen." Art. 3 Abs. 1 lit. b UWG:
"Unlauter handelt insbesondere, wer [...] über sich, seine Firma, seine
Geschäftsbezeichnung, seine Waren, Werke oder Leistungen [...] unrichtige
oder irreführende Angaben macht". Art. 23 Abs. 1 UWG: intentional unfair
competition under Art. 3 is punishable on complaint with up to three years.

### Interpretation

**Contract type, and the Art. 404 trap.** A managed standby is a service
contract without a named type; Art. 394 Abs. 2 OR routes it to mandate
rules by default. BGE 115 II 464 makes the right to end a mandate at any
time mandatory, also for mixed contracts where mandate rules fit the
parties' time binding. Whether hosting and SaaS contracts, as continuing
obligations with infrastructure commitments, escape Art. 404 is contested
in the Lehre and not settled by a BGE I could find; a St. Gallen decision
(BE.2012.50 of 9 October 2012) repeats the mandatory character. The
practical consequence: a 12-month minimum term with payment for the whole
term may be unenforceable against a host who walks away, and devguard too
can walk away "jederzeit" (owing damages only if "zur Unzeit"). Price the
standby monthly, or annually with a refund of unused months, and the
question never reaches a court. A lawyer with Swisslex access should
confirm before an annual-prepaid tier is offered.

**What the AGB may exclude.** Art. 100 Abs. 1 OR is the ceiling and is
mandatory: liability for intent and gross negligence of devguard itself
cannot be excluded. Everything below it is open: exclusion of liability
for leichte Fahrlässigkeit, exclusion of indirect and consequential loss
(lost profit, lost customers, reputational harm), a cap at the fees paid in
the preceding twelve months, service credits as the sole remedy for
availability shortfalls. Art. 100 Abs. 2 does not bite (devguard is not in
the host's service and runs no concessioned trade). Art. 101 Abs. 2 OR goes
further for the sub-processors: liability for the hosting provider's and
email provider's acts, even their gross negligence, "kann durch eine zum
voraus getroffene Verabredung beschränkt oder aufgehoben werden", and
Abs. 3 does not apply. So the AGB may say devguard answers for sub-processors
only for the care in choosing and instructing them (echoing Art. 399
Abs. 2), with the same cap. Two cautions: a clause that excludes liability
for the hosting provider's outage must be written as an Art. 101 Abs. 2
limitation of auxiliary liability, not as a disguised exclusion of
devguard's own gross negligence (no monitoring, ignored alerts, a single
unbacked region would be devguard's own fault, not the provider's); and
under BGE 138 III 411 a cap or exclusion that is "ungewöhnlich" for an
inexperienced counterparty falls out of a global acceptance unless pointed
out, so put the liability clause in its own headed section the host ticks
separately. Hosts are businesses, so Art. 8 UWG (consumers only) does not
apply; Art. 2 UWG remains as the general fairness floor.

**Service credits.** Legally they are a Konventionalstrafe (Art. 160-163 OR)
or, if drafted as a price reduction, a Minderung; the Konventionalstrafe
frame is the useful one because Art. 161 Abs. 2 OR then limits any claim
beyond the credit to proven fault and Art. 160 Abs. 1 lets the parties
agree the credit as the exclusive remedy. The combination that works under
Art. 100: credits are the sole and exclusive remedy for unavailability,
except where the unavailability results from devguard's intent or gross
negligence, in which case the general cap applies. Art. 163 Abs. 3 (court
reduction of an excessive penalty) protects devguard, not the host, and
with credits capped at the monthly fee it will never be reached;
BGE 133 III 43 says the measure is the concrete risk the creditor bore,
which for a monthly fee is small. A realistic clause:

- Measurement: availability of the standby's `health` route per calendar
  month, measured by devguard's monitor from at least two locations,
  excluding the host's own DNS, embedding, identity-token and relay
  failures, and announced maintenance (48 hours' notice, outside the
  host's business hours).
- Credits: below 99.5 percent, 10 percent of the monthly fee; below 99.0,
  25 percent; below 95.0, 50 percent; cap 100 percent of the month's fee;
  claimed within 30 days, applied to the next invoice; no cash payout.
- Exclusive remedy, with the Art. 100 carve-out above.

Do not exclude "upstream provider outage" wholesale: the product's one
promise is to be up when the host is down, and an SLA that excuses the
most likely cause of the standby's own outage is the kind of
"geschäftsfremder Inhalt" BGE 138 III 411 describes. Cap it instead.

**The one-person company.** The law does not grade liability by headcount;
Art. 97 presumes fault and Art. 99 Abs. 1 holds the debtor "für jedes
Verschulden". What headcount changes is what a court will call "grob
fahrlässig": for a service sold on availability, having no on-call cover,
no monitoring, no runbook, or a single region would be hard to defend as
mere leichte Fahrlässigkeit. The SLA should be written as a measured
objective with credits, never as a guarantee of outcome, and the AGB should
say plainly that the standby is operated by a small team, that it depends
on named providers, and that it is a second line, not an insurance policy.
The honest sentence protects better than the clever clause.

**The claim when the standby is down during the host's outage.** The host's
damage is lost support during its own incident: lost customers, refunds it
grants, reputational harm. All of it is indirect, hard to prove in causation
and quantum, and excluded or capped by the AGB for leichte Fahrlässigkeit.
The exposure that survives is gross negligence (Art. 100 Abs. 1), and the
cap, and the credits. Keep a professional liability insurance in mind once
the first paying host signs; a lawyer or broker can size it.

**Marketing copy.** "Support that stays up when your app doesn't" is a
statement of fact about the service under Art. 3 Abs. 1 lit. b UWG, and a
specific promise in advertising can be read into the contract as a
Zusicherung. Today the section says "Not built yet", which keeps it an
intention. Once sold: use "stays reachable" with the measured SLA figure
beside it, "a separate failure domain" as the mechanism, and never
"always", "guaranteed" or "never goes down". The headline can stay as the
name of the idea if the pricing page carries the SLA and the AGB say the
SLA is the whole of the availability promise.

**Zwingend or dispositiv, in one list.** Art. 100 Abs. 1 OR: zwingend.
Art. 101 Abs. 2 OR: dispositiv (limitation allowed). Art. 160-163 OR:
dispositiv, except Art. 163 Abs. 3 (court reduction) which the parties
cannot exclude. Art. 404 OR: zwingend per BGE 115 II 464 where mandate rules
apply, contested for hosting. Art. 97-99 OR: dispositiv within Art. 100.

---

## 6. The open-source package beside the paid service

### Verified text

`LICENSE`: "MIT License. Copyright (c) 2026 devguard AG. [...] THE SOFTWARE
IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED [...]
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
DAMAGES OR OTHER LIABILITY [...]". The licence grants the rights "to use,
copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
the Software"; it says nothing about trademarks.

`ROADMAP.md`: "A hosted mode or a hosted relay. It ships where your app
ships: no second deploy to run and no data-processing agreement to sign,
because we never see your data." Website section: "Not built yet. The
open-source package will never depend on it."

Art. 2 Abs. 3 URG (SR 231.1, Stand 1.7.2025): "Als Werke gelten auch
Computerprogramme."

MSchG (SR 232.11, Stand 1.7.2025): Art. 1 Abs. 1: "Die Marke ist ein
Zeichen, das geeignet ist, Waren oder Dienstleistungen eines Unternehmens
von solchen anderer Unternehmen zu unterscheiden." Art. 2 lit. a: excluded
are "Zeichen, die Gemeingut sind, es sei denn, dass sie sich als Marke für
die Waren oder Dienstleistungen durchgesetzt haben, für die sie beansprucht
werden". Art. 5: "Das Markenrecht entsteht mit der Eintragung im Register."
Art. 6: "Das Markenrecht steht demjenigen zu, der die Marke zuerst
hinterlegt." Art. 13 Abs. 1: "Das Markenrecht verleiht dem Inhaber das
ausschliessliche Recht, die Marke zur Kennzeichnung der Waren oder
Dienstleistungen, für die sie beansprucht wird, zu gebrauchen und darüber zu
verfügen." Art. 14 Abs. 1: "Der Markeninhaber kann einem anderen nicht
verbieten, ein von diesem bereits vor der Hinterlegung gebrauchtes Zeichen
im bisherigen Umfang weiter zu gebrauchen." Art. 28 Abs. 1: "Jede Person
kann eine Marke hinterlegen."

Art. 3 Abs. 1 lit. d UWG: unfair is who "Massnahmen trifft, die geeignet
sind, Verwechslungen mit den Waren, Werken, Leistungen oder dem
Geschäftsbetrieb eines anderen herbeizuführen".

### Interpretation

**Two contracts, two warranties, kept apart.** The MIT licence governs the
package for everyone, including paying hosts; its "AS IS" clause is a
Freizeichnung that Swiss law reads through Art. 100 OR like any other, so
even for the free package devguard cannot disclaim gross negligence, though
Art. 99 Abs. 2 OR ("milder beurteilt, wenn das Geschäft für den Schuldner
keinerlei Vorteil bezweckt") softens the standard for a gift. The service
AGB govern the standby and carry the SLA. The AGB must say, in one clause,
that the package remains licensed under MIT, that nothing in the service
contract extends a warranty to the package or to the host's own install,
and that the service does not depend on any package version beyond what
the docs state. Otherwise a host will argue the SLA covers the whole
helpdesk, including the part running in its own app.

**"Never depend on it" is a public promise.** Under Art. 3 Abs. 1 lit. b UWG
it must stay true, so every package feature the standby needs must be
adapter-shaped and usable with a self-hosted standby (the brief's own
constraint, now with a legal reason). The ROADMAP line "no data-processing
agreement to sign, because we never see your data" must be rewritten the
day the standby ships, since with a standby devguard does see data and a
DPA is signed; leaving it would be an "unrichtige Angabe" about the
service.

**The name.** Trademark rights arise by registration (Art. 5 MSchG), to the
first filer (Art. 6). Nothing in the MIT licence reserves the name, so any
fork may ship as "Better Helpdesk" and any competitor may run "Better
Helpdesk Standby" until a mark exists; the only fallback is Art. 3 Abs. 1
lit. d UWG (confusion), which needs an established reputation to prove.
Two obstacles to registering: "Better Helpdesk" for helpdesk software is
close to Gemeingut (Art. 2 lit. a MSchG, descriptive plus laudatory), so a
word mark may be refused and a combined word-and-figurative mark with the
pixel-smiley is the likelier route; and I could not search Swissreg this
session (the search I ran found no entry but did not reach the register
itself), so whether anyone holds a conflicting mark is **[UNVERIFIED]**.
File in Switzerland first (classes 9 and 42 are the usual software and SaaS
classes under the Nice classification **[UNVERIFIED this session]**), and
add a trademark line to the README ("Better Helpdesk is a trademark of
devguard AG; the MIT licence does not grant trademark rights") so that the
licence and the name are visibly separate. Art. 14 MSchG protects devguard's
own prior use if someone files first, but only "im bisherigen Umfang", which
does not cover a service that does not yet exist.

**Copyright.** The package is a work (Art. 2 Abs. 3 URG); devguard AG as
licensor must actually hold the rights. With one maintainer who is also an
employee of another company (the brief says the maintainer also works at
Divio), the question whether code written on Divio time belongs to Divio
(Art. 332 OR, not read this session **[UNVERIFIED]**) is the one a lawyer
should close before a paid service rests on the package. No contributor
agreement is needed for inbound MIT contributions as long as the repository
states the inbound licence.

---

## 7. The private list on the website

### Verified text

What the site does (`continuity-form.tsx`, `submit.ts`, `helpdesk.ts`): the
form sends `email`, `subject: 'Continuity list'`, `body: "Joined the private
continuity list. Would pay: yes|not said."`, `context: { url, host: { pay:
'yes'|'no' } }` to the `continuity` inbox (public, `privacyUrl` set, no
`receipt`), and fires `posthog.capture('continuity_joined', { would_pay })`.
The section copy says "Join the private list to hear about it first [...]
No newsletter, only news about this."

The privacy page (last updated 5 October 2026): "This site and the data it
collects are run by the Better Helpdesk project. To ask about your data
[...] write to us through 'Ask a question'". Purpose: "to contact you about
the managed standby if you joined that list. We do not send newsletters and
we do not sell or share your data." Collected: "When you [...] join the
continuity list, we store your name, your email address, your message, any
company or website you enter". Location: "In this site's own Postgres
database, hosted with Divio. Replies go out by email through our mail
provider, and visit counts go to PostHog in the EU." Retention: "Until the
conversation is no longer needed, or until you ask us to delete it."

Art. 6 Abs. 1-4 and 6 DSG:

> 1 Personendaten müssen rechtmässig bearbeitet werden.
> 2 Die Bearbeitung muss nach Treu und Glauben erfolgen und
> verhältnismässig sein.
> 3 Personendaten dürfen nur zu einem bestimmten und für die betroffene
> Person erkennbaren Zweck beschafft werden; sie dürfen nur so bearbeitet
> werden, dass es mit diesem Zweck vereinbar ist.
> 4 Sie werden vernichtet oder anonymisiert, sobald sie zum Zweck der
> Bearbeitung nicht mehr erforderlich sind.
> 6 Ist die Einwilligung der betroffenen Person erforderlich, so ist diese
> Einwilligung nur gültig, wenn sie für eine oder mehrere bestimmte
> Bearbeitungen nach angemessener Information freiwillig erteilt wird.

Art. 31 Abs. 1 DSG: "Eine Persönlichkeitsverletzung ist widerrechtlich, wenn
sie nicht durch Einwilligung der betroffenen Person, durch ein
überwiegendes privates oder öffentliches Interesse oder durch Gesetz
gerechtfertigt ist." Art. 19 Abs. 2 lit. a DSG (quoted in section 4): the
notice must give "die Identität und die Kontaktdaten des Verantwortlichen".

Art. 3 Abs. 1 lit. o UWG:

> Unlauter handelt insbesondere, wer: [...] o. Massenwerbung ohne direkten
> Zusammenhang mit einem angeforderten Inhalt fernmeldetechnisch sendet oder
> solche Sendungen veranlasst und es dabei unterlässt, vorher die
> Einwilligung der Kunden einzuholen, den korrekten Absender anzugeben oder
> auf eine problemlose und kostenlose Ablehnungsmöglichkeit hinzuweisen; wer
> beim Verkauf von Waren, Werken oder Leistungen Kontaktinformationen von
> Kunden erhält und dabei auf die Ablehnungsmöglichkeit hinweist, handelt
> nicht unlauter, wenn er diesen Kunden ohne deren Einwilligung Massenwerbung
> für eigene ähnliche Waren, Werke oder Leistungen sendet;

Art. 8 ZGB (SR 210, Stand 1.7.2026): "Wo das Gesetz es nicht anders
bestimmt, hat derjenige das Vorhandensein einer behaupteten Tatsache zu
beweisen, der aus ihr Rechte ableitet."

### Interpretation

**Storing the email and the "would pay" answer.** Both are personal data.
The DSG needs no consent for ordinary processing; it needs a recognisable
purpose (Art. 6 Abs. 3) and proportionality (Abs. 2), and a Rechtfertigungsgrund
only if a Persönlichkeitsverletzung is in play (Art. 30, 31). An opinion the
person volunteered in a labelled checkbox, stored to size demand for the
thing they asked to hear about, is proportionate and purpose-bound. It may
be stored. Two repairs: the privacy page lists name, email, message, company
and website but not "whether you said you would pay for it", so add that
line (Art. 19 Abs. 2 lit. b, the purpose "to decide what it becomes" and the
item itself); and delete the list, or anonymise the counts, when the
exploration ends or the standby launches and the person has been written to
(Art. 6 Abs. 4). The PostHog event carries `would_pay` against a daily
hash in cookieless mode, which the privacy page already describes; fine.

**Who is responsible.** The privacy page names "the Better Helpdesk
project". Art. 19 Abs. 2 lit. a DSG requires the identity and contact
details of the Verantwortliche, which is a legal person: devguard AG, with a
postal address and an email address. This is the one line on the page that
is wrong today and it is a cheap fix; Art. 60 Abs. 1 lit. b DSG makes an
intentional omission a fineable offence, which no one will pursue, but a
host's lawyer reading the page before signing will notice. Likewise "our
mail provider" should name the provider's country if abroad (Art. 19
Abs. 4).

**Writing to the list.** An email to everyone on the list announcing the
standby or its pricing is "Massenwerbung" sent "fernmeldetechnisch" under
Art. 3 Abs. 1 lit. o UWG. The list is the consent, and it is a good one:
specific ("only news about this"), informed (the section and the privacy
page), voluntary (Art. 6 Abs. 6 DSG for the quality of consent). Three
conditions on every mail: the correct sender (devguard AG, not a no-reply
alias with no identity), a free and simple unsubscribe, and content that is
news about the standby, not about the package, the website or anything
else. Sending a general newsletter to this list would be outside the
consent and unfair under lit. o, with Art. 23 UWG behind it. The second
half of lit. o (existing customers, similar services) does not help: these
people bought nothing.

**Double opt-in.** No Swiss statute requires it. What the law does is put
the burden of proving consent on the sender (Art. 8 ZGB), and a form
submission with no confirmation proves only that someone typed an address.
Setting `receipt: true` on the `continuity` inbox sends the package's
receipt email, which is transactional and not Werbung, and gives devguard a
record that the address exists and was reached. Cheap, and it also tells
the person what was stored.

**EU residents on the list.** The GDPR's consent and the ePrivacy rules on
direct marketing were not analysed here; they turn on EU law and belong to
a lawyer if the list is marketed outside Switzerland. The UWG test above is
the stricter of the two in form, so a mail that passes it will not be far
off.

**Zwingend.** Art. 3 Abs. 1 lit. o UWG and Art. 6 DSG are mandatory. Consent
can be withdrawn at any time; the unsubscribe is the withdrawal.

---

## Where a Rechtsanwalt is needed, consolidated

- The DPA and AGB before the first paying host signs: this is "a contract
  of material value about to be signed", and the liability clause, the
  Art. 404 OR question and the Art. 101 Abs. 2 OR drafting turn on the
  commentaries and contested case law I cannot read.
- Any EU host, or the first EU resident's complaint: Art. 3 Abs. 2 and
  Art. 27 DSGVO for a Swiss processor, and the EU-side transfer basis for a
  US email provider, are EU law; I name the issue and do not answer it.
- Before an annual-prepaid tier: Art. 404 OR.
- Before filing the trademark: a professional clearance search and the
  descriptiveness risk under Art. 2 lit. a MSchG.
- The copyright chain between the maintainer, devguard AG and the
  maintainer's employer (Art. 332 OR, not read).
- The day an EDÖB inquiry, a Betreibung or a damages claim from a host
  arrives: immediately, and devguard does not answer the authority itself.

## Stand of every act quoted, and what I could not verify

DSG SR 235.1 Stand 7 July 2025; DSV SR 235.11 Stand 1 December 2025; OR
SR 220 Stand 1 January 2026, checked against the 1 October 2026
consolidation for every article quoted (unchanged); UWG SR 241 Stand
1 January 2025; ZGB SR 210 Stand 1 July 2026; BV SR 101 Stand 3 March 2024
(not quoted); MSchG SR 232.11 Stand 1 July 2025; URG SR 231.1 Stand 1 July
2025. All stored files were fetched on 24 September 2026, 28 days ago;
under the one-month rule they are current, and the OR check above covers
the one known gap. GDPR: German text as reproduced at dsgvo-gesetz.de, not
compared with the Official Journal.

Not verified this session, never load-bearing above: the article text of
Commission Decision 2000/518/EC (existence, title, date and the 15 January
2024 review verified); the EDPB Guidelines 3/2018; the EDÖB's recognition of
the EU SCCs for Swiss transfers; whether Postmark, Mailgun or Cloudflare
hold a current Swiss-US DPF certification; the Swissreg register for
"Better Helpdesk"; the Nice class numbers; Art. 332 OR; Art. 30 Abs. 2
DSGVO. Doctrine on whether processors must be named as "Empfänger" under
Art. 19 DSG, on Art. 404 OR for hosting contracts, and on Art. 100 OR in
B2B AGB is paywalled and was not read; where it would decide the point, the
text says so.

A lawyer is needed as listed above. This report is not legal advice and is
not privileged; it was produced with a third-party AI processor.

## What I recommend

**Sell the standby Swiss-only first: a Swiss host, Swiss or EU hosting, no
US sub-processor in the default configuration, under one DPA drafted to
Art. 28 Abs. 3 DSGVO with the three Swiss additions, AGB with an Art. 100
OR-shaped liability cap and credits as the exclusive remedy, monthly
pricing, and a deletion certificate the package itself produces.** That
configuration has no Art. 16 DSG transfer, no EU representative question,
no transfer impact assessment, and a liability profile a one-person company
can carry. It lets the maintainer sign a DPA that is one document and
answer a security questionnaire with the DSV's own vocabulary. The
product work it implies is small and inside the package's rules: the
host-facing privacy snippet and standby banner, the sub-processor annex as
a documented list, the `receipt` on the continuity inbox, the deletion
record from the import report, and the visitor-token mapping on handback.

Rejected alternatives:

- *Hosting the standby on a US hyperscaler because it is cheap and global.*
  Every host would then need an Art. 16 basis for its end users' data,
  every privacy notice would name the United States, and the selling point
  against Intercom and Zendesk ("your data does not leave") would be gone
  on day one.
- *Selling to EU hosts from the start.* The adequacy of Switzerland makes
  the data flow easy, but Art. 28 in full, the Art. 27 representative
  question and the EU-side onward-transfer rules for the email provider
  need a lawyer before the first signature; the two design partners are the
  better first customers.
- *An annual-prepaid tier for cash flow.* Art. 404 OR and BGE 115 II 464
  make the prepaid term uncertain; monthly billing removes the question
  and matches a service most hosts will use only a few hours a year.
- *A "no liability for upstream outages" clause.* Legally available under
  Art. 101 Abs. 2 OR, but it excuses the most likely cause of the standby's
  own failure, which BGE 138 III 411 would call geschäftsfremd and a buyer
  would call hollow; a cap does the same job honestly.
- *Keeping the standby's copy for a grace period so visitors can still
  read replies.* It solves the token problem by breaking the deletion
  promise; the import must carry the mapping instead.

## Open questions for the maintainer

1. Will devguard ever use standby data for anything of its own (metrics on
   message volume, product research, AI drafting)? If yes, the role
   analysis in section 1 changes and a second privacy notice is needed.
2. Who hosts the standby, and in which country? The answer sets the
   Art. 19 Abs. 4 line in every host's privacy notice and the sub-processor
   annex.
3. Which outbound email provider is the default, and is it Swiss-US DPF
   certified (check dataprivacyframework.gov) or EU-based?
4. Does the standby need Cloudflare at all, or only the host's own relay?
   Every US component is a line in the annex and the notice.
5. Backup rotation and log retention for the standby: what are the numbers
   the deletion certificate will state?
6. How does the handback map standby references and visitor tokens so a
   visitor without an email can still find a reply after the outage?
7. Are the two design partners under any secrecy duty (Art. 9 Abs. 1 lit. b
   DSG) that forbids a standby, and do their own customer contracts allow
   sub-processors?
8. Is "Better Helpdesk" free to register, and does the maintainer want the
   word mark, the figurative mark with the pixel-smiley, or both?
9. Who owns the code the maintainer wrote while employed elsewhere, and is
   that settled in writing with devguard AG?
10. Will the continuity list ever be written to from outside Switzerland or
    with anything but standby news? If yes, the EU marketing rules need a
    lawyer before the first send.
