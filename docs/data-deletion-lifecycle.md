# Data Deletion Lifecycle

Every major entity needs an ownership and cleanup policy.

## Required Lifecycle Fields

For each entity define:

- owner,
- inbound references,
- outbound references,
- owned assets/files,
- delete behavior,
- audit behavior,
- world delta or resync behavior,
- tests.

## Important Entities

- Country.
- Region.
- Province metadata.
- Market.
- Building.
- Army/division/template.
- Diplomacy proposal/treaty.
- Event/notification.
- Uploaded file.
- Scenario.
- Arcawiki entry.
- Content entry.
- Localization key.
- AI profile/plan.

## Country Deletion

Country deletion must clean or reassign all country-owned data and references, including orders, diplomacy, markets, armies, events, uploaded flag/crest files, AI plans, and scenario-scoped assets.

Server country deletion must build a non-destructive cleanup plan before mutating state. The plan should include resources, owned provinces, colonization progress, construction queues, diplomacy proposals, divisions/templates, military queues, orders, resolve-ready state, country event/decision/technology/parliament entries, and uploaded flag/crest assets.

Admin country deletion must expose a preview endpoint before mutation and return the cleanup plan after deletion. Scenario cleanup work should reuse the same plan before deleting countries that are absent from a newly applied scenario.
