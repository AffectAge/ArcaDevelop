# Country Control And AI

Scenarios define ready-made countries in:

```text
scenarios/<scenario_id>/history/countries/<country_id>.json
```

## Country File

Example:

```json
{
  "id": "country:bohemia",
  "nameKey": "country.bohemia.name",
  "color": "#b91c1c",
  "flagUrl": "assets/uploads/flags/bohemia.png",
  "crestUrl": "assets/uploads/crests/bohemia.png",
  "capitalRegionId": "region:bohemia",
  "controlMode": "open",
  "aiProfileId": "ai_personality:balanced",
  "resources": {
    "ducats": 1000,
    "gold": 0,
    "power": 0,
    "science": 0,
    "culture": 0,
    "religion": 0,
    "construction": 0,
    "colonization": 0
  }
}
```

## Control Modes

- `player`: controlled by a player.
- `ai`: controlled by game AI.
- `open`: available for player selection or later assignment.

Countries may start without any regions.

Scenario country files may define player-facing metadata and starting resources, but must not define admin/security fields such as `isAdmin`, `password`, or `passwordHash`. Runtime creates scenario countries as non-admin records; existing admin status is preserved only through server-side administration.

Country `color` is required as `#RRGGBB`. `nameKey` is resolved through scenario localization. Scenario application creates landless country runtime state when needed, even if the country owns no region.

AI-controlled countries are treated as online and turn-ready by the server turn-status and resolve gating flows. This keeps unattended AI countries from blocking turn advancement while still requiring their gameplay actions to pass through the normal validated order pipeline.

## Switching Control

Admins can switch control mode. Scenario defines may enable automatic temporary AI takeover after missed turns or offline time.

Switching player <-> AI must:

- clear current orders/plans,
- be audit-logged,
- emit the necessary state update/resync,
- preserve country identity, assets, and historical state.

## Zero-Territory Countries

All country systems must handle landless countries:

- no owned regions,
- no capital region,
- no population,
- no production,
- no regional taxes,
- limited or disabled region-dependent actions,
- clear UI empty states.
