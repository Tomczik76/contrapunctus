- Add chord dictionary and suggestions of chords
- Interval training
- Scales
- Counterpoint analysis
- New project
- Save to Server
- Export Midi
- Transforms to change modes 
- AI asstant

Here's my evaluation of the music theory engine in shared/:

Current Strengths

The engine is solid for its core use case (SATB part-writing education):
- Pitch system: 35 enharmonic spellings with spelling-aware analysis
- ~50 chord types with automatic inversion generation across 8 groups
- 9 NCT classifications (passing, neighbor, suspension, etc.) with melodic context
- Part-writing validation: parallels, voice crossing, spacing, doubling, resolution rules
- Roman numeral analysis: secondary dominants, Neapolitan, augmented sixths
- Rhythmic alignment: exact fractional arithmetic via Rational, multi-voice sync via Pulse.align
- Test coverage: 400+ tests across the engine

Key Gaps

High Priority (directly affects the education use case)

1. No modal interchange / borrowed chords — Can't identify chords borrowed from the parallel mode (e.g., iv in a major key). This is standard theory curriculum material.
2. No modulation / pivot chord detection — The engine analyzes everything in one key. Can't identify tonicizations beyond secondary dominants or detect pivot chords at modulation boundaries.
3. No species counterpoint rules — Given the app is literally named "Contrapunctus," the absence of counterpoint-specific validation (parallel motion restrictions per species, cantus firmus rules,     
   etc.) is a notable gap.
4. No voice range constraints — No enforcement that soprano/alto/tenor/bass stay within their standard ranges. This is a basic part-writing rule that's currently unchecked.
5. No augmented second detection — Melodic augmented seconds (common pitfall in minor keys, e.g., Ab→B in C minor) are not flagged as part-writing errors.

Medium Priority (theory completeness)

6. No chromatic mediant recognition — Third-related chords (e.g., C major → E major) are common in Romantic harmony but aren't classified.
7. Limited NCT disambiguation — When multiple NCT patterns match the same notes, the engine picks one without ranking. A passing tone and appoggiatura can sometimes look identical depending on context.
8. No double passing tones — Only single passing tones between chord tones are detected.
9. Part-writing rules are one-size-fits-all — No style/era options. Renaissance counterpoint has different rules than common-practice harmony.
10. Scales limited to diatonic modes — No pentatonic, blues, whole-tone, or octatonic scales.

Lower Priority (nice-to-haves)

11. No MusicXML/Lilypond export — Can't import or export to standard notation formats.
12. No voice-leading optimization — Can't suggest smooth voice leading for a given progression.
13. No harmonic function labeling — Chords are labeled by degree but not by function (tonic/predominant/dominant).
14. StaffPrinter is dead code — 1 test, unused by frontend. Candidate for removal.

Testing Gaps

15. No property-based tests — Given the CLAUDE.md preference for ScalaCheck, the engine would benefit from property-based tests for chord identification (e.g., "for any valid SATB voicing of chord X,  
    fromNotes should identify X").
16. Edge cases in alteredScaleDegree — Enharmonic boundary cases (e.g., E# in F major) have limited coverage.

Technical Debt

- NoteType.alteration field is declared but unused
- Voice inference uses greedy nearest-match (not globally optimal)
- Chord identification heuristics (prefer non-sus, prefer triads) feel brittle

Recommended Focus

Given this is an education platform named Contrapunctus, I'd prioritize: species counterpoint rules (#3), voice range constraints (#4), modal interchange (#1), and property-based tests (#15). These    
directly serve the pedagogical mission and would make the checking engine meaningfully more useful for students.

Want me to dive deeper into any of these gaps or start implementing one?                                                                                                                                 
   
