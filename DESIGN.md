# Design rules (`ahm/map`)

Shared document (owner only). Source: proposal 010 F (approved by the owner, 2026-11-08) and the owner's 21 requests of that day. Every domain follows these rules in new work; the specs of the tasks 007 to 014 point here. An agent never edits this file: a change is a proposal. Where a number below is marked *start value*, the architect chose it; the owner can change it.

## Rules

1. **Hover and selected styles apply to the element itself only**, never to the children or the siblings of a container. (A row that is hovered or selected changes its own background; its neighbours do not move or change.)
2. **One icon family.** Icons come from `AHM.icons` (INTERFACES.md I-7). An icon-only button has `title` and `aria-label`. Text buttons are only for primary actions: Add note, Save, Cancel, Add layer.
3. **Opening, closing or selecting never moves content that is not part of the change.** Scroll positions are kept; nothing jumps or flickers.
4. **A form shows Save and Cancel only while it is open.** Save stays disabled until the input is valid.
5. **A type is shown as its marker only.** The name of the type is the tooltip (`title`), never a pill or a label next to the marker.
6. **One shadow level, nested radii, short transitions.** One shadow for every raised surface; the radius of an inner element is the radius of its container minus the padding between them; transitions last 120 to 180 ms; `prefers-reduced-motion: reduce` turns all transitions and animations off.
7. **Map: selected = larger marker with a white outline and a soft shadow, no accent colour; hover = about 15% lighter.**

## Numbers for the interface (start values)

| What | Value |
|---|---|
| Shadow (the only level) | `0 2px 8px rgba(0, 0, 0, 0.18)` |
| Radii | card or popup 12 px, control inside it 8 px, small chip 4 px (rule 6: inner = outer minus padding) |
| Transition | 150 ms `ease-out` (allowed range 120 to 180 ms) |
| Reduced motion | `@media (prefers-reduced-motion: reduce) { * { transition: none !important; animation: none !important; } }` |
| Icon size | 16 px in lists and menus, 20 px for the sidebar handle (`AHM.icons.svg(name, size)`) |
| Icon-only button | at least 28 px square in the sidebar, 32 px round on the map menu |

## Numbers for the map look

The map tasks (008, 010, 013) use these; the numbers in a task spec win if they differ.

| What | Value |
|---|---|
| Selected place (rule 7) | drawn about 30% larger (scale 1.3); 2 px white outline; thin dark outer ring (1 px, 50% opacity); soft shadow (the same shadow as above, blurred for the map); no accent colour; above labels and other symbols; changes with a 150 ms transition |
| Hovered place | about 15% lighter (mixed 15% with white); pointer cursor; not applied on top of the selected look |
| Tooltip (name and type) | top centre of the hovered marker, arrow pointing at it, offset = marker radius + 6 px; below the marker when there is no room above; one at a time |
| Clusters | round bubble with the count; places cluster only when they are very close on screen (radius 5 px); none from zoom 12; three size steps (radius 8, 8 and 10 px); neutral dark colour, white count; lighter on hover |
| Point menu (`AHM.map.showMenu`) | compact card (radius 12 px, the one shadow) with an arrow at the point, above it, below when there is no room; round icon-only buttons of 32 px with 16 px icons, 4 px apart; optional title line above the buttons |
| Selected line (start value) | a white casing 2 px wider on each side under the line, plus the shadow |
| Selected area (start value) | a 2 px white outline around the area outline, plus the shadow; the fill is unchanged |
| Hovered line or area (start value) | about 15% lighter, like a place |
| Area name on the map (start value) | 12 px text at the centre of the area, dark text with a 2 px white halo |
