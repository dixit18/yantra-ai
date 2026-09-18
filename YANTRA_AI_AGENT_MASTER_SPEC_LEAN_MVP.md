# YANTRA AI — Master Product, Design, Architecture & Autonomous Engineering Specification

**Working name:** Yantra AI  
**Document version:** 1.1 — Lean MVP Infrastructure  
**Date:** 18 September 2026  
**Primary wedge:** AI product/service specialist for Indian machinery manufacturers  
**Initial vertical:** Pharma and packaging machinery OEMs  
**Purpose:** This is the single source of truth an autonomous engineering agent should use to design, build, test, improve, document, and progressively expand Yantra AI from zero to an enterprise platform whose scope extends beyond the capabilities publicly described for Prox.

> This document is not a list of ideas. It is an execution contract. The coding agent should treat product principles, safety gates, architecture boundaries, acceptance criteria, test gates, and phase dependencies as requirements unless an ADR explicitly changes them.

---

## 1. Executive brief

Yantra AI turns a machinery manufacturer's scattered product and service knowledge into a governed, multimodal product specialist available to customers, dealers, salespeople, service desks, and field technicians. It must understand the exact machine context, retrieve manufacturer-approved evidence, apply deterministic rules and calculators, answer with citations, identify compatible parts, create service/quote artifacts, escalate when confidence is insufficient, and eventually use telemetry and historical service outcomes to become a proactive lifecycle platform.

The starting problem is simple: industrial manufacturers repeatedly answer the same technically difficult questions, but the knowledge needed to answer them lives across manuals, spreadsheets, parts catalogues, service tickets, drawings, videos, ERP/CRM systems, and a few experienced engineers. This creates slow response, dependence on senior staff, incorrect part selection, missed spare/AMC revenue, inconsistent dealer support, and loss of tribal knowledge.

Prox's public YC profile describes an AI product specialist that uses approved product knowledge, expert rules, calculators and connected systems to support product discovery, configuration, quote preparation, installation, troubleshooting, parts, service, replacement, and upgrades. Yantra AI should cover that core category, but its roadmap intentionally extends into capabilities that are not part of Prox's publicly described YC scope as of this document: serial-number-first installed-base intelligence, visual machine/part recognition, structured tribal-knowledge capture, technician mobile/offline workflows, 3D exploded-parts interaction, service execution, proactive maintenance, optional IoT/telemetry ingestion, machine lifecycle intelligence, and India-first multilingual/WhatsApp workflows. [R1]

### 1.1 North-star promise

**For the operator:** Scan the machine. Ask in your language. Get the correct, manufacturer-approved answer or the correct human escalation.

**For the manufacturer:** Make your best product/service engineer available everywhere, preserve expert knowledge, shorten resolution time, and convert service interactions into parts, AMC, upgrade, replacement, and sales opportunities.

### 1.2 Initial wedge

Do not start as "AI for manufacturing." Start with one repeatable job:

**Pharma/packaging machinery service knowledge + spare-parts identification.**

The first paid deployment should prove that a service technician or customer can select/scan a known machine, ask a support question, receive a grounded answer with exact source citation, identify a compatible part when relevant, and escalate with complete context when the system cannot answer safely.

### 1.3 What Yantra AI is not

- Not a generic chatbot over PDFs.
- Not a replacement for the manufacturer's ERP/CRM/FSM in early phases.
- Not an autonomous controller of physical machinery.
- Not permitted to invent safety procedures, electrical values, torque values, limits, part compatibility, or operating instructions.
- Not a consumer-style assistant that answers without evidence.
- Not a design-demo that is visually impressive but operationally unreliable.
- Not a massive microservice architecture on day one.

---

## 2. Non-negotiable product principles

1. **Machine context before answer.** Resolve manufacturer, product family, model, revision, serial number, configuration, and installed options whenever those facts can change the answer.
2. **Approved knowledge before model knowledge.** Product-specific answers must come from tenant-approved sources, rules, calculators, service history, or connected systems.
3. **Citations are part of the answer contract.** Technical answers must identify source document/version and, where possible, page/section/table/image anchor.
4. **Deterministic logic beats language-model guessing.** Compatibility, calculations, limits, warranty status, pricing, and safety gates use rules/tools, not free-form inference.
5. **Abstention is a feature.** If evidence is weak or conflicting, the product asks a discriminating question or escalates.
6. **Actions preserve context.** A service ticket, RFQ, quotation, parts request, dealer handoff, or human escalation carries the complete machine/problem context so the user never restarts from zero.
7. **Human approval is first-class.** Sensitive actions pause and resume from state persisted in PostgreSQL; approval state is auditable. A dedicated durable-workflow platform is introduced only after client validation requires it.
8. **Every tenant is isolated.** Knowledge, embeddings, tools, credentials, analytics, and logs are tenant-scoped by construction.
9. **Every important agent action is observable.** Store run, state transitions, retrieved evidence, tool calls, decisions, confidence, cost, latency, and final outcome.
10. **Every production answer can be evaluated.** Maintain golden test sets and regression gates; prompts are versioned artifacts, not hidden strings.
11. **The product improves from resolved work, not raw chat volume.** Human-approved service outcomes become knowledge candidates, not automatically trusted truth.
12. **The website demonstrates the product truthfully.** No fake dashboards, fake counters, fake customer logos, or unverifiable ROI claims.

---

## 3. Ideal customer profile and user map

### 3.1 Initial manufacturer ICP

Prioritize machinery OEMs with these characteristics:

- 25–500 employees.
- 100+ installed machines or a growing installed base.
- Multiple models/revisions and meaningful spare-parts complexity.
- Manuals, drawings, service SOPs, or parts catalogues exist but are difficult to search.
- Senior engineers repeatedly answer questions from junior engineers, customers, or dealers.
- Service is delivered through phone, WhatsApp, email, dealer networks, or field technicians.
- Spare parts, AMC, consumables, upgrades, or replacement machines create aftermarket revenue.
- Management can identify support backlog, engineer dependency, service response time, or spare-parts leakage as a real problem.

Initial vertical ranking:

1. Pharma and packaging machinery.
2. Food-processing and bottling lines.
3. Pumps, compressors and fluid-handling equipment.
4. HVAC and industrial cooling equipment.
5. Textile machinery.
6. Machine tools/CNC accessories.
7. Water-treatment and process equipment.
8. Agricultural/industrial equipment with dealer networks.

### 3.2 Buyer committee

| Role | Pain | Value Yantra AI must prove |
|---|---|---|
| Owner/MD | Senior-engineer dependence; service cost; missed aftermarket revenue | More service capacity without linear headcount; knowledge retention; measurable revenue attribution |
| Head of Service | Repetitive questions; slow triage; incomplete tickets | Faster first response; better triage; fewer avoidable escalations |
| Product/Application Engineer | Repeated sizing/configuration questions | Reusable approved rules and calculators; faster qualification |
| Spare-parts team | Wrong/slow part identification | Serial/revision-aware compatibility and quote-ready part requests |
| Dealer/Channel head | Inconsistent dealer capability | Same approved expert available to every dealer |
| IT/Operations | Integration/security risk | Controlled deployment, auditability, SSO/RBAC, system-of-record preservation |

### 3.3 End-user personas

- Machine operator at a customer factory.
- Maintenance technician.
- Manufacturer field-service engineer.
- Dealer technician.
- Service desk agent.
- Sales/application engineer.
- Spare-parts executive.
- Product manager/knowledge approver.
- Service manager/admin.

---

## 4. Jobs to be done

### 4.1 Service and support

- "Tell me what this fault code means for this exact machine revision."
- "Show the approved diagnostic sequence and where it comes from."
- "I sent a photo. Identify the component or ask me for a better angle."
- "What information should I collect before escalating this case?"
- "Create a service ticket with everything already known."
- "Summarize the case for the senior engineer in 30 seconds."

### 4.2 Parts and aftermarket

- "Which seal/bearing/drive/sensor fits serial number X?"
- "Is part A superseded by part B?"
- "Generate a parts request or quotation draft."
- "Show compatible alternatives approved by engineering."
- "This machine is due for an AMC/consumable replacement—surface the opportunity."

### 4.3 Product selection and sales

- "Given throughput, viscosity, bottle dimensions, utilities, and regulatory constraints, which approved configuration fits?"
- "What missing input actually changes the recommendation?"
- "Generate a technical selection note, BOM/RFQ, or quote draft with assumptions."

### 4.4 Knowledge capture

- "Interview our senior engineer and extract candidate troubleshooting rules."
- "Detect conflicting procedures across manual versions."
- "Convert a resolved service case into a reviewable knowledge candidate."
- "Show which frequently asked questions have weak or missing evidence."

---

## 5. Success metrics and outcome model

Do not optimize for message volume. Measure business outcomes.

### 5.1 Core operational metrics

- Median first-response time.
- Median time-to-resolution.
- First-contact resolution rate.
- Service-case deflection rate, separated into safe self-service vs internal-assist.
- Escalation rate and reason distribution.
- Percentage of answers with complete citation coverage.
- Unsupported-answer rate.
- Technician minutes saved per case.
- Senior-engineer interruption hours saved.
- Part-identification accuracy.
- Wrong-part/return rate where customer can provide baseline.

### 5.2 Revenue metrics

- Parts requests generated from support sessions.
- Parts quote conversion.
- AMC renewal opportunities surfaced and converted.
- Upgrade/replacement opportunities surfaced.
- Product-selection sessions that become qualified leads/RFQs.
- Revenue influenced/attributed, with conservative attribution rules.

### 5.3 AI quality metrics

- Grounded answer precision.
- Citation precision and citation completeness.
- Correct abstention rate.
- Tool selection accuracy.
- Tool argument validity.
- Compatibility-rule pass rate.
- Safety-policy pass rate.
- Retrieval recall@k on golden queries.
- Latency p50/p95.
- Cost per resolved case.

---

## 6. Product surfaces

Yantra AI should be one platform with multiple surfaces, not separate products.

### 6.1 Marketing website

Purpose: explain the category, demonstrate machine-context intelligence, capture qualified OEM leads, and let prospects experience a controlled demo.

Pages:

- Home.
- Product.
- Service & Support.
- Parts & Aftermarket.
- Sales & Configuration.
- Knowledge Engine.
- Security & Governance.
- Integrations.
- Industries.
- Demo sandbox.
- Case studies (only after real deployments).
- Resources.
- Contact / request pilot.

### 6.2 Manufacturer console

Modules:

- Overview.
- Product catalog.
- Installed base.
- Documents & knowledge.
- Knowledge approval queue.
- Parts & compatibility.
- Faults/procedures/rules/calculators.
- Conversations.
- Service cases.
- Quotes/RFQs.
- Users/dealers/roles.
- Integrations.
- Agent policies.
- Evaluations.
- Analytics/ROI.
- Audit log.

### 6.3 Customer/dealer assistant

Channels:

- Embedded web assistant.
- QR-code deep link tied to asset/serial number.
- WhatsApp.
- Optional voice.
- Dealer portal/tablet view.

### 6.4 Technician workspace

A focused mobile-first experience:

- Scan QR/serial/label.
- Search/ask.
- Take/upload photos/video.
- View approved steps and source.
- Parts lookup.
- Capture measurement/result.
- Escalate.
- Create/update service case.
- Dictate technician notes.
- Close case with root cause, action, parts used, and evidence.
- Offline cached machine packet in later phase.

### 6.5 Knowledge studio

This is a core differentiator, not an admin afterthought.

- Source inventory and status.
- Document versioning.
- Parsing quality preview.
- Tables/diagram extraction review.
- Entity/part/model/revision linking.
- Conflicts and stale-source alerts.
- Draft knowledge assertions.
- Expert approval/rejection/edit.
- Effective dates and supersession.
- Coverage gaps based on unanswered/escalated questions.
- Tribal-knowledge interviews.

---

## 7. Website and visual design specification

### 7.1 Design goal

The site must feel like an industrial technology company designed by humans with strong product taste—not a generic AI landing page assembled from gradient cards.

Visual references should come from industrial instrumentation, technical manuals, high-end engineering software, product cutaways, precision grids, and contemporary editorial design.

### 7.2 Avoid these generic AI-site patterns

- Purple/blue neon gradients everywhere.
- Floating glowing orb as the primary visual.
- Excessive glassmorphism.
- A wall of identical rounded cards.
- Generic robot/brain/sparkle icons.
- Fake chat screenshots with unrealistic perfect answers.
- "Revolutionize / unleash / supercharge" copy without operational proof.
- Autoplay motion that competes with reading.
- 3D added merely as decoration.

### 7.3 Visual language

Use a restrained industrial palette:

- Graphite/near-black for structure.
- Warm off-white for large surfaces.
- Neutral steel grays for secondary UI.
- One safety/accent color inspired by machine indicators for status and calls to action.
- Green/amber/red only for semantic state.

Typography:

- Neutral grotesk/sans for UI and editorial copy.
- Monospaced font for serials, part numbers, measurements, citations, and machine telemetry.
- Strong numeric hierarchy; tables and technical facts should feel engineered, not decorative.

Layout:

- 12-column desktop grid.
- Large editorial whitespace.
- Hard alignment lines and subtle technical-grid motifs.
- Borders and separators preferred over floating shadows.
- Corners can be slightly rounded but avoid universal pill shapes.

### 7.4 Hero concept

**Hero headline:** "Your best service engineer, available on every machine."

**Supporting line:** "Turn manuals, parts data, service history and expert rules into a governed product specialist for customers, dealers and technicians."

**Primary CTA:** Request a pilot  
**Secondary CTA:** See how a machine is resolved

Hero visual:

A real or synthetic industrial machine model rendered in Three.js/React Three Fiber. The camera slowly orbits only when idle. The user can hover/select machine subsystems. As the hero story advances, the machine transitions from physical asset → identified serial/configuration → source knowledge → diagnosis → compatible part → service/quote action. The 3D interaction must communicate product architecture; it must not be decorative spectacle.

### 7.5 Home-page narrative

1. Hero: machine → expert anywhere.
2. Problem strip: "The answer exists. It is just trapped in six systems and two senior engineers."
3. Interactive machine journey: Scan → understand → diagnose → act.
4. Proof of governance: exact source citations, rules, versioning, approval.
5. Three outcome lanes: Support / Parts / Sales.
6. Knowledge engine: manuals + service cases + expert knowledge.
7. System-of-record architecture: ERP/CRM/FSM remain in place.
8. India-first deployment: WhatsApp, multilingual, dealers, field service.
9. Security/governance.
10. Pilot CTA.

### 7.6 3D and motion stack

Recommended:

- Three.js via React Three Fiber for scene composition.
- Drei helpers where useful, but keep scene logic explicit.
- GSAP + ScrollTrigger for scroll-linked timelines; ScrollTrigger supports scrub, pin, snap, and event-triggered animation. [R6]
- Use WebGPU only as an enhancement where support and production stability are acceptable; Three.js exposes capability detection, so maintain a WebGL fallback. [R7]
- GLTF/GLB assets with Draco/Meshopt compression.
- Prefer baked lighting and optimized geometry over expensive real-time effects.

Motion rules:

- Motion communicates state transition or causality.
- Respect `prefers-reduced-motion`.
- No scroll hijacking.
- Maintain input responsiveness on mid-range mobile devices.
- 3D module must lazy-load and degrade to a static poster when performance budget is exceeded.

### 7.7 Website performance budgets

Targets for production marketing pages:

- Core content usable without the 3D bundle.
- Initial route JavaScript kept deliberately small; 3D loaded after primary content.
- Compressed hero 3D asset target under ~2–3 MB for first scene; progressively load optional detail.
- Images in AVIF/WebP with responsive sizing.
- No animation should block navigation or CTA interaction.
- Automated Lighthouse/Web Vitals checks in CI; exact numeric gates can be tuned after the first realistic build.

### 7.8 Application UI design

Console should resemble professional industrial software rather than the marketing site:

- Dense but calm data tables.
- Persistent global machine/part search.
- Model/serial/revision displayed in monospaced chips.
- Evidence pane always accessible beside AI answer.
- Clear distinction between AI suggestion, deterministic rule result, and approved human knowledge.
- Every destructive or externally visible action displays what will happen before confirmation.
- Use custom design tokens and primitives; do not ship default shadcn styling unchanged.

---

## 8. Recommended technical architecture

### 8.1 Architectural philosophy

Start as a **single deployable modular monolith plus one optional lightweight AI worker**, not dozens of services. The MVP must be able to run with only the application process, PostgreSQL, a persistent local data directory, and the configured AI provider. Separate boundaries in code so services can split later without forcing infrastructure complexity now.

Use TypeScript for product/API/integrations. Use Python only where document/vision/ML ecosystem support materially improves implementation; Python must not become a required service merely for architectural purity. The frontend remains in the user's React/Node comfort zone.

### 8.2 Monorepo layout

```text
/apps
  /web                 # marketing + customer/dealer surfaces (Next.js)
  /console             # manufacturer/admin console (may share Next.js app initially)
  /api                 # NestJS application API + MVP job runner
  /worker-ai           # OPTIONAL Python worker only when a library genuinely requires it

/packages
  /ui                   # Yantra design system
  /contracts            # OpenAPI/JSON Schema/Zod/Pydantic contracts
  /db                   # schema, migrations, generated types
  /auth                 # auth/permissions helpers
  /agent-core           # graph state, policies, tool interfaces
  /connectors           # ERP/CRM/FSM/WhatsApp connectors
  /knowledge            # ontology + retrieval interfaces
  /evals                # datasets, judges, regression harness
  /telemetry            # logging/tracing conventions
  /config               # shared typed configuration

/infra
  /scripts              # database/bootstrap/deployment helpers
  /scale-later          # future infrastructure notes; not active MVP dependencies

/docs
  PRODUCT.md
  ARCHITECTURE.md
  SECURITY.md
  RUNBOOK.md
  ADR/
  API/
  EVALS.md

/agent
  AGENTS.md
  ROADMAP.md
  BACKLOG.yaml
  STATUS.md
  DECISIONS.md
  AUTONOMY_POLICY.md
```

### 8.3 Frontend

- Next.js App Router. Official Next.js documentation positions it as the newer router with React Server Components support. [R5]
- React + TypeScript.
- Tailwind CSS or CSS variables + utility layer; custom visual primitives.
- Radix primitives selectively for accessible low-level behavior.
- React Three Fiber + Drei for 3D.
- GSAP/ScrollTrigger for orchestrated marketing motion.
- TanStack Query only where client-server cache semantics are useful; prefer server data fetching for initial app screens.
- React Hook Form + schema validation for complex forms.
- E2E: Playwright.

### 8.4 API/application backend

- NestJS + TypeScript.
- REST first with OpenAPI contracts; use webhooks/events only when integrations require them.
- Generated typed client for frontend.
- **No Redis/BullMQ requirement in the MVP.** Short/background work is represented by a PostgreSQL `job` table and processed by an in-process or separate lightweight runner. Use row locking (`FOR UPDATE SKIP LOCKED`), attempt counters, `run_after`, idempotency keys, and explicit terminal states.
- Human waits/approvals are represented as PostgreSQL state transitions. The system must be restart-safe: no important workflow exists only in memory.
- If a task can complete synchronously within a normal request budget, do not make it asynchronous merely because it can be.

### 8.5 MVP workflow persistence — PostgreSQL first

Do **not** introduce Temporal, Redis, Kafka, or a dedicated queue platform during pre-client MVP development. Persist workflow state in PostgreSQL.

Use small explicit tables such as:

- `job` — queued/running/succeeded/failed/cancelled, attempts, `run_after`, lock owner/time;
- `workflow_instance` — workflow type, entity reference, current state, context JSONB, status;
- `approval_request` — requested action, actor, state, expiry, decision/audit data;
- `outbox_event` — optional transactional outbox for external notifications/integrations.

Rules:

1. jobs are idempotent;
2. retries are bounded and observable;
3. user-visible actions are never executed twice;
4. a process restart can reconstruct pending work from PostgreSQL;
5. complexity is upgraded only when real client workflows prove that PostgreSQL-backed orchestration is insufficient.

### 8.6 Agent reasoning graphs

Use **LangGraph or an equivalent explicit graph abstraction** inside bounded reasoning tasks. Graph nodes should have single responsibilities, structured state, retries, clear edges, and interrupt points. LangGraph's documentation emphasizes discrete nodes, state checkpointing, retry policies and human-in-the-loop interrupts. [R2]

Important separation for the MVP:

```text
PostgreSQL workflow state = durable-enough product process for the validated MVP
LangGraph-style graph     = bounded cognitive/reasoning graph inside one task
```

Do not let an unconstrained LLM loop replace explicit state. A dedicated durable-workflow engine is a later infrastructure upgrade, not an MVP dependency.

### 8.7 Database — required

Yes, a database is required from Phase 1.

**Primary:** PostgreSQL.  
**Vector extension:** pgvector.  
**Local development:** connect to the PostgreSQL instance supplied through `DATABASE_URL`; Docker is optional, never required.  
**Hosted choices:** managed Postgres such as RDS, Supabase, Neon, Crunchy, etc.; keep code portable.

Why Postgres + pgvector:

- relational integrity for manufacturer/product/part/asset/service data;
- transactions and auditability;
- row-level tenant constraints;
- JSONB for flexible source metadata;
- full-text search;
- vector similarity in the same transactional store;
- pgvector supports exact and approximate nearest-neighbor search including HNSW and IVFFlat. [R9]

### 8.8 Lean MVP infrastructure + scale-later agent dictionary

#### Required now

The pre-client product must run with the smallest practical stack:

- **PostgreSQL** as the single persistent system of record. Enable `pgvector` when the supplied Postgres supports extensions; it is part of Postgres, not a separate service.
- **Local persistent filesystem** through a `BlobStore` interface for manuals, images, drawings and generated artifacts. Default root: `./data/uploads` in development and a mounted persistent directory on a single-server deployment. Store hashes/metadata/tenant ownership in Postgres.
- **PostgreSQL-backed jobs/workflow state** for background processing, retries and approvals.
- **Application memory/cache only** for non-critical ephemeral acceleration. Losing it must never lose business state.
- **AI provider API(s)** behind `ModelGateway` for chat/reasoning, embeddings and optional vision/transcription.
- normal application logs plus database audit records.

All persistence boundaries must be interfaces (`BlobStore`, `JobRunner`, `WorkflowStore`, `Cache`) so future infrastructure can replace the implementation without changing product logic.

#### What the user needs to provide for the MVP

At minimum:

```text
DATABASE_URL=...
MODEL_PROVIDER=...
MODEL_API_KEY=...
APP_SECRET=...
LOCAL_BLOB_ROOT=./data/uploads   # no credential required
```

The agent must create `.env.example` with placeholders only. It must continue with mocks/local fixtures until a real secret is genuinely required.

#### SCALE-LATER AGENT DICTIONARY — do not implement until its trigger is met

The coding agent must treat the following as **deferred upgrades**, not backlog work:

| Capability | Do NOT add yet | Trigger to reconsider | Migration boundary already required now |
|---|---|---|---|
| Object storage | S3/R2/MinIO | First real client with durable external uploads, multi-instance deployment, large media volume, or backup/compliance need | `BlobStore` interface + content hashes |
| Shared cache / ephemeral locks | Redis | Multiple API instances, measured cache pressure, distributed rate limits/locks, or queue throughput that Postgres cannot meet | `Cache`/lock adapter |
| Dedicated job queue | BullMQ/Redis or another queue | Sustained background backlog/throughput causes measurable DB/job latency | `JobRunner` contract |
| Durable workflow engine | Temporal or equivalent | Workflows wait hours/days across many external callbacks/human approvals and DB state-machine maintenance becomes materially risky | `WorkflowStore` + explicit state machine |
| Event streaming | Kafka/Redis Streams/etc. | High event volume, several independent consumers, replay requirements proven by production use | transactional outbox |
| Separate vector database | specialist vector DB | pgvector is measured as the bottleneck at real corpus/query scale | retrieval interface |
| CDN/media pipeline | dedicated CDN/transcoding | Real traffic or media volume makes origin delivery slow/expensive | media URL abstraction |
| Kubernetes/microservices | orchestration platform | Team/service/traffic boundaries justify independent scaling/deployment | modular package boundaries |
| Enterprise secret manager/SSO | managed enterprise services | First client/security review requires them | config/auth provider interfaces |

**Rule:** a technology being “enterprise-grade” is not a trigger. A measured product/client requirement is. When a trigger is reached, the agent creates an ADR containing evidence, migration plan, rollback plan and new operational burden before implementation.

### 8.9 Model/provider abstraction

Create a `ModelGateway` interface rather than coupling the product to one vendor.

Capabilities:

- reasoning/chat model;
- fast classification/extraction model;
- embeddings;
- vision;
- speech-to-text;
- text-to-speech;
- optional reranker.

Routing can vary by tenant, task, residency, cost, latency, and quality. All prompts and model settings are versioned.

---

## 9. Core data model

### 9.1 Tenant and identity

**tenant**
- id
- legal_name
- slug
- region
- default_locale
- retention_policy
- created_at

**user**
- id
- tenant_id
- name
- email/phone
- status

**role / permission / user_role**
- explicit capability-based permissions; do not rely only on UI hiding.

**dealer / customer_organization / site**
- represents downstream organizations and physical customer sites.

### 9.2 Product and installed base

**product_family** → **product_model** → **product_revision**

Fields include:
- model code
- effective dates
- status
- technical attributes
- required utilities
- certifications
- source-of-truth references

**asset** (installed machine)
- tenant_id
- customer/site
- serial number
- product revision
- commissioning date
- warranty window
- configuration snapshot
- installed options
- firmware/software version where relevant
- QR token
- lifecycle status

Never derive current asset configuration only from a generic model record; store the installed snapshot and changes.

### 9.3 Parts and compatibility

**part**
- part number
- description
- revision
- superseded_by
- consumable flag
- lead-time metadata

**part_compatibility**
- part_id
- product_revision_id or configuration predicate
- effective dates
- compatibility status
- deterministic rule expression
- approval/source

**bom / bom_item**
- model/revision/configuration aware.

### 9.4 Knowledge sources

**document**
- source type
- title
- confidentiality
- owner

**document_version**
- immutable file pointer/hash
- version label
- effective_from/to
- approval state
- supersedes

**document_segment**
- page/section/table/image anchors
- structured text
- layout metadata
- embedding
- keywords

**knowledge_assertion**
- normalized proposition or rule candidate
- evidence list
- applicability scope
- approval state
- approver
- confidence
- effective dates

**procedure** / **procedure_step**
- explicit ordered manufacturer-approved process.

**fault_code** / **symptom** / **cause** / **diagnostic_test**
- graph-like relational model; do not hide everything inside embeddings.

### 9.5 Service and conversation

**conversation / message**
- channel
- asset context
- user role
- language
- citations
- agent run id

**service_case**
- asset
- symptom
- severity
- status
- root cause
- resolution
- parts used
- technician
- timestamps/SLA

**escalation**
- reason
- target expert/team
- context packet
- response

### 9.6 Agent/audit

**agent_run**
- workflow type/version
- input hash
- model versions
- start/end
- outcome
- confidence
- cost
- latency

**agent_step / tool_call / retrieval_event / policy_decision**
- immutable trace records.

**feedback / evaluation_case / evaluation_result**
- support regression testing and learning.

### 9.7 Commercial/action data

**part_request / rfq / quote / quote_line / service_order / amc_contract / opportunity**

Start read-only where possible; write actions require idempotency keys and approval policies.

---

## 10. Knowledge ingestion and ontology pipeline

### 10.1 Source types

Support progressively:

- PDF manuals.
- DOCX/PPTX.
- CSV/XLSX parts and fitment tables.
- Images/scans.
- CAD-derived renders/exploded diagrams as viewable assets.
- Training videos.
- Historical tickets/service reports.
- Emails/knowledge articles where permitted.
- ERP/CRM/FSM data through connectors.
- Expert interviews.

### 10.2 Ingestion workflow

```text
Upload / Connector
  → malware/type/hash validation
  → immutable raw object
  → parse/OCR/layout extraction
  → pages/sections/tables/images
  → metadata normalization
  → model/part/revision entity extraction
  → ontology linking
  → chunk/segment creation
  → lexical + vector indexes
  → citation anchors
  → quality checks
  → conflict/staleness detection
  → human review when required
  → approved/retrievable
```

### 10.3 Parsing rules

- Preserve document hierarchy, page number, section title, table boundaries and image references.
- Never flatten a compatibility matrix into unordered prose.
- Preserve units exactly and normalize separately.
- Extract part numbers and model codes with deterministic regex/dictionaries before LLM enrichment.
- Store raw extracted text plus normalized representation.
- Hash source versions so citations remain reproducible.

### 10.4 Hybrid retrieval

A technical query should not rely on vector similarity alone.

Candidate pipeline:

1. Tenant and role filter.
2. Resolve asset/product/part/fault entities.
3. Structured relational lookup for exact codes/parts/compatibility.
4. Lexical search for exact technical tokens.
5. Vector retrieval for semantic concepts.
6. Rerank with machine/revision applicability.
7. Reject superseded/conflicting sources unless explicitly needed.
8. Assemble evidence packet with citation anchors.

### 10.5 Source precedence

Example precedence, tenant-configurable:

1. Active safety bulletin / service bulletin.
2. Approved procedure/rule.
3. Current model/revision service manual.
4. Current product manual.
5. Approved parts/fitment table.
6. Human-approved knowledge assertion.
7. Resolved historical cases.
8. Draft/unapproved knowledge only for internal reviewers, never customer answers.

### 10.6 Conflict policy

If two approved sources conflict:

- do not silently choose;
- detect scope/version/effective-date differences;
- if conflict remains, abstain and open a knowledge-quality issue;
- record both sources and route to an expert.

---

## 11. The core Product Specialist reasoning graph

### 11.1 State

```text
SpecialistState
  tenant
  actor/role/channel
  user_message
  language
  asset_context
  product_context
  intent
  risk_class
  extracted_entities
  missing_discriminators
  evidence[]
  rules/results[]
  candidate_answer
  citation_coverage
  confidence
  proposed_actions[]
  approval_requirements[]
  escalation_context
```

### 11.2 Graph

```text
START
  ↓
Authenticate / tenant scope
  ↓
Classify intent + risk
  ↓
Resolve asset/product context
  ↓
Need discriminating info? ──yes──> Ask only question(s) that change result ──┐
  │ no                                                                      │
  ↓                                                                         │
Plan retrieval/tools <───────────────────────────────────────────────────────┘
  ↓
Structured lookup + hybrid retrieval
  ↓
Apply deterministic rules/calculators
  ↓
Evidence sufficient? ──no──> broaden retrieval / ask user / escalate
  │ yes
  ↓
Draft answer + cited steps
  ↓
Citation validator + safety/policy validator
  ↓
Pass? ──no──> repair once → if still fail → abstain/escalate
  │ yes
  ↓
Offer permitted action(s)
  ↓
Human approval required? ──yes──> persist approval state in PostgreSQL and pause
  │ no / approved
  ↓
Execute idempotent tool
  ↓
Record outcome + telemetry
  ↓
END
```

### 11.3 Confidence is not one model's self-score

Compute confidence from observable signals such as:

- exact asset resolution;
- source relevance/reranker score;
- number and consistency of independent approved sources;
- revision applicability;
- deterministic rule pass/fail;
- citation coverage;
- presence of unresolved conflicts;
- similarity to validated evaluation cases.

Use thresholds by risk class. A marketing/product-description answer may tolerate lower certainty than electrical/service instructions.

---

## 12. Agent skill catalog

### 12.1 Service Diagnostic Agent

Inputs: asset, symptom/error, measurements/photos, approved docs, service history.  
Tools: retrieval, fault-code lookup, approved procedure engine, measurement capture, ticket create/escalate.  
Writes: case draft, diagnostic observations.  
Cannot: create unapproved procedures or bypass safety interlocks.

### 12.2 Parts Compatibility Agent

Inputs: asset/revision/configuration, requested component or symptom.  
Tools: BOM/part graph, supersession rules, inventory/pricing read APIs.  
Output: compatible part(s) with reason and evidence.  
High-risk rule: if deterministic compatibility cannot be proven, return "engineering verification required".

### 12.3 Product Selection / Application Engineer Agent

Collects discriminating requirements, applies approved selectors/calculators, produces ranked *compatible configurations* without pretending to know commercial preference. It can generate a technical selection note and RFQ/quote draft.

### 12.4 Quote/RFQ Agent

Builds draft quote data from approved configuration/parts and commercial systems. External sending or final commercial commitment requires configured approval.

### 12.5 Service Coordinator Agent

Creates case, finds service entitlement, proposes technician/slot, requests missing context, tracks status, sends approved updates, and closes the loop after resolution.

### 12.6 Knowledge Curator Agent

Processes new sources, detects duplicates/conflicts, creates candidate assertions, links entities, highlights coverage gaps, and sends review batches to approved experts. It never self-approves technical truth.

### 12.7 Tribal Knowledge Interviewer

Conducts adaptive interviews with senior engineers. It asks about applicability boundaries, exceptions, revision differences, measurements, failure signatures, and evidence. Output is a structured **candidate** knowledge packet requiring expert approval.

### 12.8 Technician Copilot

Mobile-first, case-aware, photo/voice friendly. Summarizes machine context, retrieves evidence, records readings, produces draft service report, and converts field outcomes into knowledge candidates.

### 12.9 Lifecycle/Aftermarket Agent — later phase

Uses installed-base, warranty, parts/consumable schedules, service history, and optional telemetry to surface approved service/AMC/upgrade opportunities. Customer outreach obeys tenant policy and consent rules.

---

## 13. Safety, governance and security

Industrial support is not a normal chatbot. The product must fail safely.

### 13.1 Risk classes

**R0 — informational:** product description, public specification, document navigation.  
**R1 — low operational:** non-safety setup, approved maintenance information.  
**R2 — controlled technical:** diagnostics that can affect machine operation; stricter evidence threshold.  
**R3 — safety/energy/electrical/pressure/chemical/guarding:** only explicit approved procedure content; require warnings and potentially qualified-person confirmation.  
**R4 — prohibited autonomous control:** actions that directly command unsafe physical machinery, defeat guards/interlocks, or exceed allowed remote-control scope. Do not implement without a separate certified safety architecture.

### 13.2 Mandatory answer policy

For product-specific technical claims:

- evidence required;
- effective document version required;
- asset applicability checked;
- unsupported values are never invented;
- ambiguous units trigger clarification;
- conflicting evidence triggers abstention/escalation;
- dangerous instructions are restricted to approved content and user role;
- exact source displayed to user.

### 13.3 Prompt-injection defense

Treat uploaded documents, webpages, emails and service notes as untrusted data, not instructions.

- system/tool policies cannot be overridden by retrieved content;
- separate content and instruction channels;
- sanitize HTML/scripts;
- classify tool calls independently from retrieved text;
- allowlist connector actions;
- secrets never enter model context unless a scoped tool performs the action;
- run adversarial retrieval/prompt-injection tests in CI.

### 13.4 Multi-tenancy

- `tenant_id` present on every tenant-owned entity.
- database policies/service layer enforce scope.
- embeddings/vector searches always tenant-filtered.
- file metadata and ownership are tenant-scoped in PostgreSQL; `LocalFileBlobStore` resolves only tenant-authorized opaque file IDs. Never expose arbitrary filesystem paths.
- connector credentials isolated per tenant in secret manager.
- cross-tenant admin access is explicit, logged and time-bounded.

### 13.5 Auditability

Immutable audit events for:

- source upload/version/approval;
- knowledge edit/approval;
- prompt/model/policy version used;
- evidence retrieved;
- rules/calculators executed;
- tool calls and external mutations;
- approval/rejection;
- user-visible answer;
- escalation and final outcome.

### 13.6 Action safety

Every external mutation tool requires:

- typed schema;
- permission check;
- idempotency key;
- dry-run/preview when possible;
- explicit approval policy;
- timeout/retry policy;
- structured result;
- audit event.

---

## 14. Integrations strategy

### 14.1 Principle

Yantra AI should become the intelligence/action layer while existing systems remain systems of record. Prox publicly describes a similar approach of keeping CRM, CPQ, commerce and support systems in place. [R1]

### 14.2 Connector categories

- ERP: Odoo, ERPNext, SAP Business One, Dynamics, custom ERPs.
- CRM: Zoho, Salesforce, HubSpot, custom.
- Field service/ticketing: existing FSM/helpdesk or Yantra-native light case management.
- Messaging: WhatsApp Business platform/provider abstraction, email.
- Voice: telephony provider abstraction + STT/TTS.
- Identity: enterprise SSO later; passwordless/basic B2B auth initially.
- Commerce/payment: quote/PO/payment links when customer workflow demands it.
- Storage: Drive/SharePoint/object-store connectors later; the MVP starts with `LocalFileBlobStore`.
- IoT/telemetry: MQTT/HTTP/event gateways in advanced phase.

### 14.3 Connector contract

Each connector implements:

```text
capabilities()
authenticate()
healthcheck()
read(resource, query)
write(resource, command, idempotency_key)
subscribe(event_type)
normalize(external_payload)
```

Connector writes are never invoked directly by free-form model output; tool schema validation and policy checks sit in between.

---

## 15. Multimodal roadmap

### 15.1 Vision

Use images for:

- nameplate/model/serial recognition;
- control-panel/error display reading;
- component identification where a validated visual catalog exists;
- evidence attachment to service case;
- damage/condition classification only after building a validated dataset.

Never claim measurement precision from a photo when camera geometry/calibration does not support it.

### 15.2 Voice

Voice matters for technicians whose hands are occupied and for multilingual support.

Pipeline:

```text
Audio
 → speech-to-text
 → language detection/normalization
 → same governed specialist graph
 → text answer + optional TTS
 → transcript and cited evidence stored
```

Do not build a separate "voice brain." All channels use the same policy/reasoning core.

### 15.3 Video

Later, allow technician/user to upload a short video. Extract keyframes/audio, detect relevant states, and attach structured observations to the case. Avoid real-time computer-vision promises until validated.

### 15.4 3D exploded parts viewer

Advanced differentiator:

- link GLTF component nodes to part IDs/BOM positions;
- click a subassembly to see compatible parts, docs, service procedures and history;
- technician can highlight a component and ask context-aware questions;
- use same 3D stack as marketing but optimized for functional interaction.

---

## 16. Phase roadmap: zero → category leader → beyond public Prox scope

### Phase 0 — Validation and domain capture

**Goal:** prove the wedge before building a broad platform.

Deliverables:

- 20–30 target OEM list in one vertical.
- 10+ high-context service/parts discovery conversations.
- Obtain anonymized sample manuals/parts catalogues/tickets from willing design partners.
- Build a problem taxonomy: top repetitive questions, escalation causes, part-identification flow, service ticket flow.
- Define 30–50 golden questions from real workflows.
- Confirm what action creates economic value: faster support, part sale, reduced senior-engineer interruption, etc.

Exit gate:

- At least one design partner willing to test its own documents/data.
- Clear first use case and buyer.
- Golden question set exists.

### Phase 1 — Brand, marketing site and technical foundation

Build:

- Yantra design system.
- Marketing site with restrained 3D hero and interactive machine journey.
- Lead/pilot capture.
- Auth, tenant skeleton, RBAC.
- Postgres/pgvector schema.
- local persistent file storage behind `BlobStore`.
- document upload/versioning shell.
- baseline observability.
- CI/CD and simple local environment using supplied PostgreSQL + local filesystem.
- agent repo-control files and initial backlog.

Exit gate:

- public site is fast and responsive with 3D disabled/fallback tested;
- one-click local bootstrap;
- staging deploy;
- tenant isolation tests pass;
- no fake product behavior in demos.

### Phase 2 — Grounded Knowledge Specialist MVP

Build:

- PDF/XLSX ingestion.
- structure-preserving parsing.
- product/model/part metadata.
- hybrid retrieval.
- cited answers.
- source viewer.
- confidence/abstention.
- admin knowledge inventory.
- evaluation harness using golden questions.

Exit gate:

- high citation correctness on design-partner golden set;
- zero accepted unsupported technical values in release evaluation;
- expert can inspect why an answer was produced;
- system explicitly abstains on deliberately unanswerable tests.

### Phase 3 — Machine-aware Service Specialist

Build:

- installed asset/serial model.
- QR deep links.
- revision/configuration applicability.
- fault code/symptom/procedure entities.
- service case creation and escalation packet.
- expert feedback and resolution capture.
- risk classes and policy engine.

Exit gate:

- same question can correctly produce different answer when machine revision changes;
- escalation contains machine + evidence + attempted steps;
- risky cases are blocked/approved according to policy.

### Phase 4 — Parts and aftermarket engine

Build:

- BOM/part graph.
- supersession.
- compatibility rules.
- inventory/pricing read integration for first partner.
- parts request/quote draft.
- part-related analytics.

Exit gate:

- compatibility is deterministic and testable;
- ambiguous fitment cannot silently produce a confident part;
- part request preserves case context.

### Phase 5 — WhatsApp, technician mobile and multimodal service

Build:

- WhatsApp channel adapter.
- mobile technician workspace/PWA.
- image/nameplate/error-panel understanding.
- voice notes → structured case data.
- multilingual response pipeline.
- restart-safe conversations/workflows persisted in PostgreSQL.

Exit gate:

- same policy/evidence behavior across web and WhatsApp;
- media is tenant-isolated;
- no sensitive action can be triggered by an unauthenticated message;
- language translation does not alter technical values/units.

### Phase 6 — Product selection, configuration and quoting

Build:

- requirement interview graph.
- approved configuration rules/calculators.
- application constraints.
- quote/RFQ draft.
- CRM lead/opportunity integration.
- technical selection report.

Exit gate:

- configuration output is reproducible from rule/calculator inputs;
- missing discriminators are asked before recommendation;
- commercial send/commit remains approval-gated.

### Phase 7 — Knowledge flywheel and expert capture

Build:

- tribal-knowledge interviewer.
- resolved-case → knowledge candidate.
- conflict detector.
- coverage-gap dashboard.
- expert batch approval.
- source staleness/supersession.
- active learning driven by failure/escalation clusters.

Exit gate:

- no auto-promotion of unreviewed technical knowledge;
- measurable reduction in repeated unknown/escalation categories.

### Phase 8 — Enterprise scale and deployment platform

Build:

- SSO/SAML/OIDC as needed.
- SCIM/role mapping where enterprise demand exists.
- advanced audit exports.
- regional data controls.
- integration SDK/MCP-style tool interface.
- deployment templates and tenant configuration packs.
- rate/cost policies.
- multi-region only if justified.

Exit gate:

- documented security review.
- disaster recovery tested.
- connector failure/retry behavior verified.
- large-tenant load and isolation tests pass.

### Phase 9 — Beyond the publicly described Prox scope

These are expansion capabilities, not assumptions about Prox's private roadmap.

Build selectively after core product-market fit:

1. **IoT/telemetry context:** ingest machine events/alarms/counters and attach them to service reasoning.
2. **Proactive lifecycle:** maintenance/consumable/AMC recommendations from installed-base rules and outcomes.
3. **Condition-based service:** only where sensor data and validated engineering thresholds exist.
4. **Digital machine dossier:** immutable lifecycle timeline—commissioning, revisions, services, parts, firmware, incidents, upgrades.
5. **3D service twin:** exploded interactive model linked to parts/procedures/history.
6. **Offline field packet:** pre-cache selected manuals, parts graph, procedures and active case for poor-connectivity sites.
7. **Dealer intelligence:** compare knowledge gaps and service outcomes across dealer network without exposing inappropriate customer data.
8. **Fleet pattern detection:** identify emerging failure clusters across a tenant's installed base and route to engineering review.
9. **Engineering feedback loop:** aggregate evidence for possible service bulletin/product-quality investigation; human engineering owns the conclusion.
10. **Outcome-owning service agents:** stateful agents that follow a case until parts, technician, customer confirmation and closure are complete; introduce a dedicated workflow engine only when production complexity justifies it.

---

## 17. Autonomous engineering system — how the coding agent should work

The build process itself should be agentic, but **bounded, test-driven, stateful and auditable**. Do not tell a coding agent "build the whole thing" and let it wander.

### 17.1 Required persistent control files

The repository must contain:

```text
/agent/AGENTS.md             # operating rules and coding standards
/agent/ROADMAP.md            # phase objectives and dependency graph
/agent/BACKLOG.yaml          # machine-readable tasks
/agent/STATUS.md             # current phase, running services, known failures
/agent/DECISIONS.md          # short decision log
/agent/AUTONOMY_POLICY.md    # what agent may do without human approval
/docs/PRODUCT.md
/docs/ARCHITECTURE.md
/docs/SECURITY.md
/docs/EVALS.md
/docs/RUNBOOK.md
/docs/ADR/                   # formal architecture decisions
```

These files are part of the product. Every autonomous run reads and updates them.

### 17.2 Task graph format

Each backlog task must contain:

```yaml
id: P2-KNOW-014
phase: 2
area: knowledge
objective: Preserve page/section anchors during PDF ingestion
priority: P0
status: ready
blocked_by: [P2-KNOW-006]
acceptance:
  - Every extracted segment stores document_version_id, page and section path
  - Citation renderer can open the exact page
  - Unit and integration tests pass
verification:
  - pnpm test
  - pytest tests/knowledge
  - playwright citation.spec.ts
risk: medium
human_gate: false
```

### 17.3 The autonomous loop

```text
BOOT
 ↓
Read AGENTS + PRODUCT + ARCHITECTURE + STATUS + BACKLOG
 ↓
Validate repo health (install/build/test)
 ↓
Select highest-priority READY task whose dependencies are done
 ↓
Create implementation plan in task notes
 ↓
Implement smallest coherent vertical slice
 ↓
Run formatter/lint/typecheck/unit/integration tests
 ↓
Run task-specific acceptance tests
 ↓
If UI: run browser E2E + visual check at desktop/mobile
 ↓
If AI: run relevant golden eval subset
 ↓
Self-review diff for security, tenancy, errors, dead code
 ↓
Fix failures; repeat until green or blocked
 ↓
Update docs/ADR/schema/API if contract changed
 ↓
Mark task done with evidence
 ↓
Update STATUS and newly discovered tasks
 ↓
Commit atomically
 ↓
Select next task
```

### 17.4 Agent stop/human-gate conditions

The coding agent must stop the relevant action and request human input when:

- production secrets/credentials are required;
- a paid service or material cloud spend must be enabled;
- a destructive production migration/data deletion is required;
- legal/compliance representation is required;
- industrial safety policy is being broadened;
- external customer communication would be sent for real;
- a change materially alters product scope, tenant security model, or pricing/commercial policy;
- two requirements conflict and cannot be safely reconciled;
- production deployment approval is configured as human-gated.

The agent **does not** stop merely because an implementation detail is unspecified. It chooses the simplest reversible design consistent with this document and records the decision.

### 17.5 WIP and anti-loop rules

- One primary task at a time per agent branch.
- No speculative refactor without a backlog item tied to an observed problem.
- Maximum two repair attempts for the same strategy before reassessing the cause.
- No silent skipping of failing tests.
- Never weaken a test merely to make it pass unless the test is demonstrably incorrect; record why.
- Keep main/staging runnable after every merged task.
- Avoid generating hundreds of TODOs; prioritize at most the next 10 ready tasks.
- New dependencies require justification in DECISIONS.md.

### 17.6 Specialized subagents

The orchestrator may spawn isolated subagents with scoped context:

- **Product/UX agent:** flows, copy, states, accessibility.
- **Frontend agent:** React/Next/3D/motion.
- **Backend agent:** API/data/auth/integrations.
- **Knowledge agent:** ingestion, ontology, retrieval.
- **Agent-runtime agent:** graphs, tools, policies.
- **Evaluation agent:** datasets, regression gates.
- **QA/security agent:** adversarial cases, tenant boundaries, permission tests.
- **DevOps agent:** environments, CI, observability.
- **Research agent:** verifies external APIs/docs before implementation decisions.

Subagents propose changes; the orchestrator integrates and verifies the full system.

### 17.7 Autonomous product-improvement loop

After each phase is operational, the engineering agent can generate improvement tasks from telemetry, but cannot change truth/safety policy automatically.

```text
Production telemetry + user feedback + failed evals
  → cluster failure modes
  → quantify frequency/severity
  → propose backlog tasks
  → reproduce failure with test/eval
  → implement fix
  → regression suite
  → staged release
  → compare outcome
```

The rule is: **no improvement without a reproducible signal and a verification method.**

---

## 18. Master prompt for the autonomous coding agent

Place the following intent in `/agent/AGENTS.md` and adapt only tool-specific syntax:

```text
You are the principal product engineer and execution orchestrator for Yantra AI.

Your source of truth is, in order:
1. safety/security constraints in the master specification;
2. PRODUCT.md and ARCHITECTURE.md;
3. accepted ADRs;
4. ROADMAP.md;
5. BACKLOG.yaml task acceptance criteria;
6. STATUS.md current repository state.

Your job is not to wait for a human to assign every task. Repeatedly select the highest-priority unblocked backlog task, implement the smallest complete vertical slice, verify it, update project state, and continue.

Before coding:
- inspect existing code and contracts;
- confirm the task is not already solved;
- identify dependencies and tenant/security implications;
- prefer existing project patterns over adding libraries.

For every task:
- write/identify acceptance tests first;
- implement production code, not mock behavior, except where a clearly labeled fixture/demo adapter is required;
- run format, lint, typecheck, unit, integration, and relevant E2E/evals;
- inspect UI changes at mobile and desktop widths;
- update docs and ADRs when architecture/contracts change;
- keep secrets out of source;
- preserve tenant isolation and auditability;
- make external writes idempotent;
- never allow an LLM to bypass a deterministic safety/permission/compatibility rule.

When blocked by missing credentials or a human-gate condition, complete all work that does not require the secret, provide a precise environment-variable/permission checklist, mark only the blocked step, and continue other independent tasks.

Do not endlessly refactor. Do not reduce tests to achieve green status. Do not create features outside the current phase unless required by an architectural dependency. Record material decisions. Keep the repository runnable.

At the end of each autonomous cycle, update STATUS.md with:
- completed task IDs;
- verification evidence;
- current services/URLs;
- known failures;
- next ready tasks;
- required human inputs, if any.

Continue until the current phase exit criteria are satisfied or every remaining task is blocked by a defined human gate.
```

---

## 19. Testing and evaluation strategy

### 19.1 Conventional software tests

- Unit tests for pure logic, permissions, compatibility predicates, parsing helpers.
- Integration tests against PostgreSQL plus the local filesystem storage adapter; no Redis/object-store dependency in the MVP test suite.
- API contract tests.
- Connector contract tests with recorded/sandbox fixtures.
- Playwright E2E for primary user journeys.
- Accessibility checks.
- Tenant-isolation tests designed to attempt cross-tenant access.
- Migration tests against representative database snapshots.

### 19.2 AI golden dataset

Create evaluation records with:

- tenant fixture;
- actor role;
- asset/model/revision context;
- user query;
- approved evidence set;
- expected answer facts;
- forbidden facts/actions;
- expected citations;
- expected tool/action;
- acceptable abstention/escalation behavior.

Categories:

- exact fault code;
- ambiguous fault;
- revision-dependent answer;
- superseded part;
- incompatible part trap;
- conflicting manual versions;
- unsupported question;
- malicious prompt injection in document;
- unit ambiguity;
- multilingual technical query;
- unsafe requested action;
- quote/service action with/without permission.

### 19.3 Release gates

No AI change ships merely because a few demos look good.

Require:

- regression dataset meets configured thresholds;
- no new high-severity safety failures;
- citation precision does not regress beyond tolerance;
- tenant isolation/security tests pass;
- latency/cost within budget;
- tool schemas validated;
- manually review a sampled trace for high-risk graph changes.

### 19.4 Shadow and staged rollout

For major changes:

1. run new model/prompt/retrieval path in shadow mode;
2. compare to production outcome offline;
3. enable for internal users;
4. enable small tenant cohort;
5. expand after metrics stabilize.

---

## 20. Observability and debugging

Every request gets a correlation ID across web/API/workflow/agent/tools.

Collect:

- structured application logs;
- OpenTelemetry traces;
- database/query metrics;
- Postgres job/workflow metrics;
- per-agent-step timing;
- retrieved document/segment IDs;
- prompt/template version;
- model and token usage;
- tool calls/results;
- error class/retry count;
- human approval wait time;
- user feedback/outcome.

Provide an internal **Agent Run Inspector** that shows the graph timeline and evidence, but redact secrets and enforce tenant scope.

---

## 21. DevOps and environments

### 21.1 Environments

**Local**
- `DATABASE_URL` points to the developer-supplied PostgreSQL instance.
- `LOCAL_BLOB_ROOT=./data/uploads`.
- application/API process runs the lightweight Postgres job runner; optional AI worker can run as a second process only when needed.
- seed tenant and synthetic machine/manual fixtures.
- Docker is optional convenience only; the project must not require Redis, S3-compatible storage or Temporal to boot.

**Staging / demo before clients**
- one small application deployment + managed PostgreSQL.
- persistent mounted disk for `BlobStore` if uploads are enabled.
- synthetic/anonymized demo data.
- migrations and evals run before deployment.

**After first client**
- revisit the Scale-Later Agent Dictionary in section 8.8.
- move local blobs to object storage only if its trigger is met.
- add dedicated queue/cache/workflow infrastructure only from measured need.
- add production backup, secret management, network controls and centralized telemetry according to the client's security requirements.

### 21.2 CI pipeline

On pull request:

```text
install
→ format check
→ lint
→ typecheck
→ unit tests
→ DB migration validation
→ integration tests
→ AI eval smoke set
→ build
→ Playwright critical path
→ dependency/security checks
```

Main branch:

- build immutable images/artifacts;
- deploy staging;
- run migrations safely;
- full targeted eval suite;
- smoke tests;
- production promotion via configured gate.

### 21.3 Database migration rule

Use expand/migrate/contract for risky schema changes. Do not combine destructive changes and code assumptions in one uncontrolled deploy.

---

## 22. API outline

Representative REST resources:

```text
POST   /v1/tenants/:tenantId/documents
POST   /v1/documents/:id/versions
POST   /v1/document-versions/:id/ingest
GET    /v1/products
GET    /v1/products/:id
GET    /v1/assets/by-serial/:serial
POST   /v1/assets/:id/assistant/messages
POST   /v1/service-cases
PATCH  /v1/service-cases/:id
POST   /v1/parts/resolve
POST   /v1/quotes/draft
POST   /v1/knowledge/assertions/:id/approve
POST   /v1/agent-runs/:id/approve-action
GET    /v1/agent-runs/:id
GET    /v1/evaluations/runs/:id
```

Use opaque public IDs; never expose sequential IDs as access control.

---

## 23. Initial critical user journeys

### Journey A — customer QR troubleshooting

1. User scans QR on machine.
2. Deep link resolves tenant + asset token.
3. Show machine identity and safe public/customer context.
4. User enters symptom/error; optionally photo/voice.
5. Specialist resolves risk and evidence.
6. Answer shows source and approved next step.
7. If unresolved, create service case with transcript/evidence.
8. Customer receives reference and status path.

Acceptance: user never has to retype model/serial after QR resolution.

### Journey B — technician part identification

1. Technician opens active case.
2. Asset configuration preloaded.
3. Searches symptom or uploads component photo.
4. Parts agent resolves candidates.
5. Deterministic compatibility check.
6. Show part number, supersession, source, stock if integrated.
7. Add to parts request.
8. Attach to case.

Acceptance: no part marked "compatible" without rule/source evidence.

### Journey C — expert escalation

1. Agent cannot safely resolve.
2. Create concise context packet:
   - machine/serial/revision;
   - issue;
   - evidence consulted;
   - user-provided readings/photos;
   - steps already performed;
   - exact unresolved question.
3. Notify correct expert/team.
4. Expert responds.
5. User gets response.
6. Resolution becomes knowledge candidate.

Acceptance: expert does not need to reconstruct case from chat history.

### Journey D — admin knowledge approval

1. New candidate from document/service case/interview.
2. Show proposition + applicability + supporting evidence.
3. Expert edits/approves/rejects.
4. Versioned approved assertion becomes retrievable.
5. Regression evals affected by assertion run automatically.

---

## 24. Initial database/environment checklist for the user

The autonomous agent can build the pre-client MVP without production infrastructure credentials. Ask the user only for what is genuinely required now.

Required for a real connected MVP:

```text
DATABASE_URL=postgresql://...
MODEL_PROVIDER=...
MODEL_API_KEY=...
APP_SECRET=...
LOCAL_BLOB_ROOT=./data/uploads
```

Optional only when the chosen model setup requires separate credentials:

```text
EMBEDDING_PROVIDER_API_KEY=...
VISION_PROVIDER_API_KEY=...
SPEECH_PROVIDER_API_KEY=...
```

Feature credentials are requested only when that feature is actually being enabled:

```text
WHATSAPP_*=...
ERP_*=...
CRM_*=...
TELEPHONY_*=...
```

**Do not request Redis, S3/object-storage, Temporal, Kafka, Kubernetes, or other scale infrastructure credentials during the pre-client MVP.** Those are governed by the Scale-Later Agent Dictionary in section 8.8.

Never put real credentials in prompts, documentation, git, screenshots, or fixtures. Use `.env.example` with placeholders.

## 25. Repo bootstrap order

The autonomous coding agent should execute this dependency order:

1. Monorepo + package manager + lint/typecheck/test conventions.
2. Shared config/contracts/errors/logging.
3. PostgreSQL connection, migration tooling, local BlobStore directory, and environment validation.
4. Database schema + migration system + seed tenant.
5. Auth/RBAC/tenant middleware.
6. Base Next.js design system and shell.
7. Marketing site core layout and 3D lazy-load boundary.
8. Document upload path using LocalFileBlobStore.
9. PostgreSQL-backed ingestion job runner + document version state machine.
10. Retrieval service + source viewer.
11. Specialist graph + citations + abstention.
12. Golden eval harness.
13. Asset/serial/QR context.
14. Service cases/escalation.
15. Parts graph/compatibility.
16. Channels/integrations.
17. Advanced agents.

Do not jump to voice, predictive maintenance, or complex 3D parts interaction before the grounded-answer and asset-context gates pass.

---

## 26. Definition of done

A task is not done because code exists.

A task is done when:

- acceptance criteria are satisfied;
- tests are added/updated and passing;
- error/empty/loading/permission states exist;
- tenant boundary is considered;
- accessibility considered for UI;
- observability exists for operational paths;
- documentation/contracts updated;
- no placeholder/fake behavior is exposed as production functionality;
- relevant AI evals pass;
- migrations are reversible or have a documented recovery path;
- screenshots/browser checks completed for meaningful UI changes;
- status/backlog updated.

---

## 27. Pilot deployment playbook

### 27.1 Pilot scope

One OEM, one product family or 3–10 representative models, one service team, one controlled user cohort.

Ingest:

- current service/manual versions;
- parts catalogue/fitment information;
- 20–100 historical cases if permitted;
- model/revision/serial fixtures;
- approved service procedures.

### 27.2 Baseline before launch

Measure:

- weekly support volume;
- top question categories;
- first-response and resolution time;
- senior engineer interruptions;
- common escalations;
- spare-parts request turnaround;
- wrong-part incidents if tracked.

### 27.3 Rollout

1. Internal service team only.
2. Correct weak knowledge and build golden set.
3. Dealer/internal technician cohort.
4. Customer-facing low-risk questions.
5. Controlled parts/service actions.

### 27.4 Pilot success evidence

Use measured before/after data. Do not manufacture ROI. A successful pilot should demonstrate at least one repeatable operational improvement and a credible path to either cost reduction, capacity increase, customer experience improvement, or aftermarket revenue.

---

## 28. Commercial packaging hypothesis

Treat pricing below as a hypothesis to validate, not a fact.

Potential model:

- base platform fee per manufacturer;
- installed-asset or active-user band;
- AI/media usage allowance;
- paid modules: parts, sales/configuration, WhatsApp/voice, integrations, analytics;
- onboarding/data preparation fee for difficult legacy knowledge;
- enterprise security/SSO/support tier.

Avoid pricing per message as the primary value story. The buyer should understand price against service capacity, engineering time, revenue, or installed-base value.

---

## 29. Architecture decisions to record immediately

Create ADRs for:

- ADR-001: modular monolith + workers vs microservices.
- ADR-002: Postgres + pgvector as primary knowledge/relational store.
- ADR-003: PostgreSQL-backed workflow/job state for MVP; graph runtime for bounded reasoning; dedicated workflow engine deferred until trigger.
- ADR-004: multi-tenant isolation strategy.
- ADR-005: immutable source versions and citation anchors.
- ADR-006: deterministic compatibility/calculation layer.
- ADR-007: provider-neutral model gateway.
- ADR-008: `BlobStore` abstraction with local persistent filesystem implementation for MVP; object storage deferred until trigger.
- ADR-009: action approval/idempotency contract.
- ADR-010: risk classes and abstention policy.

---

## 30. First 90 technical backlog outcomes

The companion `yantra_ai_initial_backlog.yaml` is the machine-readable task graph. At a milestone level, the first sequence should produce:

- a production-quality brand system and marketing site;
- a reproducible local environment;
- secure tenant/auth foundation;
- versioned document ingestion;
- source-aware hybrid retrieval;
- grounded assistant with citations and abstention;
- evaluation harness;
- machine serial/QR context;
- service case escalation;
- parts compatibility foundation;
- operational tracing and audit logs.

Only after those are stable should the agent unlock WhatsApp/voice/vision and commercial actions.

---

## 31. Product copy starter set

### Home hero

**Your best service engineer, available on every machine.**

Turn manuals, parts data, service history and expert rules into a governed product specialist for customers, dealers and technicians.

### Problem statement

**The answer usually exists. Finding the right one is the expensive part.**

Manuals know one piece. ERP knows another. Service history lives somewhere else. And the final answer often depends on one experienced engineer. Yantra connects that knowledge to the exact machine in front of the user.

### Governance section

**Answers you can inspect. Actions you can control.**

Yantra grounds technical responses in manufacturer-approved sources, shows the evidence, applies explicit product rules, and escalates when certainty is not high enough.

### Aftermarket section

**Support should not end with an answer.**

Move from diagnosis to the correct part, service request, AMC, upgrade or replacement path without losing context.

---

## 32. Anti-patterns the engineering agent must reject

- "Just put the entire manual into a vector database."
- "Let the LLM decide whether a part fits."
- "We'll add tenant security later."
- "The model can call any connector tool it wants."
- "We don't need evaluation until customers use it."
- "Store only the final answer, not the trace/evidence."
- "Auto-learn every technician message."
- "Use one giant system prompt for all roles and risk levels."
- "Rebuild ERP/FSM before integrating with it."
- "Add Redis/S3/Temporal/Kafka/Kubernetes/microservices before a client or measured trigger requires them."
- "Add 3D because it looks impressive even if it slows the page."
- "Show a confident answer because abstention feels bad."

---

## 33. Reference architecture diagram

```text
                           ┌─────────────────────────────────────┐
                           │             CHANNELS                │
                           │ Web • Console • QR • WhatsApp • Voice│
                           └─────────────────┬───────────────────┘
                                             │
                                    API / Identity / RBAC
                                             │
                         ┌───────────────────┴───────────────────┐
                         │          PRODUCT SPECIALIST           │
                         │  intent • asset • evidence • policy   │
                         └──────┬────────────┬────────────┬──────┘
                                │            │            │
                        ┌───────▼────┐ ┌────▼─────┐ ┌────▼──────┐
                        │ Knowledge  │ │ Rules /  │ │  Actions  │
                        │ Retrieval  │ │ Calculators│ │ / Tools   │
                        └───────┬────┘ └────┬─────┘ └────┬──────┘
                                │            │            │
             ┌──────────────────▼────────────▼────────────▼─────────────────┐
             │ PostgreSQL + pgvector • Local BlobStore • Audit/Traces     │
             └──────────────────┬───────────────────────────────────────────┘
                                │
                 ┌──────────────▼────────────────┐
                 │ PostgreSQL Workflow State   │
                 │ jobs • approvals • retries   │
                 └──────────────┬────────────────┘
                                │
        ┌───────────────────────▼────────────────────────┐
        │ ERP • CRM • FSM • Parts • Messaging • IoT     │
        └────────────────────────────────────────────────┘
```

---

## 34. Launch discipline

The build agent should optimize for a sequence of demonstrable, testable truths:

**Truth 1:** we can ingest the manufacturer's real documents correctly.  
**Truth 2:** we can answer real support questions with exact evidence.  
**Truth 3:** we can understand the exact installed machine context.  
**Truth 4:** we can safely identify parts and create useful service actions.  
**Truth 5:** we can integrate into the channels/system the manufacturer already uses.  
**Truth 6:** measured outcomes improve.  
**Truth 7:** the knowledge/action flywheel compounds without sacrificing governance.

Every new feature should strengthen one of these truths. Features that do not should remain out of scope.

---

## 35. References

**[R1] Y Combinator — Prox: AI product specialists for equipment manufacturers.** Public description includes approved product knowledge, expert rules, calculators, connected systems, product discovery/configuration, quote preparation, installation, troubleshooting, parts, service, replacement and upgrade paths.  
https://www.ycombinator.com/companies/prox

**[R2] LangChain Docs — Thinking in LangGraph.** Describes explicit nodes/state, retries, checkpointing and human-in-the-loop interrupts.  
https://docs.langchain.com/oss/javascript/langgraph/thinking-in-langgraph

**[R3] Temporal Platform Documentation — scale-later reference only.** Describes durable execution and resuming workflow state after failures.  
https://docs.temporal.io/

**[R4] Temporal — AI engineering / durable agents — scale-later reference only.** Discusses durable execution for long-running agents and failure recovery.  
https://go.temporal.io/platform-hub/ai-engineering

**[R5] Next.js Documentation.** Official App Router and React/full-stack documentation.  
https://nextjs.org/docs

**[R6] GSAP ScrollTrigger Documentation.** Scroll-linked scrub, pin, snap and trigger animation capabilities.  
https://gsap.com/docs/v3/Plugins/ScrollTrigger/

**[R7] Three.js WebGPU capability documentation.** Provides WebGPU capability detection; use with fallback.  
https://threejs.org/docs/pages/WebGPU.html

**[R8] NestJS Queue Documentation — scale-later reference only.** BullMQ integration for Redis-backed background queues.  
https://docs.nestjs.com/techniques/queues

**[R9] pgvector.** Vector similarity search extension for Postgres; supports exact/approximate search and HNSW/IVFFlat.  
https://github.com/pgvector/pgvector

**[R10] Redis Streams Documentation — scale-later reference only.** Ordered append-only streams, consumer groups, replay and acknowledgements.  
https://redis.io/docs/latest/develop/data-types/streams/

---

## 36. Final instruction to the build agent

Build Yantra AI as a trustworthy industrial product, not an AI demo. Start narrow, make answers inspectable, make actions safe, make machine context explicit, and keep every phase measurable. Do not wait for the founder to feed you individual implementation tickets. Use the backlog graph, acceptance criteria, verification gates, and repository state to continuously choose the next valid task. Stop only for defined human gates or a true unresolved conflict.

---

## 37. Companion agent artifacts

- `YANTRA_AI_AGENT_MASTER_SPEC_LEAN_MVP.md` — canonical Markdown specification for direct agent context.
- `yantra_ai_initial_backlog_LEAN_MVP.yaml` — machine-readable dependency graph and autonomous backlog.

Use these filenames as the canonical lean-MVP artifacts until a validated client/scale trigger justifies infrastructure expansion.
