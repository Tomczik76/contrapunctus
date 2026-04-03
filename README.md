# Contrapunctus

A music theory education platform for practicing four-part (SATB) harmonization and roman numeral analysis. Students complete lessons where they harmonize given melodies or realize figured bass, and the app checks their work for part-writing errors and correct roman numeral labels. Educators can create classes, author custom lessons, and grade student submissions.

## Tech Stack

- **Frontend**: React 19 + TypeScript, Vite, React Router, Tone.js (audio playback)
- **Backend**: Scala 3, http4s (HTTP server), Circe (JSON), Skunk (PostgreSQL), Flyway (migrations)
- **Database**: PostgreSQL (via Podman/Docker Compose)
- **Shared**: Scala.js cross-compiled core module (cats, droste)
- **Auth**: JWT-based (jbcrypt for password hashing, java-jwt for tokens), Google OAuth (GSI)
- **Email**: AWS SES (password reset emails)
- **Infra**: AWS ECS Fargate, S3 + CloudFront, RDS PostgreSQL

## Project Structure

```
contrapunctus/
├── frontend/                   # React SPA
│   └── src/
│       ├── main.tsx            # App entry, routes, ProtectedRoute/PublicOnly wrappers
│       ├── auth.tsx            # AuthProvider context, JWT auth, Google OAuth, API_BASE constant
│       ├── data/
│       │   └── lessons.ts      # Lesson type definition, fetchLessons/fetchLesson API calls
│       └── components/
│           ├── staff/          # Music notation editor (see below)
│           ├── AdminPage.tsx   # Lesson CRUD admin interface
│           ├── AuthPages.tsx   # Login/Signup forms with Google Sign-In
│           ├── ForgotPasswordPage.tsx  # Forgot password email form
│           ├── ResetPasswordPage.tsx   # Password reset form (token from email)
│           ├── Dashboard.tsx           # User home page
│           ├── LandingPage.tsx         # Public landing page
│           ├── LessonPage.tsx          # Student lesson view with checking/grading
│           ├── LessonList.tsx          # Lesson browser
│           ├── CommunityPage.tsx       # Community exercises browser and creation
│           ├── CommunityExercisePage.tsx # Solve community exercises
│           ├── EducatorDashboard.tsx    # Educator classes and lessons management
│           ├── EducatorLessonEditor.tsx # Educator lesson authoring
│           ├── EducatorGradePage.tsx    # Grade student submissions
│           ├── ClassDetailPage.tsx      # Educator class detail (students, assignments)
│           ├── StudentClassPage.tsx     # Student view of an enrolled class
│           ├── ClassLessonPage.tsx      # Student working on a class assignment
│           └── JoinPage.tsx            # Join a class via invite link
├── backend/
│   └── src/main/scala/contrapunctus/backend/
│       ├── Main.scala          # Entry point
│       ├── Server.scala        # http4s server assembly, route composition
│       ├── Config.scala        # PureConfig app configuration
│       ├── domain/             # Case classes: User, Lesson, BugReport, FeatureRequest
│       ├── db/                 # Skunk queries and DB layer (Database, Migrations, etc.)
│       ├── services/           # Business logic layer
│       └── routes/             # http4s route definitions
├── shared/                     # Scala.js cross-compiled core module (see below)
├── build.sbt                   # sbt build with backend + cross-compiled core
├── dev.sh                      # Dev script: starts Postgres, builds Scala.js, runs backend + frontend
├── dev.conf                    # Local dev configuration
├── docker-compose.yml          # PostgreSQL container
└── scripts/
    ├── deploy.sh               # Full deploy: backend + frontend + cutover
    ├── deploy-backend.sh       # Build Docker image, push to ECR, deploy to inactive slot
    ├── deploy-frontend.sh      # Build Vite, sync to S3 inactive slot prefix
    ├── cutover.sh              # Switch live traffic to the inactive slot
    └── rollback.sh             # Revert to the previous slot
```

## The Shared Music Theory Engine

The `shared/` directory is a Scala.js cross-compiled module containing the core music theory domain model. It compiles to both JVM (used by the backend) and JS (available to the frontend). The sbt project names are `coreJVM` and `coreJS`.

### Running tests

```bash
sbt coreJVM/test                        # Run all shared module tests
sbt 'coreJVM/testOnly *ChordSuite'      # Run a specific suite
```

### Package structure

```
shared/src/main/scala/io/github/tomczik76/contrapunctus/
├── core/
│   ├── Note.scala         # NoteType enum (all chromatic pitches with enharmonics), Note case class (pitch + octave → MIDI)
│   ├── Interval.scala     # Interval enum (unison through double octave), inversion, normalization
│   ├── Scale.scala        # Scale enum (major, minor, modes), spelling-aware altered scale degree analysis
│   └── ScaleDegree.scala  # ScaleDegree enum (I–VII), Alteration enum (𝄫 to 𝄪), AlteredScaleDegree
├── harmony/
│   ├── Chord.scala        # Chord case class (root + chord type), chord tone detection, fromNotes identification
│   └── ChordType.scala    # ChordType trait hierarchy, chord groups (Triads, Sevenths, Ninths, etc.), inversion system
├── rhythm/
│   ├── Pulse.scala        # Recursive Pulse[A] tree (Atom/Rest/Duplet/Triplet/Quintuplet/Septuplet), flatten, timed, align
│   ├── Rational.scala     # Exact fractional arithmetic for time positions (avoids floating-point)
│   └── Sounding.scala     # Attack vs. Sustain enum for tied notes
├── analysis/
│   ├── Analysis.scala     # Harmonic analysis: chord identification, roman numerals, secondary dominants, augmented sixths
│   ├── PartWriting.scala  # Part-writing validation: parallels, direct motion, voice crossing, spacing, doubling, resolution
│   └── NonChordTone.scala # Non-chord tone classification (passing, neighbor, suspension, appoggiatura, etc.)
└── notation/
    └── StaffPrinter.scala # Text-based staff rendering (legacy, unused by frontend)
```

### Key domain concepts

- **NoteType**: Enum of all chromatic pitch classes including enharmonic spellings (C, C#, Db, etc.). Equality is by pitch class value, so `C# == Db`. The `letterIndex` method gives the base letter (C=0 through B=6) for spelling-aware analysis.
- **Interval**: Enum with `value` (semitones), `normalizedValue` (mod 12), and `invert`. The `Interval.apply(Int)` factory returns canonical intervals only (e.g., value 6 → `Tritone`, not `DiminishedFifth`).
- **ChordType hierarchy**: `ChordType` (sealed trait) → `BaseChordType` → `InvertibleChordType` (trait with `Inversions` inner enum). Each chord group (e.g., `Triads`, `Sevenths`) defines case objects extending `InvertibleChordType`. Inversions are generated via `ChordType.invert` which rotates the interval list.
- **Pulse[A]**: A recursive tree representing rhythmic subdivision. `Atom(NonEmptyList[A])` holds note data, `Rest` is silence, and `Duplet`/`Triplet`/etc. subdivide time. `Pulse.align` synchronizes multiple voices into `AlignedColumn`s at shared time points using `Rational` arithmetic.
- **Scale.alteredScaleDegree**: Uses note letter names (not just pitch class) to disambiguate enharmonic spellings. E.g., Ab in C Major → bVI (letter A, degree 6, flat), while G# → #V (letter G, degree 5, sharp).

## The `staff/` Module

The interactive music notation editor lives in `frontend/src/components/staff/`. It renders SVG-based grand staves and handles note input, playback, part-writing error detection, and roman numeral analysis.

### Files (dependency order)

| File | Purpose |
|---|---|
| `types.ts` | All shared TypeScript types: `Duration`, `Accidental`, `PlacedNote`, `PlacedBeat`, `LessonErrorItem`, `LessonConfig`, `NoteEditorProps` |
| `constants.ts` | Layout constants: staff spacing, beat width, margins, stem dimensions |
| `glyphs.ts` | SVG path data for clefs, noteheads, flags, rests, time signature digits |
| `musicTheory.ts` | Pitch helpers, key signature data, beat/measure math, duration values, enharmonic handling |
| `GrandStaff.tsx` | Read-only SVG grand staff renderer with sub-components (StaffLines, GlyphClef, TimeSignature, NoteHead) |
| `NoteIcon.tsx` | Duration picker icon component used in the toolbar |
| `romanNumeral.tsx` | Roman numeral parsing/rendering (`FormattedRn`), figured bass input (`FbEditInput`), student RN input (`RnInput`), RN legend |
| `NoteEditor.tsx` | Main interactive editor (~3000 lines). Handles note placement, selection, playback, part-writing checks, lesson mode. This is the core component. |
| `index.ts` | Barrel re-exports for the public API |

### Key Architecture Patterns

- **SVG rendering**: All notation is drawn as SVG paths/elements. HTML inputs (roman numerals, figured bass) are embedded via `<foreignObject>`.
- **Lesson mode** (`LessonConfig` prop): Locks certain staves (e.g., soprano melody is read-only), enables part-writing error checking, shows roman numeral inputs.
- **Callbacks for parent state**: `onErrorsComputed`, `onRomansComputed`, `onStudentRomansChanged`, `onBeatsChanged` let the parent (`LessonPage`) access internal editor state for grading.
- **Embedded mode**: When `onTrebleBeatsChanged` or `onBassBeatsChanged` props are provided, the editor skips localStorage persistence and operates as a controlled sub-editor (used in `AdminPage`).
- **Blur-commit inputs**: `FbEditInput` uses local state while typing and only validates/commits on blur or Enter, allowing intermediate states like trailing commas.

## Lesson Templates

### `harmonize_melody`
- Soprano melody is pre-filled and locked on the treble staff
- Student adds alto (treble staff), tenor, and bass (bass staff)
- Student enters roman numeral analysis below the staff

### `figured_bass`
- Bass line is pre-filled and locked on the bass staff with figured bass numbers displayed
- Student adds soprano and alto (treble staff) and tenor (bass staff)
- Student enters roman numeral analysis below the staff

## Lesson Data Model

```typescript
interface Lesson {
  id: string;
  title: string;
  description: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  template: "harmonize_melody" | "figured_bass";
  tonicIdx: number;       // Index into TONIC_OPTIONS (0 = C)
  scaleName: string;      // e.g., "major", "minor"
  tsTop: number;          // Time signature numerator
  tsBottom: number;       // Time signature denominator
  sopranoBeats: PlacedBeat[];   // Pre-filled soprano (harmonize_melody)
  bassBeats?: PlacedBeat[];     // Pre-filled bass (figured_bass)
  figuredBass?: string[][];     // Figures per beat, e.g., [["6","4"], [], ["6"]]
  sortOrder: number;
}
```

## Database Migrations

Migrations live in `backend/src/main/resources/db/migration/` and are run by Flyway on startup:

- `V1` — users table
- `V2` — bug reports
- `V3` — feature requests
- `V4` — roadmap votes
- `V5` — lessons table (core fields + soprano_beats JSONB)
- `V6` — adds bass_beats and figured_bass JSONB columns to lessons
- `V7` — educator feature: is_educator flag, classes, enrollments, educator_lessons, class_lesson_assignments, student_lesson_attempts
- `V8` — adds sort_order to class_lesson_assignments
- `V9` — student_lesson_work (single save/submit model replacing multi-attempt)
- `V10` — analysis_corrections and correction_votes
- `V11` — community exercises, exercise_attempts, exercise_votes, point_events, user points/streaks/ranks
- `V12` — OAuth support: nullable password_hash, password_reset_tokens, auth_providers

## Development

```bash
./dev.sh   # Starts Postgres, builds Scala.js, runs backend (8080) + frontend (5173)
```

Requires: sbt, Node.js/npm, Podman (or Docker with compose).

## Blue-Green Deployment

The application uses blue-green deployments for zero-downtime releases with instant rollback. Two slots (`blue` and `green`) exist for both the frontend (S3 prefixes) and backend (ECS services + ALB target groups). A CloudFront Function routes S3 requests to the active slot prefix, and the ALB listener rule forwards to the active target group. Only the active slot runs containers; the inactive slot is scaled to zero between deploys.

### Deploy

```bash
# Full deploy (backend + frontend + cutover)
scripts/deploy.sh

# Or deploy individually, then cut over
scripts/deploy-backend.sh       # Builds, pushes image, deploys to inactive slot
scripts/deploy-frontend.sh      # Builds, syncs to inactive slot S3 prefix
scripts/cutover.sh              # Switches live traffic to the new slot
```

Pass `--skipTests` to skip test suites during build.

### Rollback

```bash
scripts/rollback.sh    # Instantly reverts to the previous slot
```

Rollback works because old frontend assets remain in S3 at their prefix, and the old backend service stays running for a grace period after cutover. If the old service has already been scaled down, the rollback script will scale it back up and wait for it to stabilize before switching traffic.

### How it works

1. `deploy-backend.sh` / `deploy-frontend.sh` build and deploy to the **inactive** slot
2. `cutover.sh` runs `tofu apply -var="active_slot={new_slot}"` which updates both:
   - The CloudFront Function (rewrites S3 URIs to the new prefix) — propagates globally in <1 second
   - The ALB listener rule (points to the new target group)
3. After cutover, keep both slots running for ~30 minutes before scaling down the old one

### Migration from non-blue-green

If migrating from the previous single-service setup, see the infra repo for state migration instructions (`tofu state mv` commands and S3 content migration).

## Routes

| Path | Component | Auth |
|---|---|---|
| `/landing` | LandingPage | Public only |
| `/signup` | SignupPage | Public only |
| `/login` | LoginPage | Public only |
| `/forgot-password` | ForgotPasswordPage | Public only |
| `/reset-password` | ResetPasswordPage | Public only |
| `/` | Dashboard | Protected |
| `/editor` | NoteEditor (sandbox) | Protected |
| `/lessons` | LessonList | Protected |
| `/lessons/:id` | LessonPage | Protected |
| `/community` | CommunityPage | Protected |
| `/community/:id` | CommunityExercisePage | Protected |
| `/classes/:classId` | StudentClassPage | Protected |
| `/classes/:classId/lessons/:lessonId` | ClassLessonPage | Protected |
| `/educator` | EducatorDashboard (classes) | Protected |
| `/educator/classes` | EducatorDashboard (classes) | Protected |
| `/educator/classes/:classId` | ClassDetailPage | Protected |
| `/educator/lessons` | EducatorDashboard (lessons) | Protected |
| `/educator/lessons/new` | EducatorLessonEditor | Protected |
| `/educator/lessons/:lessonId/edit` | EducatorLessonEditor | Protected |
| `/educator/classes/:classId/students/:studentId/lessons/:lessonId/grade` | EducatorGradePage | Protected |
| `/join/:inviteCode` | JoinPage | None |
| `/admin` | AdminPage | None |
