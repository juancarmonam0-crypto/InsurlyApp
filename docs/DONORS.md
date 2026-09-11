# INSURLY OPEN-SOURCE DONOR REGISTRY & HARVEST AUDIT

## Overview
Insurly deliberately utilizes selected public open-source projects as architectural "donors"—sources of proven patterns, UX ergonomics, data structures, and isolated implementation techniques. 

### Core Architectural Mandate
> **Donor code is input. Insurly architecture remains the sole authority.**
> Insurly does not copy code blindly or replace its domain integrity with donor architectures. All harvested patterns are adapted into Insurly's deterministic TypeScript/React/Supabase foundational model.

---

## Donor Registry Summary

| Donor Repository | Role / Type | License | Status | Last Audit Date |
| :--- | :--- | :--- | :--- | :--- |
| **dabit3/openform** | Form Player & Wizard UX | MIT | **PARTIALLY HARVESTED** | 2026-09-11 |
| **wtygibbs/formflow** | ACORD & Doc Lifecycle | MIT | **PARTIALLY HARVESTED** | 2026-09-11 |
| **sensible-hq/sensible-configuration-library** | Insurance Config & ACORD Mapping | MIT / Apache-2.0 | **PARTIALLY HARVESTED** | 2026-09-11 |

---

## Donor 1: dabit3/openform
* **Repository**: `https://github.com/dabit3/openform`
* **Purpose**: Open-source Typeform alternative featuring one-question-at-a-time form player, question renderer registry, keyboard navigation, and client-side form rendering.
* **License**: MIT
* **Status**: `PARTIALLY HARVESTED`
* **Last Audit Date**: 2026-09-11

### Useful Patterns Audited
1. **Question Renderer Registry**: Modular mapping of question input types (`text`, `number`, `currency`, `date`, `boolean`, `select`) to dedicated, isolated UI renderer components.
2. **Keyboard Navigation Ergonomics**: Pressing `Enter` to advance when valid, `Shift+Enter` for multiline, and arrow/tab key support for smooth navigation.
3. **Deterministic Focus Management**: Auto-focusing inputs on question transition to minimize friction on both desktop and mobile.
4. **Per-Question Real-Time Validation**: Evaluating constraint rules (min, max, required, pattern) before advancing.

### What Insurly Absorbed / Adapted (Harvest #1)
- Adapted modular `QuestionRendererRegistry` in `src/services/wizard/questionRendererRegistry.tsx`.
- Implemented keyboard listeners (`Enter` to submit/advance) and deterministic focus autofocusing in `SmartWizardPage`.
- Added per-question inline validation engine (`src/services/wizard/wizardValidation.ts`) checking `required`, `min`, `max`, and `pattern`.

### What Insurly Already Superseded
- Insurly's **Dynamic Smart Wizard Engine** already supersedes OpenForm's static form definitions: Insurly calculates required questions downstream from `ApplicationDefinition` and existing profile facts, dynamically skipping questions answered by documents.

### Rejected Patterns
- Generic schema-less question JSON trees that bypass canonical typing.
- Cloudflare R2 / AWS S3 direct client uploads (Insurly uses private Supabase Storage + server-side Gemini processing).
- Custom database schemas or analytics layers from OpenForm.

---

## Donor 2: wtygibbs/formflow
* **Repository**: `https://github.com/wtygibbs/formflow`
* **Purpose**: Insurance document intake and processing workflow system focusing on ACORD form ingestion and field extraction.
* **License**: MIT
* **Status**: `PARTIALLY HARVESTED`
* **Last Audit Date**: 2026-09-11

### Useful Patterns Audited
1. **Explicit Document Lifecycle States**: Structured progression: `uploaded` → `classifying` → `extracting` / `processing` → `review_required` / `processed` → `failed`.
2. **Fact-Level Evidence Review**: Presenting extracted candidate facts with confidence scores, source page, raw value vs normalized value, and validation status.
3. **Document Error Handling & Retry UX**: Operational retry capabilities for documents that fail ingestion or extraction.
4. **Separation of Document Extraction vs Profile Truth**: Treating extracted facts as candidate evidence requiring provenance rather than blindly updating system of record.

### What Insurly Absorbed / Adapted (Harvest #1)
- Adapted fact-level inspection drawer/modal in Document Intake allowing users to inspect exact candidate facts, raw values, confidence percentages, and page references.
- Implemented one-click Document Retry UX for failed processing states.
- Enhanced confidence presentation with high/medium/low visual tiers.

### What Insurly Already Superseded
- Insurly's **3-Tier Conflict & Provenance Engine** is significantly more advanced than FormFlow's simple field table, with material vs non-material classifications, immutable provenance chains, and broker exception resolution.

### Rejected Patterns
- .NET / C# backend dependencies.
- SQL Server and Azure Blob Storage storage providers.
- Monolithic monolithic extraction pipelines without deterministic fallback.

---

## Donor 3: sensible-hq/sensible-configuration-library
* **Repository**: `https://github.com/sensible-hq/sensible-configuration-library`
* **Purpose**: Open-source repository of configuration templates and schemas for extracting structured fields from real-world insurance forms (including ACORD 125, 126, dec pages, and loss runs across multiple editions).
* **License**: MIT / Apache-2.0
* **Status**: `PARTIALLY HARVESTED`
* **Last Audit Date**: 2026-09-11

### Useful Patterns Audited
1. **Form Edition & Version Metadata**: Structuring ACORD mappings by explicit edition timestamps (e.g., ACORD 125 `2016-03` vs `2014-12`).
2. **Adapter Registry Pattern**: Decoupling canonical profile data from specific form output layouts via versioned adapters.
3. **Audit Trail Verification**: Storing the exact adapter identifier and version within immutable snapshot records.

### What Insurly Absorbed / Adapted (Harvest #1)
- Created `ApplicationAdapterRegistry` (`src/adapters/applications/registry.ts`) supporting versioned ACORD adapters (`acord-125:2016-03` and `acord-125:2014-12`).
- Integrated `adapterId` and `adapterVersion` into `ApplicationSnapshotPayload` to guarantee immutable provenance of carrier exports.
- Provided fallback and version validation ensuring unsupported form requests fail safely without corrupting application state.

### What Insurly Already Superseded
- Insurly's canonical registry (`src/domain/canonicalRegistry.ts`) maps across arbitrary lines of business (GL, Auto, Property, Workers Comp) with bidirectional type validation and normalization.

### Rejected Patterns
- Redistribution of proprietary or copyrighted ACORD visual form layouts/PDF binaries.
- Overly complex DSL configuration interpreters.

---

## Harvest Matrix Summary

| Donor | Capability | Insurly Prior State | Value | Risk | Decision | Implementation |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **OpenForm** | Question Renderer Registry | Monolithic switch block in page | High | Low | **ADAPT** | `src/services/wizard/questionRendererRegistry.tsx` |
| **OpenForm** | Enter to Submit / Keyboard Nav | Manual click required | Medium | Low | **ADAPT** | Keyboard event listener in `SmartWizardPage` |
| **OpenForm** | Per-Question Inline Validation | Minimal validation | High | Low | **ADAPT** | `src/services/wizard/wizardValidation.ts` |
| **FormFlow** | Fact-Level Candidate Review UX | Basic table summary | High | Low | **ADAPT** | Candidate Fact Inspector in `DocumentIntakePage` |
| **FormFlow** | Failed Document Retry UX | None (required re-upload) | High | Low | **ADAPT** | Retry action & state reset in `DocumentIntakePage` |
| **FormFlow** | .NET / Azure Backend | N/A (Insurly is TS/Supabase) | None | High | **REJECT** | None |
| **Sensible** | Versioned ACORD Adapter Registry | Single hardcoded ACORD 125 | High | Low | **ADAPT** | `src/adapters/applications/registry.ts` |
| **Sensible** | Snapshot Adapter Version Stamping | Only definition version saved | High | Low | **ADAPT** | `snapshotService.ts` updated with adapter stamps |
