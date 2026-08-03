# Graph Report - c:/Users/luis_/.gemini/antigravity/scratch/dashboard-kpis  (2026-08-03)

## Corpus Check
- 140 files · ~171,137 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 784 nodes · 1484 edges · 53 communities (43 shown, 10 thin omitted)
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 77 edges (avg confidence: 0.81)
- Token cost: 278,000 input · 13,585 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Chatbot Rules & Data Helpers|Chatbot Rules & Data Helpers]]
- [[_COMMUNITY_Designer Perf. App Shell|Designer Perf. App Shell]]
- [[_COMMUNITY_Project Chatbot UI|Project Chatbot UI]]
- [[_COMMUNITY_Gemini API Backend & Auth|Gemini API Backend & Auth]]
- [[_COMMUNITY_App Shell & Completed Archive|App Shell & Completed Archive]]
- [[_COMMUNITY_Build Dependencies|Build Dependencies]]
- [[_COMMUNITY_i18n & App Bootstrap|i18n & App Bootstrap]]
- [[_COMMUNITY_Theming & i18n Workstream|Theming & i18n Workstream]]
- [[_COMMUNITY_Archive RTDB Rules Fix|Archive RTDB Rules Fix]]
- [[_COMMUNITY_PDF & IP Document Generation|PDF & IP Document Generation]]
- [[_COMMUNITY_KPI Calculation Engine|KPI Calculation Engine]]
- [[_COMMUNITY_Designer Scoring System Spec|Designer Scoring System Spec]]
- [[_COMMUNITY_Error Boundaries|Error Boundaries]]
- [[_COMMUNITY_Phase 1 Form Tests|Phase 1 Form Tests]]
- [[_COMMUNITY_Phase 1 Form UI|Phase 1 Form UI]]
- [[_COMMUNITY_Data Architecture & Caching|Data Architecture & Caching]]
- [[_COMMUNITY_Phase 1 Score Calculator|Phase 1 Score Calculator]]
- [[_COMMUNITY_Designer Perf. UI Features|Designer Perf. UI Features]]
- [[_COMMUNITY_n8n Sheets Sync Workflow|n8n Sheets Sync Workflow]]
- [[_COMMUNITY_Score Calculator Tests|Score Calculator Tests]]
- [[_COMMUNITY_CSS Theme Variable Migration|CSS Theme Variable Migration]]
- [[_COMMUNITY_Project Details Modal|Project Details Modal]]
- [[_COMMUNITY_Dashboard Views & Alerts|Dashboard Views & Alerts]]
- [[_COMMUNITY_Logbook Module|Logbook Module]]
- [[_COMMUNITY_Completed Projects Modal|Completed Projects Modal]]
- [[_COMMUNITY_Engineering Checklist|Engineering Checklist]]
- [[_COMMUNITY_Desktop & PWA Packaging|Desktop & PWA Packaging]]
- [[_COMMUNITY_Project Switch Tests|Project Switch Tests]]
- [[_COMMUNITY_React Toolchain Plugins|React Toolchain Plugins]]
- [[_COMMUNITY_Sheets Integration Options|Sheets Integration Options]]
- [[_COMMUNITY_History Recovery Script|History Recovery Script]]
- [[_COMMUNITY_Designer Assignment Fixes|Designer Assignment Fixes]]
- [[_COMMUNITY_Scroll Shadow Task|Scroll Shadow Task]]
- [[_COMMUNITY_Translation Invariants|Translation Invariants]]
- [[_COMMUNITY_App Favicon|App Favicon]]
- [[_COMMUNITY_Icon Sprite Sheet|Icon Sprite Sheet]]
- [[_COMMUNITY_JL Closets Logo|JL Closets Logo]]
- [[_COMMUNITY_PWA Icon 192|PWA Icon 192]]
- [[_COMMUNITY_PWA Icon 512|PWA Icon 512]]
- [[_COMMUNITY_Hero Banner Image|Hero Banner Image]]
- [[_COMMUNITY_Translation Strings|Translation Strings]]

## God Nodes (most connected - your core abstractions)
1. `shortProjectName()` - 30 edges
2. `MyProjectsView()` - 28 edges
3. `ProjectChatbot()` - 23 edges
4. `formatDisplayDate()` - 20 edges
5. `post()` - 15 edges
6. `DashboardView()` - 15 edges
7. `App()` - 14 edges
8. `buildLLMContext()` - 14 edges
9. `PipelineView()` - 14 edges
10. `useKpi()` - 13 edges

## Surprising Connections (you probably didn't know these)
- `calculatePhase2FromNotes()` --semantically_similar_to--> `calculatePhase2Score (legacy IFR formula, removed)`  [INFERRED] [semantically similar]
  src/designer-performance/utils/redFlags.ts → docs/superpowers/plans/2026-07-28-designer-red-flags-phase2.md
- `ProjectDetailsModal()` --semantically_similar_to--> `STATUS_LABEL_KEYS / statusLabel helper`  [INFERRED] [semantically similar]
  src/designer-performance/components/ProjectDetailsModal.tsx → .superpowers/sdd/task-6-brief.md
- `sanitizeFirebaseKey()` --semantically_similar_to--> `Finding #2: Google Sheets formula injection via USER_ENTERED`  [INFERRED] [semantically similar]
  src/utils/firebaseKeys.js → auditoria_dashboard_kpis.md
- `buildLLMContext()` --semantically_similar_to--> `buildProjectContext (superseded)`  [INFERRED] [semantically similar]
  src/utils/llmChat.js → docs/superpowers/specs/2026-07-07-chatbot-gemini-first-design.md
- `Option A: Google Apps Script Webhook` --semantically_similar_to--> `n8n Webhook Workflow (App to Google Sheets)`  [INFERRED] [semantically similar]
  FUTURE_ROADMAP.md → N8N_SETUP.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Archive RTDB permission fix flow (paths -> rules -> verification)** — src_utils_archivestore_archive_paths, src_utils_archivecoordinator_lock_path, database_rules_archive_rule_block, database_rules_archive_lock_rule_block, scripts_verify_archive_rules_evalrule, _superpowers_sdd_task_1_brief_archive_path_list [EXTRACTED 1.00]
- **Designer Perf. i18n-wired user-facing surfaces** — src_designer_performance_components_sidebar_sidebar, src_designer_performance_views_dashboardview_dashboardview, src_designer_performance_views_projectsview_projectsview, src_designer_performance_components_projectdetailsmodal_projectdetailsmodal, src_utils_translations_designerperf_keys, src_utils_languagecontext_uselanguage [EXTRACTED 1.00]
- **Theme-aware CSS variable system (dark/light flip)** — src_index_overlay_variables, src_index_light_theme_override_block, src_context_themecontext_themecontext, src_index_h_scroll_shadow, _superpowers_sdd_task_5_brief_sed_bulk_migration [INFERRED 0.85]
- **App→Sheets sync flow (client helper → serverless endpoint → column mapping → Sheet)** — src_utils_sheetsync_sendstageevent, src_utils_sheetsync_post, api_sync_handler, api_lib_syncmapping_mapeventtocells, n8n_workflow_blueprint_copy_testing_column_map, sheets_sync_setup_server_only_env_vars [EXTRACTED 1.00]
- **Phase 2 red-flag scoring flow (note creation → resolution → penalty calc → frozen breakdown)** — src_views_myprojectsview_handleaddnote, src_views_myprojectsview_handleresolvenote, src_utils_notepermissions_canmanagedesignernotes, src_designer_performance_context_kpicontext_getprojectnotes, src_designer_performance_utils_redflags_calculatephase2fromnotes, src_designer_performance_views_phase2form_handlesubmit, designer_performance_sistema_de_puntajes_phase2_ifr [EXTRACTED 1.00]
- **Approved-user authorization boundary across RTDB rules and serverless endpoints** — api_lib_requireapproveduser_requireapproveduser, api_lib_verifyauth_requireauth, database_rules_approved_status_gate, database_rules_archive_rule_block, database_rules_other_catch_all_deny, auditoria_dashboard_kpis_unauthenticated_api_endpoints [INFERRED 0.85]
- **Data Flow Pipeline: Sheets to Cache to App to Firebase to Views** — contexto_y_flujo_google_sheets_source, dbcache_js, app_jsx, contexto_y_flujo_firebase_rtdb, dashboardview_jsx [EXTRACTED 1.00]
- **n8n Event Payload Types Driving Webhook Workflow** — n8n_setup_event_on_hold, n8n_setup_event_release_hold, n8n_setup_event_stage_update, n8n_setup_event_qa_checklist, n8n_setup_webhook_workflow [EXTRACTED 1.00]
- **Intake Workflow Overhaul: Dropdown, Autofill, To-Review Status** — implementation_plan_designers_review_kpi_dropdown_intake_selection, implementation_plan_designers_review_kpi_smart_autofill, implementation_plan_designers_review_kpi_to_review_status, implementation_plan_designers_review_kpi_unlocked_update_mode, phase1form_jsx [EXTRACTED 1.00]

## Communities (53 total, 10 thin omitted)

### Community 0 - "Chatbot Rules & Data Helpers"
Cohesion: 0.06
Nodes (50): Deterministic carve-out: writes and unambiguous entity lookups bypass the LLM, Client is the single source of truth for STATUS text (dumb endpoint), Preserve the 9 n8nService helper signatures to avoid rewriting views, Per-note caps all equal 12 open days to preserve the traffic-light hierarchy, processInput (chatbot decision pipeline), notePenalty(), note(), cleanupChecklistData() (+42 more)

### Community 1 - "Designer Perf. App Shell"
Cohesion: 0.05
Nodes (50): project_designers/{so} RTDB assignment source, Concurrent set() overwrite risk on project_notes/{so} array, Current urgency applies to the whole period (no history slicing), No retroactive recalculation of already-Completed projects, AppContent(), Badge(), BadgeProps, BadgeTier (+42 more)

### Community 2 - "Project Chatbot UI"
Cohesion: 0.08
Nodes (51): Local rules demoted from answer-generators to context data sources, Spec — Chatbot Gemini-first con contexto enriquecido y memoria conversacional, buildContactAnswer(), buildEntityAnswer(), buildInstallAnswer(), buildOnHoldAnswer(), buildWelcomeMessage(), FormattedMessage() (+43 more)

### Community 3 - "Gemini API Backend & Auth"
Cohesion: 0.06
Nodes (43): handler(), fetchGeminiWithRetry(), RETRYABLE_STATUSES, sleep(), getGeminiApiKey(), getAdminApp(), requireApprovedUser(), mapEventToCells() (+35 more)

### Community 4 - "App Shell & Completed Archive"
Cohesion: 0.08
Nodes (39): App(), Navbar(), NotificationBubble(), archiveCurrentlyCompletedProjects(), archiveMissingCompletedProjects(), AUX_NODE_PATHS, clearAuxData(), fetchArchivedCompletedProjects() (+31 more)

### Community 5 - "Build Dependencies"
Cohesion: 0.04
Nodes (48): dependencies, autoprefixer, browser-image-compression, chart.js, clsx, date-fns, firebase, firebase-admin (+40 more)

### Community 6 - "i18n & App Bootstrap"
Cohesion: 0.08
Nodes (31): Task 4: Pipeline View Header Subtitle, Task 4 Report: Pipeline Subtitle (commit 7615c8e), react, React Logo (Vite Boilerplate Asset), OrphanedProjectsPanel(), SO_KEYED_NODES, queryClient, translations en/es key-parity test (+23 more)

### Community 7 - "Theming & i18n Workstream"
Cohesion: 0.06
Nodes (38): Final Whole-Branch Review (Ready to Merge), No Designer Exclusion on Archive Rules, No Firebase Emulator — Hand-Rolled Rule Simulator, CommonJS to ESM Deviation, Negative Verification (script must fail without rules), Print/PDF CSS Excluded from Theming, Task 5: Migrate Hardcoded Colors to Theme Variables, CostAnalysisView Chart.js Theme Gap (+30 more)

### Community 8 - "Archive RTDB Rules Fix"
Cohesion: 0.08
Nodes (28): SDD Plan: Archive Rules Fix, Confirmed Archive Path List, Task 1: Confirm Archive RTDB Paths, Task 1 Report: Archive Paths Confirmed, Task 2: Add archive/archive_lock Rule Blocks, Silent PERMISSION_DENIED Archive Failure, Task 2 Report: Archive Rules Added (commit 8501f46), Task 3: Rules-Behavior Verification Script (+20 more)

### Community 9 - "PDF & IP Document Generation"
Cohesion: 0.14
Nodes (20): Defensive String(x || '') coercion for unvalidated sheet data, createDefaultPage(), getClientName(), getDesignerPhoneStr(), IPGeneratorModal(), IPPrintLayout(), createDefaultPage(), DEFAULT_DRAWERS (+12 more)

### Community 10 - "KPI Calculation Engine"
Cohesion: 0.15
Nodes (23): Finding #3: predictBottlenecks hardcoded reference date, calculateAverageValidationTime(), calculateBudgetDeviation(), calculateConversionRate(), calculateFileRequestsPercentage(), calculateGlobalValidationTime(), calculatePersonalStageAverages(), calculateWeeklyCompletions() (+15 more)

### Community 11 - "Designer Scoring System Spec"
Cohesion: 0.13
Nodes (18): Approved/Rejected binary status independent of score, Business days (Fase 1) vs calendar days (Fase 2) — deliberate divergence, Final Measurements penalized an order of magnitude less (scheduling-dependent), KPI Global aggregation (avg of Fase 1 and Fase 2), ICP — Índice de Complejidad, Note type cycle Normal → Prioritaria → Observación → Diseñador, Fase 1 — Ingreso del proyecto (business-day checklist scoring), Fase 2 — IFR (red-flag friction score from designer notes) (+10 more)

### Community 12 - "Error Boundaries"
Cohesion: 0.16
Nodes (5): BaseErrorBoundary, ErrorBoundary, SectionErrorBoundary, App(), ErrorBoundary

### Community 13 - "Phase 1 Form Tests"
Cohesion: 0.14
Nodes (11): calculateTechnicalPoints(), Phase1Form(), COMPLETED, KPI_VALUE, renderInUpdateMode(), updateProject, PENDING, renderWithProject() (+3 more)

### Community 14 - "Phase 1 Form UI"
Cohesion: 0.15
Nodes (9): CHECKLIST_ITEMS, ChecklistState, emptyChecklist, emptyComplexity, inputStyle, MiniDatePicker(), selectStyle, renderInLabel() (+1 more)

### Community 15 - "Data Architecture & Caching"
Cohesion: 0.20
Nodes (12): archiveHelpers.js, CalendarView.jsx, 1GB RTDB Size Limit Auto-Archiving to Firestore, Firebase Firestore (Cold Storage Archive), Firebase Realtime Database (RTDB), Google Sheets (Data Source), JL Closets KPI Dashboard, SWR (Stale-While-Revalidate) Cache Pattern (+4 more)

### Community 16 - "Phase 1 Score Calculator"
Cohesion: 0.24
Nodes (11): businessDaysBetween(), calculatePhase1ScoreAndStatus(), ChecklistKey, daysLate(), DEFAULT_RATE, FINALS_RATE, ITEM_INTRODUCED_AT, latePenalty() (+3 more)

### Community 17 - "Designer Perf. UI Features"
Cohesion: 0.18
Nodes (11): Dark Mode UI Overhaul, Dropdown Intake Selection (Phase 1), IFR Score Color-Coded Metric Chip, "Save for Later Review" Submit Button, Smart Auto-fill (Project Name + Designer), "To review" Project Status, Unlocked Update Mode, Phase1Form (+3 more)

### Community 18 - "n8n Sheets Sync Workflow"
Cohesion: 0.20
Nodes (10): Background event sending with silent skip and retry backoff, Sheet Column Mapping (SO, Project Name, Event Type, etc.), Event: QA_CHECKLIST, Event: RELEASE_HOLD, Event: STAGE_UPDATE, Get row(s) in sheet Node, Update row / Append row Node, VITE_N8N_WEBHOOK_URL Environment Variable (+2 more)

### Community 19 - "Score Calculator Tests"
Cohesion: 0.22
Nodes (8): checklist(), LUN_10, LUN_17, LUN_3, LUN_31, score(), VIE_14, VIE_7

### Community 20 - "CSS Theme Variable Migration"
Cohesion: 0.22
Nodes (9): Bulk sed-driven Color Migration, background-clip:text Gradient-as-Text-Color, CSS var() Does Not Resolve Inside url() Data-URI, background-attachment: local, scroll Shadow Technique, ThemeContext (light-theme class on html), .h-scroll-shadow utility class, :root.light-theme override block, --overlay-01..--overlay-20 CSS variables (+1 more)

### Community 21 - "Project Details Modal"
Cohesion: 0.28
Nodes (6): Modal Body i18n Scope Gap (addendum), ChecklistItem(), ModalProps, ProjectDetailsModal(), Project, T

### Community 22 - "Dashboard Views & Alerts"
Cohesion: 0.22
Nodes (9): App.jsx, mergedData (Google Sheets + Firebase Overrides Union), @tanstack/react-query, realAlerts (ON HOLD / critical install alerts), CostAnalysisView.jsx, DashboardView.jsx, DesignQualityView.jsx, Event: ON_HOLD (+1 more)

### Community 23 - "Logbook Module"
Cohesion: 0.44
Nodes (7): jspdf, loadLogbookData(), saveLogbookData(), emptyProjectInfo(), emptyRoom(), LogbookView(), normalizeRooms()

### Community 24 - "Completed Projects Modal"
Cohesion: 0.46
Nodes (4): CompletedProjectsModal(), parseArchivedAt(), formatDisplayDate(), toDate()

### Community 25 - "Engineering Checklist"
Cohesion: 0.39
Nodes (6): loadChecklistState(), saveChecklistState(), CHECKLIST_SECTIONS, CHECKLIST_TOTAL_ITEMS, ChecklistView(), SECTION_TITLE_KEYS

### Community 26 - "Desktop & PWA Packaging"
Cohesion: 0.29
Nodes (7): Desktop App (Tauri-based Native App), Electron, IPC (Inter-Process Communication), Progressive Web App (PWA) config, Tauri, index.html (App Entry Point), main.jsx

### Community 27 - "Project Switch Tests"
Cohesion: 0.29
Nodes (5): ALPHA, baseProject, BETA, emptyChecklist, emptyComplexity

### Community 28 - "React Toolchain Plugins"
Cohesion: 0.40
Nodes (5): React Compiler, React + Vite Template, typescript-eslint, @vitejs/plugin-react, @vitejs/plugin-react-swc

### Community 29 - "Sheets Integration Options"
Cohesion: 0.50
Nodes (4): Option B: Firebase Cloud Functions Sync, Option A: Google Apps Script Webhook, Security Note: Never store Service Account credentials in frontend, Bidirectional Google Sheets Integration

### Community 33 - "Designer Assignment Fixes"
Cohesion: 0.67
Nodes (3): Designer Assignment Correction (Unassigned Fallback Fix), Designer Leaderboard Accuracy Fix (totalProjects counting), KpiContext

## Knowledge Gaps
- **185 isolated node(s):** `firebaseConfig`, `app`, `db`, `fs`, `readline` (+180 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **10 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `dependencies` connect `Build Dependencies` to `i18n & App Bootstrap`, `Logbook Module`?**
  _High betweenness centrality (0.100) - this node is a cross-community bridge._
- **Why does `shortProjectName()` connect `PDF & IP Document Generation` to `Chatbot Rules & Data Helpers`, `Designer Perf. App Shell`, `Gemini API Backend & Auth`, `App Shell & Completed Archive`, `KPI Calculation Engine`, `Completed Projects Modal`?**
  _High betweenness centrality (0.071) - this node is a cross-community bridge._
- **Why does `requireApprovedUser()` connect `Gemini API Backend & Auth` to `Theming & i18n Workstream`?**
  _High betweenness centrality (0.064) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `shortProjectName()` (e.g. with `formatDisplayDate()` and `Defensive String(x || '') coercion for unvalidated sheet data`) actually correct?**
  _`shortProjectName()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Are the 2 inferred relationships involving `MyProjectsView()` (e.g. with `note()` and `isPlaceholderName()`) actually correct?**
  _`MyProjectsView()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `firebaseConfig`, `app`, `db` to the rest of the system?**
  _218 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Chatbot Rules & Data Helpers` be split into smaller, more focused modules?**
  _Cohesion score 0.06479081821547575 - nodes in this community are weakly interconnected._