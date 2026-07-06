# Graph Report - .  (2026-07-06)

## Corpus Check
- 111 files · ~90,087 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 420 nodes · 796 edges · 34 communities (25 shown, 9 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 23 edges (avg confidence: 0.8)
- Token cost: 233,609 input · 100,118 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Designer Performance Sub-App|Designer Performance Sub-App]]
- [[_COMMUNITY_Firebase ArchiveCache System|Firebase Archive/Cache System]]
- [[_COMMUNITY_Package Dependencies|Package Dependencies]]
- [[_COMMUNITY_App Architecture & n8n Integration|App Architecture & n8n Integration]]
- [[_COMMUNITY_Project Pipeline & Engineering Tracking|Project Pipeline & Engineering Tracking]]
- [[_COMMUNITY_Dashboard KPI Calculations|Dashboard KPI Calculations]]
- [[_COMMUNITY_Shared UI Chrome (Navbar, Contexts, Views)|Shared UI Chrome (Navbar, Contexts, Views)]]
- [[_COMMUNITY_Project Chatbot|Project Chatbot]]
- [[_COMMUNITY_Login Intro Animation|Login Intro Animation]]
- [[_COMMUNITY_Designer Review KPI Feature Plan|Designer Review KPI Feature Plan]]
- [[_COMMUNITY_IP Generator (Install Packet PDFs)|IP Generator (Install Packet PDFs)]]
- [[_COMMUNITY_ESS Generator (Engineering Spec PDFs)|ESS Generator (Engineering Spec PDFs)]]
- [[_COMMUNITY_Archive Helpers Tests|Archive Helpers Tests]]
- [[_COMMUNITY_Error Boundary Component|Error Boundary Component]]
- [[_COMMUNITY_Sheet Parser|Sheet Parser]]
- [[_COMMUNITY_Fix-History Script|Fix-History Script]]
- [[_COMMUNITY_README Tooling Notes|README Tooling Notes]]
- [[_COMMUNITY_Recovery Script|Recovery Script]]
- [[_COMMUNITY_KPI Context Fixes|KPI Context Fixes]]
- [[_COMMUNITY_Favicon Asset|Favicon Asset]]
- [[_COMMUNITY_Icon Sprite Asset|Icon Sprite Asset]]
- [[_COMMUNITY_Logo Asset|Logo Asset]]
- [[_COMMUNITY_PWA Icon 192|PWA Icon 192]]
- [[_COMMUNITY_PWA Icon 512|PWA Icon 512]]
- [[_COMMUNITY_Hero Image Asset|Hero Image Asset]]
- [[_COMMUNITY_Translations Data|Translations Data]]

## God Nodes (most connected - your core abstractions)
1. `useLanguage()` - 39 edges
2. `MyProjectsView()` - 20 edges
3. `App()` - 17 edges
4. `DashboardView()` - 15 edges
5. `ProjectChatbot()` - 13 edges
6. `get` - 12 edges
7. `set` - 12 edges
8. `readArchiveMap()` - 12 edges
9. `App.jsx` - 11 edges
10. `writeArchiveMap()` - 10 edges

## Surprising Connections (you probably didn't know these)
- `Option A: Google Apps Script Webhook` --semantically_similar_to--> `n8n Webhook Workflow (App to Google Sheets)`  [INFERRED] [semantically similar]
  FUTURE_ROADMAP.md → N8N_SETUP.md
- `main()` --calls--> `get`  [INFERRED]
  fix-history.mjs → src/utils/__tests__/archiveStore.test.js
- `MyProjectsView()` --references--> `jspdf`  [EXTRACTED]
  src/views/MyProjectsView.jsx → package.json
- `main.jsx` --shares_data_with--> `App.jsx`  [INFERRED]
  index.html → contexto_y_flujo.md
- `NotificationBubble()` --references--> `react`  [EXTRACTED]
  src/components/NotificationBubble.jsx → package.json

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Data Flow Pipeline: Sheets to Cache to App to Firebase to Views** — contexto_y_flujo_google_sheets_source, dbcache_js, app_jsx, contexto_y_flujo_firebase_rtdb, dashboardview_jsx [EXTRACTED 1.00]
- **n8n Event Payload Types Driving Webhook Workflow** — n8n_setup_event_on_hold, n8n_setup_event_release_hold, n8n_setup_event_stage_update, n8n_setup_event_qa_checklist, n8n_setup_webhook_workflow [EXTRACTED 1.00]
- **Intake Workflow Overhaul: Dropdown, Autofill, To-Review Status** — implementation_plan_designers_review_kpi_dropdown_intake_selection, implementation_plan_designers_review_kpi_smart_autofill, implementation_plan_designers_review_kpi_to_review_status, implementation_plan_designers_review_kpi_unlocked_update_mode, phase1form_jsx [EXTRACTED 1.00]

## Communities (34 total, 9 thin omitted)

### Community 0 - "Designer Performance Sub-App"
Cohesion: 0.06
Nodes (37): App(), Badge(), BadgeProps, Layout(), LayoutProps, ModalProps, ProjectDetailsModal(), T (+29 more)

### Community 1 - "Firebase Archive/Cache System"
Cohesion: 0.10
Nodes (33): App(), OrphanedProjectsPanel(), SO_KEYED_NODES, isSuperAdminRole(), acquireLease(), chain, withArchiveLease(), checkDbSizeAndArchive() (+25 more)

### Community 2 - "Package Dependencies"
Cohesion: 0.05
Nodes (43): dependencies, autoprefixer, browser-image-compression, chart.js, clsx, date-fns, firebase, isomorphic-git (+35 more)

### Community 3 - "App Architecture & n8n Integration"
Cohesion: 0.05
Nodes (42): App.jsx, archiveHelpers.js, CalendarView.jsx, 1GB RTDB Size Limit Auto-Archiving to Firestore, Firebase Firestore (Cold Storage Archive), Firebase Realtime Database (RTDB), Google Sheets (Data Source), JL Closets KPI Dashboard (+34 more)

### Community 4 - "Project Pipeline & Engineering Tracking"
Cohesion: 0.14
Nodes (25): compressImage(), uploadNoteAttachment(), calculateMonthlyCompletions(), calculatePersonalStageAverages(), getUpcomingDeadlines(), saveEngineeringCheck(), cleanupESSData(), cleanupIPData() (+17 more)

### Community 5 - "Dashboard KPI Calculations"
Cohesion: 0.13
Nodes (16): SectionErrorBoundary, SkeletonLoader(), calculateAverageValidationTime(), calculateBudgetDeviation(), calculateConversionRate(), calculateGlobalValidationTime(), getDelayedProjectsCount(), getProjectLocation() (+8 more)

### Community 6 - "Shared UI Chrome (Navbar, Contexts, Views)"
Cohesion: 0.13
Nodes (17): CompletedProjectsModal(), GlobalFilterBar(), Navbar(), NotificationBubble(), queryClient, LanguageContext, LanguageProvider(), useLanguage() (+9 more)

### Community 7 - "Project Chatbot"
Cohesion: 0.19
Nodes (17): buildEntityAnswer(), buildWelcomeMessage(), DESIGNERS_CONTACTS, ENTITY_QUERY_TRIGGERS, extractEntityQuery(), FormattedMessage(), getHelpText(), loadStoredMessages() (+9 more)

### Community 8 - "Login Intro Animation"
Cohesion: 0.19
Nodes (15): react, React Logo (Vite Boilerplate Asset), b_c01(), b_lerp(), b_rnd(), BgEmblem(), BgLockup(), BgParticles() (+7 more)

### Community 9 - "Designer Review KPI Feature Plan"
Cohesion: 0.18
Nodes (11): Dark Mode UI Overhaul, Dropdown Intake Selection (Phase 1), IFR Score Color-Coded Metric Chip, "Save for Later Review" Submit Button, Smart Auto-fill (Project Name + Designer), "To review" Project Status, Unlocked Update Mode, Phase1Form (+3 more)

### Community 10 - "IP Generator (Install Packet PDFs)"
Cohesion: 0.35
Nodes (8): createDefaultPage(), DESIGNER_PHONES, getClientName(), getDesignerPhoneStr(), IPGeneratorModal(), IPPrintLayout(), loadIPData(), saveIPData()

### Community 11 - "ESS Generator (Engineering Spec PDFs)"
Cohesion: 0.33
Nodes (7): createDefaultPage(), DEFAULT_DRAWERS, DEFAULT_RODS, PDFGeneratorModal(), PDFPrintLayout(), loadESSData(), saveESSData()

### Community 12 - "Archive Helpers Tests"
Cohesion: 0.25
Nodes (6): ARCHIVE_PATHS, readArchiveMap, removedNodes, rtdb, storageStore, writeArchiveMap

### Community 14 - "Sheet Parser"
Cohesion: 0.67
Nodes (5): createHeaderMap(), fetchAndParseData(), fetchAndParseProjectMaterials(), getIdx(), parseDateStringOrNumber()

### Community 15 - "Fix-History Script"
Cohesion: 0.40
Nodes (4): app, db, firebaseConfig, main()

### Community 16 - "README Tooling Notes"
Cohesion: 0.40
Nodes (5): React Compiler, React + Vite Template, typescript-eslint, @vitejs/plugin-react, @vitejs/plugin-react-swc

### Community 18 - "KPI Context Fixes"
Cohesion: 0.67
Nodes (3): Designer Assignment Correction (Unassigned Fallback Fix), Designer Leaderboard Accuracy Fix (totalProjects counting), KpiContext

## Knowledge Gaps
- **115 isolated node(s):** `firebaseConfig`, `app`, `db`, `name`, `private` (+110 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **9 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `dependencies` connect `Package Dependencies` to `Login Intro Animation`?**
  _High betweenness centrality (0.144) - this node is a cross-community bridge._
- **Why does `react` connect `Login Intro Animation` to `Designer Performance Sub-App`, `Package Dependencies`, `Project Pipeline & Engineering Tracking`, `Dashboard KPI Calculations`, `Shared UI Chrome (Navbar, Contexts, Views)`?**
  _High betweenness centrality (0.088) - this node is a cross-community bridge._
- **Why does `useLanguage()` connect `Shared UI Chrome (Navbar, Contexts, Views)` to `Firebase Archive/Cache System`, `Project Pipeline & Engineering Tracking`, `Dashboard KPI Calculations`, `Project Chatbot`, `Login Intro Animation`, `IP Generator (Install Packet PDFs)`, `ESS Generator (Engineering Spec PDFs)`?**
  _High betweenness centrality (0.072) - this node is a cross-community bridge._
- **What connects `firebaseConfig`, `app`, `db` to the rest of the system?**
  _124 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Designer Performance Sub-App` be split into smaller, more focused modules?**
  _Cohesion score 0.05555555555555555 - nodes in this community are weakly interconnected._
- **Should `Firebase Archive/Cache System` be split into smaller, more focused modules?**
  _Cohesion score 0.10448979591836735 - nodes in this community are weakly interconnected._
- **Should `Package Dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.045454545454545456 - nodes in this community are weakly interconnected._