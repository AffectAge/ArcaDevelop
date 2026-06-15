# Glossary

- **Province:** Lightweight map and movement unit. Stores adjacency, terrain, climate, passability, movement cost, and map metadata.
- **State Region / Region:** Main heavy-mechanics unit. Owns population, buildings, construction, resources, economy, colonization, and territorial diplomacy.
- **Owner:** Legal country owner of a region.
- **Controller:** Country currently controlling/occupying a region and receiving its economy.
- **Core:** Historical/legal country claim treated as fundamental to that country.
- **Claim:** Detailed political claim with claimant, type, strength, source, and optional expiry.
- **Scenario:** Complete game setup: map, regions, countries, content, defines, AI, localization, Arcawiki, theme, and assets.
- **Defines:** Scenario-owned balance and pacing configuration, similar to Victoria-style defines.
- **Arcawiki:** Player-facing guide/wiki for mechanics, UI concepts, strategy, and scenario lore.
- **AI Profile:** Scenario-authored AI personality/strategy configuration.
- **Order:** Player or AI request validated by the authoritative server.
- **World Delta:** Compact server-to-client state update with versioning and ACK/replay.
- **Fallback:** Alternate behavior used when normal data/path is missing. Gameplay fallback requires approval; technical safety fallback must be documented.
