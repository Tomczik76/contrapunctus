Always read README.md at the start of every conversation before responding to the first prompt.

Always write tests for new code and changes. Prefer testcontainers for integration tests and ScalaCheck for property-based tests.

Prefer pure functional programming in Scala code. Side effects are acceptable but must not leak outside of public functions.

Make invalid states unrepresentable in domain models. Use the type system to enforce invariants at compile time rather than runtime validation.

All exercise scoring must happen on the backend. Never trust client-submitted scores. The backend uses `ExerciseScoring.score` to compute scores from the saved attempt data using the shared analysis engine.
