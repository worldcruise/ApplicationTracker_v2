# Candidate Management, Resume Studio & Bid Operations Platform

## Product Requirements and Technical Design Document

| Document attribute | Value |
| --- | --- |
| Document version | 1.0 |
| Status | Initial product specification |
| Deployment strategy | GitHub-first, free-tier development where practical |
| Primary interfaces | Web application and browser extension |

## 1. Executive Summary

The objective is to develop an integrated candidate management and resume production platform that centralizes candidate profiles, AI-assisted resume generation, PDF creation, bid tracking, interview management, and team operations.

The platform consists of two connected applications:

1. **Web application:** The primary workspace for candidate management, dashboards, resume templates, prompt configuration, bid operations, interviews, team management, and administration.
2. **Browser extension:** A lightweight productivity tool for copying prompts, entering job descriptions, pasting AI-generated resume JSON, previewing resumes, generating PDFs, saving documents locally, and synchronizing data with the database.

Both applications will use a shared backend, authentication system, database, and permission model.

The initial implementation should prioritize a functional, secure, maintainable foundation while keeping hosting and development costs as low as possible.

### 1.1 Product objectives

- Centralize candidate information and professional history.
- Standardize resume generation through a shared JSON schema.
- Support multiple resume templates and customizable document layouts.
- Generate PDFs directly from structured resume data.
- Save generated documents locally and retain their source JSON in the database.
- Manage bids and interview rounds independently for each job opportunity.
- Provide role-specific dashboards and access controls.
- Track ownership, follow-ups, status changes, and document versions.
- Support team-wide reporting and operational visibility.
- Maintain a consistent workflow between the web application and browser extension.

## 2. Scope and Core Principles

### 2.1 In scope

- Landing page and authentication
- Role-based access control
- Candidate directory and candidate settings
- Work experience, education, certifications, and online profiles
- Main and custom prompt management
- Resume template library and editor
- JSON input, validation, and resume preview
- PDF generation and local saving
- Cover letter management
- Candidate-specific bid pipeline
- Interview scheduling, feedback, and outcomes
- Team assignments and workload visibility
- Notifications, follow-ups, and audit history
- Admin dashboard and operational analytics
- Browser extension with Resume and Profile tabs
- GitHub source management and deployment documentation

### 2.2 Design principles

1. **One source of truth:** Candidate profiles, bids, interviews, and documents must be managed through the shared backend.
2. **Separate data from presentation:** Resume JSON defines content; resume templates define visual presentation.
3. **Permission-first design:** Access restrictions must be enforced by the backend, not only by the user interface.
4. **Preserve history:** Generated documents and submitted versions must remain traceable.
5. **Accurate professional representation:** Tailoring must not fabricate qualifications, employers, dates, certifications, or achievements.
6. **Reliable operations:** PDF generation, database synchronization, and status updates must report success or failure independently.
7. **Modular implementation:** Each major feature should be independently testable and maintainable.

## 3. System Architecture

### 3.1 High-level architecture

The system will contain the following components:

- **Web frontend:** Dashboard, candidate management, resume studio, bid pipeline, interview pipeline, and administration.
- **Browser extension:** Resume and Profile tabs, prompt copying, JSON processing, preview, PDF generation, and local downloads.
- **Authentication service:** User sign-in, sessions, account management, and role resolution.
- **Backend/API:** Business rules, authorization, validation, database operations, and document metadata.
- **Relational database:** Users, teams, candidates, assignments, bids, interviews, prompts, templates, and document versions.
- **File storage:** Optional storage for PDFs, cover letters, and template assets.
- **GitHub repository:** Source code, version history, documentation, and release packages.

### 3.2 Recommended technology stack

| Component | Recommended technology |
| --- | --- |
| Web frontend | React with Next.js and TypeScript |
| UI and styling | Tailwind CSS and a reusable component library |
| Browser extension | Chrome Extension Manifest V3, JavaScript or TypeScript |
| Database | PostgreSQL |
| Authentication | Supabase Auth or an equivalent provider |
| Database access | Authenticated API and row-level security policies |
| PDF generation | pdf-lib or jsPDF |
| JSON validation | JSON Schema with a compatible validator |
| Source control | Git and GitHub |
| Hosting | Free-tier-compatible frontend and backend services |
| Local document output | Browser downloads or user-authorized directory access |

The initial implementation should avoid a separate always-running backend server on the user's computer unless unrestricted local filesystem operations prove necessary.

### 3.3 Browser extension execution model

The extension's background service worker will handle event-driven tasks, messaging, and coordination. It must not depend on continuous background execution.

Long-running or persistent operations should use an appropriate backend service. The extension should preserve operation status and provide a retry mechanism when synchronization fails.

## 4. User Roles and Permissions

The platform will support four primary roles: Admin, Team Leader, Team Member, and Bidder.

### 4.1 Admin

The administrator has organization-wide administrative access.

Responsibilities:

- Create, deactivate, and manage user accounts.
- Assign roles and manage team membership.
- Assign candidates to team leaders and team members.
- View all candidates, bids, interviews, documents, and team activity.
- Configure global prompts, templates, and system defaults.
- Review audit logs and operational metrics.
- Manage permissions and system configuration.
- Investigate failed synchronization or processing operations.

Sensitive administrative actions must be recorded in the audit log.

### 4.2 Team Leader

The team leader manages the candidates and workflow assigned to their team.

Responsibilities:

- View assigned candidates and team workload.
- Assign or reassign candidates to authorized team members.
- Create, update, and review permitted bid records.
- Manage bid and interview statuses.
- Review resume and cover letter preparation.
- Approve submissions when approval is required.
- Monitor upcoming interviews, overdue tasks, and pending feedback.
- Review team-level activity and performance.

Team leaders must not automatically gain access to unrelated teams.

### 4.3 Team Member

The team member manages specifically assigned candidates.

Responsibilities:

- View and update assigned candidate profiles.
- Maintain professional history and profile settings.
- Configure permitted candidate-specific prompts.
- Generate and revise resumes and cover letters.
- View and update authorized bid and interview records.
- Record follow-ups, notes, and next actions.
- View relevant document history.

Candidate reassignment and administrative permissions must remain restricted.

### 4.4 Bidder

The bidder has bid-specific operational access.

Responsibilities:

- View candidate information required for bid preparation.
- Create and update authorized bid records.
- View bid history and submission statuses.
- Record submission dates, confirmation details, and follow-ups.
- View their own bid activity.

The bidder must not be able to administer users, change candidate profiles, manage interview outcomes, or access unrelated administrative functions.

### 4.5 Permission matrix

| Capability | Admin | Team Leader | Team Member | Bidder |
| --- | --- | --- | --- | --- |
| Manage users and roles | Yes | No | No | No |
| View all candidates | Yes | Team scope | Assigned scope | Authorized bid scope |
| Edit candidate profiles | Yes | Team scope | Assigned scope | No |
| Manage candidate assignments | Yes | Team scope | No | No |
| Create and manage bids | Yes | Team scope | Assigned scope | Authorized bid scope |
| Manage interviews | Yes | Team scope | Assigned scope | No |
| Manage global prompts and templates | Yes | No | No | No |
| Generate resumes | Yes | Yes | Yes | No by default |
| View authorized document history | Yes | Team scope | Assigned scope | Bid scope |
| View organization-wide analytics | Yes | Team analytics | Personal/assigned scope | Own bid activity |
| View audit logs | Yes | Limited team activity | Own relevant activity | Own relevant activity |

Permissions should be configurable where practical, but the default policy must follow least privilege.

## 5. Application Navigation

### 5.1 Public pages

- Landing page
- Sign-in page
- Account recovery
- Optional About page
- Optional Contact page

Public pages must not expose candidate data or internal operational information.

### 5.2 Authenticated application

Primary navigation:

1. Dashboard
2. Candidates
3. Bids
4. Interviews
5. Resume Studio
6. Templates
7. Prompts
8. Team
9. Notifications
10. Settings

The visible navigation and available actions must be determined by the authenticated user's permissions.

Administrative pages will appear only for authorized users.

## 6. Dashboard Design

The dashboard should emphasize actionable work rather than merely displaying totals.

### 6.1 Admin dashboard

Display organization-wide metrics:

- Total active candidates
- Active bids
- Bids awaiting review
- Submitted bids awaiting responses
- Upcoming interviews
- Overdue follow-ups
- Candidate assignments by team
- Workload by team member
- Bid outcomes and conversion rates
- Interview progression and outcomes
- Recent activity and processing failures

Filters should include date range, team, owner, status, and target company.

### 6.2 Team Leader dashboard

Display:

- Assigned candidates
- Active bids and current stages
- Bids awaiting approval
- Interviews scheduled
- Feedback pending
- Overdue follow-ups
- Team workload and outstanding tasks
- Recent team activity

The team leader should be able to open an item directly from a dashboard metric.

### 6.3 Team Member dashboard

Display:

- Assigned candidates
- Resumes awaiting generation or revision
- Draft bids
- Pending reviews
- Upcoming interviews
- Follow-ups due
- Recent candidate and document activity

### 6.4 Bidder dashboard

Display:

- Bids created by the bidder
- Draft bids
- Submitted bids awaiting responses
- Bids requiring follow-up
- Recently updated bid statuses
- Historical bid activity

The bidder must not see interview-management controls.

## 7. Candidate Management

The candidate directory should support search, filtering, sorting, assignment, and a detailed candidate workspace.

Recommended candidate detail tabs:

- Overview
- Profile
- Resumes
- Bids
- Interviews
- Activity

The candidate profile is the authoritative source of professional information. Individual resume versions may contain tailored presentation choices, but they must remain traceable to verified candidate data.

### 7.1 Personal information

Required fields:

- Full name
- Email
- Phone
- Location

Validation should enforce reasonable formats without assuming that every candidate has a phone number or a single geographic location.

### 7.2 Online presence

Fields:

- LinkedIn URL
- GitHub URL
- Personal website
- Optional portfolio or other professional links

URLs should be validated and normalized where possible.

### 7.3 Work experience

Each experience record should contain:

- Company name
- Official job title
- Start and end dates
- Employment location
- Source bullet points
- Preferred bullet-point count
- Relevant verified achievements
- Optional role-specific presentation title
- Fixed or configurable title policy
- Display order

Users should be able to add, edit, remove, and reorder experience records.

#### Title policy

The application must distinguish between an official historical job title and a resume display title.

- **Fixed:** Use the official title.
- **Tailorable display:** Allow an approved, accurate presentation variant.
- **Omit if irrelevant:** Exclude an optional field from a specific resume when appropriate.

A title must never be silently changed into a different position merely to match a job description.

Employment dates, employer names, and verified qualifications must remain factually accurate.

### 7.4 Seniority and professional summary

Provide a configurable seniority or experience-level field for guiding summary generation.

The seniority setting is a generation preference, not permission to exaggerate experience.

The generated summary should reflect the candidate's verified background and relevant job requirements.

### 7.5 Education

Each education record should include:

- University or institution
- Degree
- Major or field of study
- Start and end period, when known
- Optional fixed or configurable display policy
- Display order

### 7.6 Certifications and licenses

Fields:

- Certification or license name
- Issuing institution
- Issue date
- Expiration date, when applicable
- Verification status
- Optional credential identifier, if appropriate

## 8. Prompt Management

The prompt settings interface will support a required main prompt and multiple custom prompts.

### 8.1 Main prompt

The main prompt establishes the common rules for resume generation, including:

- Expected JSON structure
- Output-only requirements
- Resume formatting constraints
- Factual accuracy requirements
- Handling of missing information
- Prohibited fabrication
- Job description interpretation
- Candidate profile usage

### 8.2 Custom prompts

Users may create additional prompt blocks with:

- Prompt name
- Prompt content
- Description
- Enabled/disabled state
- Display order
- Scope
- Version history

Supported scopes:

- Global
- Team
- Candidate-specific

Administrators manage protected global instructions. Other users may manage prompts only within their authorized scope.

### 8.3 Prompt assembly

The application should assemble the final prompt from:

1. Main prompt
2. Enabled custom prompts in their configured order
3. Authorized candidate profile data
4. Resume template instructions, where applicable
5. Target job description

The system should offer a prompt preview and a Copy Prompt action.

The exact assembled prompt must be the content copied to the clipboard.

Job descriptions and AI-generated content must be treated as untrusted input. They must not override the application's authorization, validation, or factual accuracy rules.

## 9. Canonical Resume JSON Schema

The following structure is the initial canonical format for generated resume content.

```json
{
  "company": "Company name from the job description",
  "title": "",
  "summary": "",
  "skills": [
    {
      "Category1": [
        "Skill1",
        "Skill2"
      ]
    }
  ],
  "experience": [
    {
      "title": "",
      "company": "",
      "sentences": [
        "Sentence 1",
        "Sentence 2"
      ]
    }
  ],
  "education": [
    {
      "degree": "Degree and Major"
    }
  ]
}
```

### 9.1 Field definitions

| Field | Type | Meaning |
| --- | --- | --- |
| `company` | String | Target company identified from the job description |
| `title` | String | Target position or resume headline |
| `summary` | String | Tailored professional summary |
| `skills` | Array of objects | Categorized skills |
| `experience` | Array of objects | Employment entries |
| `experience[].title` | String | Job title displayed for that experience |
| `experience[].company` | String | Previous employer |
| `experience[].sentences` | Array of strings | Resume bullet content |
| `education` | Array of objects | Education entries |
| `education[].degree` | String | Degree and major |

The `company` field refers to the target company. The `experience[].company` field refers to a previous employer. These meanings must not be interchanged.

### 9.2 Validation requirements

Before preview or PDF generation:

- Parse the input as valid JSON.
- Require the expected top-level object.
- Validate field types.
- Require `skills`, `experience`, and `education` to be arrays.
- Validate experience entries and their `sentences` arrays.
- Reject invalid JSON with a clear error message.
- Warn about missing or empty values.
- Escape content safely during rendering.
- Prevent malformed input from breaking the interface or generating corrupted documents.

Empty optional values may produce warnings rather than errors. The validation policy should distinguish required structure from optional content.

### 9.3 Schema evolution

The original schema should remain supported as version 1.

Potential future additions include:

- Experience dates and locations
- University and attendance period
- Certifications
- Additional profile links
- Optional contact details
- Document metadata

These should be introduced through a versioned schema and migration process. They must not be silently required by existing workflows.

The current schema is a content contract, not a complete database schema.

## 10. Resume Studio

The Resume Studio will provide template selection, live preview, JSON editing, and document generation.

### 10.1 Three-column layout

The desktop layout uses a 12-column grid with a 3–6–3 distribution.

#### Left panel — 3 columns: Template Library

Features:

- Eight to ten built-in resume templates
- Template thumbnails
- Search and category filters
- Select and preview actions
- Duplicate template
- Add custom template
- Save customized template
- Reset to default
- Template visibility and sharing settings

Suggested template categories:

- ATS Classic
- Modern Professional
- Minimal
- Technical
- Executive
- Compact
- Academic
- Creative
- Chronological

#### Center panel — 6 columns: Live Resume Preview

Features:

- Rendered resume preview
- Page navigation
- Zoom controls
- Live updates after template or content changes
- Section visibility controls
- Visual spacing and page-break validation
- Preview using sample or actual candidate data
- Generate PDF action

The preview must reflect the actual PDF layout as closely as possible.

#### Right panel — 3 columns: JSON Editor

Features:

- Paste JSON
- Edit JSON
- Load sample JSON
- Validate JSON
- Show schema errors
- Format JSON
- Clear editor
- Save source JSON
- Import a new response

The JSON editor should preserve the user's input when validation fails.

### 10.2 Custom template editor

Authorized users should be able to customize:

- Header arrangement
- Font family and sizes
- Page margins
- Text alignment
- Section order
- Section labels
- Line spacing
- Paragraph spacing
- Bullet indentation
- Page size
- Page breaks
- Section visibility
- Header and contact information layout

Templates should store presentation configuration separately from resume content.

The initial release should prioritize ATS-friendly layouts, readable typography, and reliable pagination.

### 10.3 Template persistence

Each template should have:

- Unique identifier
- Name
- Version
- Owner or scope
- Layout configuration
- Creation and update timestamps
- Default status
- Sharing policy

Generated documents must retain the template version used at the time of generation.

## 11. Resume Preview and PDF Generation

The system will render validated JSON into the selected template.

### 11.1 Rendering rules

- `title` becomes the resume headline.
- `summary` becomes the professional summary.
- `skills` renders as grouped skill categories.
- `experience` renders as employment entries with bullet points.
- `education` renders as education entries.
- `company` remains target-company metadata unless a template explicitly uses it.

The PDF should not display raw JSON unless the user explicitly requests a JSON document.

### 11.2 PDF generation workflow

1. Validate JSON.
2. Resolve the candidate and related bid, where applicable.
3. Resolve the selected template and template version.
4. Render the resume.
5. Validate pagination and layout.
6. Generate the PDF.
7. Initiate local saving.
8. Persist the original JSON and document metadata.
9. Record independent operation results.
10. Display a completion summary.

### 11.3 Local file saving

Initial behavior:

- Generate a PDF using a predictable filename.
- Use the browser Downloads API to save into Downloads.
- Avoid silently overwriting existing files.
- Record the filename and generation status.

Example filename:

```text
CandidateName_TargetCompany_TargetRole_20261017.pdf
```

For a user-selected directory, investigate the File System Access API and persistent directory permissions.

For arbitrary filesystem paths without repeated interaction, consider a native helper application communicating through Native Messaging.

The extension must never claim that a file was saved successfully before the browser or file-writing operation confirms success.

## 12. Cover Letter Management

The application and extension should support a dedicated cover letter section.

Features:

- Paste AI-generated cover letter text
- Preview the content
- Edit before saving
- Associate the letter with a candidate and bid
- Save the text to the database
- Maintain version history
- Export or generate a PDF when required
- Track creation and modification timestamps

Saving a new version must not silently overwrite a previously submitted cover letter.

## 13. Browser Extension Specification

The extension will contain two primary tabs: Resume and Profile.

### 13.1 Resume tab

#### Section A — Job Description

Components:

- Job Description heading
- Large text input
- Copy Prompt button aligned to the right of the heading
- Input validation and character-count feedback, where useful

The Copy Prompt action should assemble the configured prompts and authorized candidate information with the entered job description.

The generated prompt is copied to the clipboard for use in an external AI tool.

#### Section B — Resume JSON Response

Components:

- JSON input area
- Preview button
- Generate PDF & Save button
- Validation messages
- Operation status indicator

Preview opens a rendered resume preview before the user saves the document.

Generate PDF & Save triggers the configured PDF generation, local save, and database synchronization workflow.

#### Section C — Cover Letter

Components:

- Cover Letter heading
- Text input
- Save button
- Optional preview and export actions

The cover letter should be associated with the selected candidate and bid when that context is available.

### 13.2 Profile tab

Components:

- Candidate selector
- Candidate identity and basic details
- Current professional profile summary
- Active prompt and template configuration
- Candidate profile status
- Link to open the full profile in the web application

The extension should not duplicate the entire candidate management interface. The web application remains the authoritative editing environment.

### 13.3 Extension synchronization

The extension should use authenticated API requests to access candidate and document records.

It must not contain privileged database credentials or unrestricted administrative secrets.

For each save operation, display independent results:

- JSON validation
- PDF generation
- Local file saving
- Database synchronization

A failed database request must not invalidate an already generated local PDF.

Retrying synchronization should not create duplicate document records. Use operation identifiers or idempotency controls where appropriate.

## 14. Bid Management

**Working assumption:** A bid represents submitting a candidate for a specific job or client opportunity. If bidding instead means submitting a commercial contract proposal, the workflow and data model will need to be revised.

Each bid should be an independent record linked to a candidate.

### 14.1 Bid fields

- Candidate ID
- Target company
- Job title
- Job description
- External job or opportunity identifier, if available
- Assigned owner
- Team
- Bid status
- Priority
- Creation date
- Submission date
- Last contact date
- Next follow-up date
- Resume version ID
- Cover letter version ID
- Submission confirmation
- Notes
- Outcome
- Created and updated timestamps

### 14.2 Recommended bid statuses

1. Draft
2. Resume Preparation
3. Ready for Review
4. Needs Changes
5. Approved
6. Submitted
7. Awaiting Response
8. Shortlisted
9. Interview Invited
10. On Hold
11. Rejected
12. Withdrawn
13. Expired
14. Offer
15. Closed

Not every status must be available at every stage. The system should enforce valid transitions, record status history, and require additional information for selected transitions.

For example, moving a bid to Submitted should record a submission timestamp and the document versions used.

### 14.3 Bid approval

Approval should be configurable by team or workflow.

A simple initial policy:

- Bidder or authorized owner creates the bid.
- Candidate resume and cover letter are prepared.
- Authorized reviewer checks the submission.
- Reviewer approves or requests changes.
- Authorized user records the actual submission.
- Bid status and history are updated.

If approval is not required, an authorized user may submit directly.

## 15. Interview Management

Interview records must be associated with a specific bid rather than only with the candidate.

One candidate may have multiple job opportunities and multiple interview rounds.

### 15.1 Interview fields

- Interview ID
- Bid ID
- Candidate ID
- Round number
- Interview type
- Interviewer
- Scheduled date and time
- Time zone
- Meeting link or location
- Interview status
- Feedback
- Outcome
- Next action
- Follow-up date
- Created and updated timestamps

### 15.2 Interview statuses

- Not Scheduled
- Scheduling
- Scheduled
- Completed
- Feedback Pending
- Next Round
- Offer
- Passed
- Rejected
- Cancelled

The system should distinguish interview completion from the final outcome. A completed interview may still have pending feedback.

### 15.3 Interview workflow

1. A bid reaches an interview stage.
2. An interview record is created.
3. Scheduling information is entered.
4. The interview is conducted.
5. Feedback and outcome are recorded.
6. The next action is assigned.
7. Additional interview rounds may be created.
8. The bid is updated based on the overall application outcome.

Interview history should remain intact even if a bid or candidate is later archived.

## 16. Follow-ups and Notifications

The platform should help users identify work that requires attention.

Recommended reminders:

- Bid awaiting approval
- Bid awaiting a client response
- Follow-up overdue
- Interview approaching
- Interview feedback pending
- Resume revision requested
- Document generation or synchronization failed
- Candidate assignment changed

Notifications should be permission-aware and link directly to the relevant record.

For the initial release, in-app notifications and dashboard reminders are sufficient. Email or external messaging notifications can be added later.

## 17. Database Design

The following entities provide the initial relational model.

| Entity | Purpose |
| --- | --- |
| `users` | User identity and account status |
| `teams` | Team records |
| `team_memberships` | User roles within teams |
| `candidates` | Core candidate identity and profile |
| `candidate_assignments` | Candidate ownership and scope |
| `work_experiences` | Employment history |
| `educations` | Education records |
| `certifications` | Certification and license records |
| `candidate_links` | Professional URLs |
| `prompt_presets` | Main and custom prompts |
| `resume_templates` | Template definitions and versions |
| `bids` | Candidate job submissions |
| `bid_status_history` | Bid status transitions |
| `interviews` | Interview rounds and schedules |
| `interview_feedback` | Feedback and outcomes |
| `resume_versions` | JSON, rendered document metadata, and versions |
| `cover_letter_versions` | Cover letter content and versions |
| `documents` | PDF metadata and file references |
| `notifications` | User-facing notifications |
| `audit_logs` | Security-relevant and operational changes |

### 17.1 Relationship rules

- A candidate can have multiple work experience and education records.
- A candidate can have multiple bids.
- A bid belongs to a candidate and represents one job opportunity.
- A bid can have multiple interview rounds.
- A bid can reference specific resume and cover letter versions.
- A resume version records its schema version and template version.
- Candidate assignments connect candidates to authorized owners and teams.
- Status history records changes rather than replacing historical information.

### 17.2 Document storage

Store structured JSON and operational metadata in PostgreSQL.

PDF files may be stored locally and optionally uploaded to managed object storage. Database records should reference file metadata rather than requiring the entire PDF to be stored as a database field.

The database should retain enough information to determine whether a PDF was generated, saved locally, uploaded, or submitted.

## 18. Security and Data Integrity

The platform will store personal and professional candidate information. Security must be part of the initial design.

Requirements:

- Authenticated access to protected pages and APIs.
- Server-side role and ownership checks.
- Database row-level security where supported.
- Least-privilege access for users and services.
- Secure handling of authentication tokens.
- No privileged database credentials embedded in the extension.
- Input validation and safe rendering of pasted content.
- Audit logging for important administrative and workflow changes.
- Protection against unauthorized candidate and document access.
- Secure secret management for deployment.
- Defined retention and deletion policies.
- Backup and recovery procedures appropriate to the service.

The system should preserve document history while respecting approved deletion and retention requirements.

## 19. Error Handling and Recovery

Every major workflow should have explicit operation states.

Examples:

- Invalid JSON
- Missing required fields
- Unsupported schema version
- Preview rendering failed
- PDF generation failed
- Local save was cancelled or denied
- Database synchronization failed
- Authentication expired
- Permission denied
- Duplicate submission detected
- Concurrent modification detected

Errors should explain the failed operation and the next available action.

The system must avoid reporting an overall success if one of the required operations failed.

When appropriate, retain the user's input and allow a safe retry without duplicating records or documents.

## 20. Deployment and Cost Strategy

### 20.1 Development

Use:

- GitHub for source control
- A local development environment
- Free frontend and database tiers where suitable
- Local extension installation for testing
- Local PDF generation
- Test accounts representing each role

### 20.2 Deployment stages

1. Create the GitHub repository.
2. Establish the application and extension project structure.
3. Configure development and production environment variables.
4. Create database tables and authorization policies.
5. Implement authentication and role checks.
6. Deploy the web application to a compatible hosting service.
7. Load the extension locally in browser developer mode.
8. Test local file permissions and database synchronization.
9. Package a test release.
10. Publish through a browser extension store if public distribution is required.

GitHub hosts the source code, but it does not automatically provide an always-running backend. Hosting and database services must be configured separately.

Free tiers are appropriate for an initial prototype, but production costs depend on usage, storage, authentication, hosting, and service limits.

## 21. Development Phases

### Phase 1 — Foundation

- Repository and project setup
- Authentication
- Role-based permissions
- Candidate records and assignments
- Candidate settings
- Database schema and security policies

**Completion criterion:** Each role can access only its authorized records and actions.

### Phase 2 — Resume Production

- Canonical JSON schema
- JSON validation
- Prompt management
- Template library
- Live resume preview
- PDF generation
- Local download
- Document versioning

**Completion criterion:** Valid JSON can be rendered into a reproducible PDF using a selected template.

### Phase 3 — Browser Extension

- Resume and Profile tabs
- Job description input
- Copy Prompt
- JSON paste and validation
- Preview
- Generate PDF & Save
- Cover letter saving
- Database synchronization and retry

**Completion criterion:** The extension can complete the resume workflow without requiring the user to re-enter the same information in the web app.

### Phase 4 — Bid and Interview Operations

- Bid creation and tracking
- Status transition rules
- Approval workflow
- Interview scheduling and feedback
- Follow-ups and notifications
- Historical activity

**Completion criterion:** Every bid and interview is traceable to the relevant candidate, owner, and document versions.

### Phase 5 — Administration and Analytics

- Admin dashboard
- Team leader dashboard
- Team member dashboard
- Bidder dashboard
- Workload reporting
- Conversion analytics
- Audit logs
- Administrative settings

**Completion criterion:** Authorized users can monitor the operational pipeline without gaining unauthorized access to other teams' data.

## 22. Acceptance Criteria

The first production-ready release should satisfy the following:

1. Users can sign in and receive the correct permissions.
2. Admins can manage users, roles, and assignments.
3. Authorized users can create and update candidate profiles.
4. The system supports the canonical resume JSON structure.
5. Invalid JSON produces actionable validation messages.
6. The resume preview reflects the selected template.
7. Users can generate and save PDFs locally.
8. JSON and document metadata can be stored securely.
9. Failed database synchronization can be retried safely.
10. Generated documents retain schema and template version information.
11. The extension's Copy Prompt action copies the assembled prompt.
12. Cover letters can be saved with version history.
13. Bids have independent statuses and historical records.
14. Interview rounds belong to their respective bids.
15. Follow-ups and overdue tasks appear in the relevant dashboards.
16. Role restrictions are enforced by the backend.
17. Important status and permission changes are auditable.
18. The web application and extension use the same backend and validation rules.
19. The application reports partial failures accurately.
20. The initial deployment can be operated within available free-tier limits, subject to service quotas.

## 23. Final Recommendation

Build the platform around three independent but connected foundations:

1. **Candidate profile:** The authoritative record of professional identity, work history, education, and credentials.
2. **Bid and interview workflow:** The operational record for each job opportunity, submission, interview round, and outcome.
3. **Resume and document engine:** The structured JSON, prompt configuration, template version, rendered PDF, and document history.

The web application should be the central source of truth. The browser extension should be optimized for speed and convenience, especially prompt copying, JSON processing, resume preview, PDF generation, and local saving.

Implement the shared data model, authorization rules, and document versioning first. Those decisions will determine whether the product remains reliable as more candidates, users, teams, and job opportunities are added.

## 24. Quick Application Check & Local Bid Archive

### 24.1 Purpose

The browser extension will provide a fast workflow for checking whether a candidate has previously applied to a company or specific job opportunity and for saving a complete bid package locally.

The feature will be available from any supported job-posting webpage through:

- **Keyboard shortcut:** Ctrl + Shift + F
- **Right-click context menu:** Check Application History
- **Optional extension popup action:** Check Application History

The feature will connect the current webpage, selected company name, active candidate profile, local filesystem, and Supabase bid history.

The workflow must distinguish between a previous application to the same company and a previous application to the exact same job.

### 24.2 User workflow

#### Step 1 — Select a company

The user highlights a company name on a job-posting webpage.

The extension captures:

- Selected company name
- Current webpage URL
- Page title
- Available job description
- Current authenticated user
- Selected candidate profile

The context-menu action should use the selected text as the company name.

The keyboard shortcut should retrieve the current text selection from the active tab. If no company name is selected, the extension should request a company name or allow the user to select one manually.

The extension should extract the job description when possible. Because job-board layouts vary, the extracted content must be reviewable and editable before saving.

#### Step 2 — Check application history

The extension performs the Supabase query and local folder check concurrently.

The database lookup should use the candidate ID, normalized company key, canonical job URL, and job-description fingerprint where available.

The local lookup should check the candidate's authorized archive directory for the company folder and the matching job package.

The interface should display separate results for:

- Previous company history
- Previous application to the exact job
- Database record existence
- Local archive existence
- Recorded application status

A failed database request or denied filesystem permission must be displayed as an error or unknown state, not as proof that no previous application exists.

#### Step 3 — Display the result

The extension should show a compact result panel.

Example:

**Candidate:** Selected Candidate  
**Company:** Example Company  
**Job:** Senior Data Scientist

| Check | Result |
| --- | --- |
| Company history in database | Found |
| Exact job in database | Not found |
| Candidate company folder | Found |
| Exact local job package | Not found |
| Recorded application status | Previous submissions available |

Available actions:

- Open Previous History
- Open Local Archive
- Save New Bid Package
- Cancel

If an exact job already exists, the extension should warn the user and provide the existing record's status. It must not silently create a duplicate submission.

#### Step 4 — Save the bid package

When the user selects Save New Bid Package, the extension should:

1. Validate the candidate selection and resume JSON.
2. Confirm the target company and job details.
3. Generate a unique bid operation ID.
4. Create the candidate and company directories if necessary.
5. Create a job-specific subfolder.
6. Save the current URL and job description to a text file.
7. Generate and save the resume PDF.
8. Save the original resume JSON.
9. Optionally save the cover letter.
10. Send the resume JSON and bid metadata to Supabase.
11. Record the results of local saving and database synchronization.
12. Copy the saved folder path to the clipboard, if the configured filesystem integration supports it.
13. Display a completion summary.

The extension must not mark an application as submitted merely because the package was saved. The user must explicitly record submission or the system must receive a reliable submission confirmation.

### 24.3 Local directory structure

The user will configure a root archive directory. The extension will create one directory per candidate and one company directory within each candidate directory.

Recommended structure:

```text
Candidate Bid Archive/
└── Candidate Name__CandidateID/
    └── Example Company/
        ├── 2026-10-17_Senior_Data_Scientist/
        │   ├── JobDetails.txt
        │   ├── Resume.pdf
        │   ├── Resume.json
        │   ├── CoverLetter.txt
        │   └── metadata.json
        └── 2026-11-02_Data_Analyst/
            ├── JobDetails.txt
            ├── Resume.pdf
            ├── Resume.json
            └── metadata.json
```

The candidate ID prevents collisions between candidates with identical names. The company folder preserves the requested company-based organization, while the job-specific subfolder prevents multiple applications to the same company from overwriting each other.

Company and candidate directory names must be sanitized for Windows-compatible filenames. The system should retain the original company name separately in the database.

#### JobDetails.txt

This file should contain:

- Target company
- Job title
- Current webpage URL
- Capture timestamp
- Complete captured job description
- Optional job location and job-posting identifier

#### Resume.pdf

The rendered resume produced using the selected resume template and the validated resume JSON.

#### Resume.json

The original structured JSON response used to generate the PDF.

#### CoverLetter.txt

An optional copy of the cover letter associated with the same bid.

#### metadata.json

The metadata file should contain:

- Candidate ID
- Bid ID
- Company key
- Job title
- Canonical job URL
- Job-description fingerprint
- Resume schema version
- Resume template ID and version
- Creation timestamp
- Local archive version
- Synchronization status

Do not store authentication secrets in local metadata files.

### 24.4 Duplicate detection and matching rules

The system must distinguish between company-level history and job-level duplicates.

#### Company-level match

A company-level match exists when the candidate has a previous bid record associated with the normalized company key.

This match is informational and must not automatically block a new bid.

#### Exact job match

An exact job match should be based on the strongest available identifiers:

1. Stable external job-posting ID, when available.
2. Canonicalized job URL.
3. A fingerprint derived from the normalized job description, company, and job title.

A fingerprint is a supporting identifier, not an absolute guarantee that two postings represent the same opportunity.

The application should warn about possible duplicates rather than automatically merging different jobs based only on similar titles or descriptions.

#### Company normalization

Company names should be normalized for matching while preserving their original display values.

Normalization should account for:

- Letter casing
- Leading and trailing whitespace
- Repeated whitespace
- Punctuation differences
- Common legal suffixes, where appropriate

Normalization must not merge unrelated companies simply because their names look similar. A verified company ID or a carefully managed company-alias table is preferable when available.

#### Local directory matching

Use direct lookups for the expected candidate, company, and job directory instead of repeatedly scanning every folder.

The local metadata file should contain the normalized company key and job fingerprint. This helps detect existing packages even when directory names have been sanitized.

### 24.5 Parallel lookup implementation

The database and local filesystem checks should start concurrently.

Conceptual implementation:

```javascript
const [databaseResult, filesystemResult] =
  await Promise.allSettled([
    checkSupabaseHistory(candidateId, companyKey, jobUrl, jdHash),
    checkLocalArchive(candidateDirectory, companyKey, jobFingerprint)
  ]);
```

Each result should be processed independently.

The interface must distinguish:

- Found
- Not found
- Permission required
- Check failed
- Result unknown

A filesystem permission error must not be interpreted as a missing folder. Likewise, a database connection failure must not be interpreted as an empty application history.

The database query should use indexed fields and retrieve only the matching history needed for the check.

### 24.6 Save workflow and idempotency

The save workflow must be safe to retry.

Each operation should have a stable operation ID and an appropriate uniqueness constraint in the database.

The system should prevent:

- Duplicate bid records caused by repeated clicks
- Accidental overwriting of existing local packages
- Multiple document versions being confused
- Repeated database writes when retrying a failed synchronization
- A failed local save being reported as successful

The local file-writing operation and database synchronization must be tracked separately.

If local saving succeeds but database synchronization fails, preserve the files and allow the user to retry synchronization.

If database synchronization succeeds but local saving fails, report the partial success and provide a retry action for the local archive.

Only mark the complete operation as successful when all required operations have succeeded.

### 24.7 Database changes

Extend the existing bid model with the following fields, or create a dedicated bid-archive record linked to the bid.

Suggested fields:

- `candidate_id`
- `company_name`
- `company_key`
- `job_title`
- `job_url`
- `canonical_job_url`
- `job_description`
- `job_description_hash`
- `resume_json`
- `resume_version_id`
- `cover_letter_version_id`
- `bid_status`
- `local_archive_status`
- `local_relative_path`
- `operation_id`
- `created_by`
- `created_at`
- `updated_at`

The `bid_status` and `local_archive_status` must remain separate.

For example, a local package may exist while the application remains a draft. The database must not treat a saved folder as proof that an application was submitted.

Store device-specific filesystem paths locally when possible. A Windows absolute path is not portable across team members' computers and should not be treated as a shared resource location.

### 24.8 Filesystem integration options

#### Option A — User-authorized directory access

The user selects the archive root folder once through the extension's supported setup interface.

The extension uses directory handles to create folders, inspect existing entries, and write files within that authorized root.

The directory handle and associated settings may be stored locally, with permissions checked when the extension needs access.

This is the preferred initial approach if copying a relative archive path is acceptable.

#### Option B — Native Windows helper

If the application requires unrestricted filesystem operations and the exact absolute Windows directory path copied to the clipboard, provide a small local helper application.

The extension communicates with the helper through Chrome Native Messaging.

The helper can perform filesystem operations and return the resulting absolute path after successful completion.

This requires installing the helper on each computer that needs the functionality.

#### Option C — Downloads-directory-only implementation

An alternative is to keep the archive beneath the user's Downloads directory and use the browser's Downloads API to save files into relative subdirectories.

This is simpler for file creation, but the Downloads API is not a reliable substitute for direct filesystem inspection when checking whether arbitrary directories and files currently exist.

The selected implementation must support the actual duplicate-checking and path-copying requirements rather than relying solely on download history.

### 24.9 Keyboard shortcut and context menu

The extension should register the keyboard shortcut through the browser extension Commands API.

The right-click action should use the context-menu selection event to retrieve the highlighted company name.

The shortcut may conflict with browser shortcuts or other extensions. Users should be able to change it through the browser's extension shortcut settings.

When either action is triggered, the extension should open its application-history interface and pass the captured selection, URL, and page context to the lookup workflow.

The shortcut and context menu must invoke the same underlying logic so their behavior remains consistent.

### 24.10 Clipboard behavior

After successful local saving, copy the resulting directory path to the clipboard.

Preferred output:

```text
<ArchiveRoot>\<CandidateFolder>\<CompanyFolder>\<JobFolder>
```

When native filesystem integration is available, this should be the absolute Windows path.

When using a user-authorized directory handle without native integration, copy the logical relative path and display it clearly as a relative path. Do not invent or reconstruct an absolute path that the browser has not exposed.

The clipboard operation must be reported separately from the save operations. If clipboard access fails, retain the saved package and show the path in a selectable field for manual copying.

### 24.11 Permissions and role behavior

The feature must follow the existing candidate and bid permissions.

- **Admin:** Can inspect authorized organization-wide history.
- **Team Leader:** Can inspect history for their team.
- **Team Member:** Can inspect history for assigned candidates.
- **Bidder:** Can inspect and manage history only within authorized bid scope.

Local archives are device-specific. The extension must not assume that one team member can access another person's local directory.

Supabase must enforce authorization independently of the extension's interface.

### 24.12 Acceptance criteria

The feature is complete when:

1. A user can select a company name and trigger the lookup using the keyboard shortcut or context menu.
2. The extension captures the current URL and available job details.
3. Supabase and local filesystem checks execute concurrently.
4. Company-level history and exact-job history are reported separately.
5. Existing packages are detected without scanning the entire archive.
6. A new package can be saved under the selected candidate and company directories.
7. The package includes `JobDetails.txt`, `Resume.pdf`, and `Resume.json`.
8. An optional cover letter is saved when provided.
9. The JSON and associated metadata are synchronized with Supabase.
10. Duplicate operations are prevented or clearly flagged.
11. Partial failures are reported accurately and can be retried.
12. The correct directory path is copied to the clipboard when supported.
13. Existing files are not silently overwritten.
14. Access restrictions are enforced for all user roles.
15. A saved package is not automatically treated as a submitted application.

### 24.13 Implementation priority

Implement this feature after the basic candidate profile, resume JSON validation, PDF generation, authentication, and bid database are available.

The first milestone should support company selection, parallel history checks, and a preview of the proposed save location.

The second milestone should implement local package creation, JSON synchronization, duplicate protection, and clipboard behavior.

The third milestone should add robust recovery, history inspection, and native Windows integration if exact absolute-path copying is required.
