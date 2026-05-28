<overview>
Animation UX principles specific to mobile app flows: progressive disclosure, tray systems, fluidity patterns, and multi-step transitions.

For general animation philosophy (when to animate, purpose of motion, frequency decisions, easing theory, component patterns), see the `emil-design-eng` skill.
</overview>

<core_philosophy>
Three guiding principles:

- **Simplicity:** Hide complexity until needed. Accessible by default.
- **Fluidity:** Maintain continuity through seamless transitions. Users are never lost.
- **Delight:** Foster meaningful emotional connections. Make software feel human.

This respects the user's time, intelligence, and experience.
</core_philosophy>

<simplicity_progressive_disclosure>
Make complex products accessible without sacrificing depth:

- Put fundamentals at users' fingertips
- Everything else appears as it becomes most relevant
- Distill overwhelming actions into manageable interactions
- The compact nature of each step signals approachability

**The Room Metaphor:**
> "Imagine seeing parts of a room through an open doorway. From a few metres away, you catch a glimpse of what's inside. As you approach and enter, the space and its contents are gradually revealed."

Each user action makes the interface unfold. Users see where they're going as they go there.
</simplicity_progressive_disclosure>

<dynamic_tray_system>
Components housed within trays that expand, contract, and adapt:

**Tray Rules:**
- **User-initiated:** Trays appear from tapping buttons, icons, or opening notifications
- **Height variation:** Each subsequent tray varies in height to make progression clear
- **Single focus:** Each tray is dedicated to one piece of content or one primary action
- **Title + dismiss:** Every tray has a title capturing its function and an icon for dismissal
- **Context preservation:** Trays overlay content onto the current interface—users aren't veering off course

**When to Use Trays vs Full Screens:**
- Use trays for transient actions that don't need permanent display
- Especially helpful for confirmation steps and warnings at the right time
- Trays can serve as starting points for flows that transition to full screen
</dynamic_tray_system>

<fluidity_transitions>
A fluid interface feels like moving through water—you float rather than walk.

**Patterns for Fluidity:**
- **Directional awareness:** Switching tabs → transition moves in tab direction. "We fly instead of teleport."
- **Icon transformations:** Transform chevrons during flows (e.g., chevron → back arrow)
- **Text morphing:** Visually morph button labels (Continue → Confirm) using shared letters

**Anti-Redundancy Principle:**
> "If a component is visible and will persist in the next phase, it should remain consistent."

Components should "travel" between screens rather than disappear and reappear. Examples:
- Cards move seamlessly between screens
- Empty states keep unchanged text constant
- Same element animates into its new position rather than fading out/in
</fluidity_transitions>

<trust_through_motion>
> "When my banking app displays a glitchy animation while accessing my checking account, it erodes my trust."

Consistent, smooth interactions communicate: "I know exactly what you need—let me get that for you..."
</trust_through_motion>

<multi_step_flow_design>
1. Map all potential paths before designing
2. Vary tray heights to make step progression clear
3. Keep each step singularly focused on one content piece or action
4. Preserve context by overlaying rather than replacing
5. Use motion to show direction and relationship between steps
</multi_step_flow_design>

<transition_checklist>
- Does this transition show where the user came from?
- Does it show where they're going?
- Are persistent elements traveling smoothly (not duplicating)?
- Is there directional awareness?
- Could text labels morph rather than switch instantly?
</transition_checklist>

<delight_audit>
When implementing a feature, ask:

1. How frequently will users encounter this?
2. What's the appropriate intensity of delight?
3. Is there an opportunity for surprise/discovery?
4. Does this feel human and responsive?
5. Is the rest of the app polished enough to support this moment?
</delight_audit>
