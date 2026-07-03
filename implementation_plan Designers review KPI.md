# Feature Updates: Dark Mode UI Overhaul, Intake Workflow, and Data Logic Fixes

## Goal
Implement a premium dark mode redesign across the application, streamline the Project Intake (Phase 1) workflow with a dropdown-based project selection, fix data logic bugs polluting the designer list, and refine the leaderboard tracking.

## Implemented Changes

### 1. Project Selection & Workflow Overhaul
- **Dropdown Intake Selection:** Replaced the manual text entry for "SO Number" in Phase 1 (Register New) with a sleek dropdown that lists all active ("Pending") projects from the Pipeline.
- **Smart Auto-fill:** Selecting a project automatically populates the Project Name and the base Designer (taking it from the My Projects pipeline context).
- **Manual "Total Rooms":** By user request, the Total Rooms field does *not* auto-fill and must be entered manually during intake.
- **Unlocked Update Mode:** The "Update Project" mode now allows selecting *any* evaluated project (not just Rejected/To Review, but also Approved and Completed). This allows users to retroactively correct mistakes in the Total Rooms or Assigned Designer without being locked out.

### 2. "To review" Status Workflow
- **Data Model:** Added `"To review"` as an official `ProjectStatus`.
- **Phase 1 Form (Creation):** Added a secondary submit button: **"Save for Later Review"**. Clicking this registers the project immediately with the `"To review"` status, skipping checklist validation.
- **Seamless Re-evaluation:** `"To review"` projects appear in the Update mode dropdown, allowing the user to eventually fill out the missing documents and officially "Approve" them.

### 3. Dark Theme & Premium UI Overhaul
- **Comprehensive Redesign:** Overhauled all views (`Phase1Form`, `Phase2Form`, `ProjectDetailsModal`) to match the main app's modern dark aesthetic.
- **Design Tokens:** Used deep dark backgrounds (gray-900), pill-shaped inputs, large rounded corners (28px on modals), and glassmorphism elements.
- **Dynamic Elements:** Introduced live color-coded metric chips (e.g., the IFR score in Phase 2 glows green ≥80, yellow ≥60, red <60), pill badges for statuses, and horizontal gradient progress bars for checklists.

### 4. Data Logic & Leaderboard Fixes
- **Designer Assignment Correction:** Fixed an issue in `KpiContext` where the system was erroneously using the Engineer's name (`p.eng`) as a fallback for the Designer. It now correctly falls back to `"Unassigned"`, keeping the performance metrics clean.
- **Leaderboard Accuracy:** Updated the Designer Leaderboard so that `totalProjects` counts *all evaluated projects* (anything that passed Phase 1), rather than only counting projects that fully completed Phase 2. This ensures active designers' stats update instantly on the dashboard.

## Verification Status
> [!NOTE]  
> All of these changes have been successfully deployed and verified. The application now features a cohesive dark theme, accurate data tracking for designers, and a robust intake workflow that prevents duplicate entries while allowing flexible updates.
