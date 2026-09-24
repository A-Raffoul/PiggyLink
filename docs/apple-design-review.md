# Apple Design review — PiggyLink

## Subsequent user correction

The user rejected separate channel histories after this review. The latest UI
has one scrolling conversation, with each turn's spoken text and encoded
counterpart joined horizontally beneath a single sender/delivery label. On
phones the pair stacks inside the same message. Large current captions now
fade after four seconds; the spectrum and persistent history remain in place.
Keyboard focus pauses the caption timer, and Stop/clear dismiss it. This
explicit presentation requirement supersedes this review's persistent-caption
and separate-history recommendations below.

## Summary

Scope: a Vite/TypeScript web demo, filmed on two adjacent laptops for a jury with no prior context. The screen's job is to connect the audible conversation to the encoded exchange. Its signature is the crisp orb unfolding into a frequency trace.

Post-pass rating: **Good** within the browser verification below. This pass applies the [Apple Design skill](https://github.com/dickwu/apple-design-skill) to web accessibility and visual craft; native macOS menus, materials, and navigation conventions do not apply. Keep the explicitly requested light/dark switch, bounded spectrum, local/remote direction, and compact history. No glow, waterfall, or selected frequency band.

## Plan before implementation

### Color roles

Retain the existing semantic palette. Contrast uses WCAG relative luminance against each page surface; these are measured hex values, not screenshot estimates.

| Role      | Dark      | Contrast | Light     | Contrast |
| --------- | --------- | -------- | --------- | -------- |
| Surface   | `#07060e` | —        | `#faf8fb` | —        |
| Content   | `#ede8f2` | 16.73:1  | `#282331` | 14.46:1  |
| Secondary | `#aaa1b9` | 8.17:1   | `#685e76` | 5.76:1   |
| Spoken    | `#6fc3ff` | 10.49:1  | `#175b92` | 6.75:1   |
| Encoded   | `#ff5c85` | 6.84:1   | `#b9234c` | 5.84:1   |
| Trace     | `#d63862` | 4.42:1   | `#d63862` | 4.32:1   |

The trace uses one color that clears 3:1 in both appearances. Log text against its filled bubble is 9.66:1 / 7.37:1 for spoken and 7.09:1 / 6.25:1 for encoded (dark / light).

### Type and spacing

Use `system-ui` for content and controls, with the existing Avenir brand wordmark and monospace only for encoded log data and frequency values. Use rem-based roles: 13px metadata, 16px controls/body, 20px history, 28–40px current message at a 16px browser default. Current encoded content uses the same size as spoken content. Use 8/12/16/24/32px spacing and 44px minimum control targets as web design choices, not a claim that native points equal CSS pixels.

### Layout

The current exchange leads, the bounded graph connects it to sound, and scrollable history stays subordinate. Short windows reduce graph/history height; narrow or very short windows flow vertically.

```text
Regular                            Compact
Brand           Help Theme Setup   Brand    Theme Setup
Role · status       Encoded Stop    Help
                                   Role · status
Me · sent                          Encoded         Stop
Spoken              Encoded         Me · sent
Current message     Current data    Spoken / current message
                                   Encoded / current data
       Frequency trace             Frequency trace
       0                24 kHz      0                24 kHz
Conversation log     Encoded log    Conversation log
                                   Encoded log
```

The orb-to-trace transformation stays the one defining transition, shortened to 800ms with reduced-motion support. This is specific to an acoustic demo: the same curve becomes the instrument that explains the exchange. It does not need a new decorative card, gradient, or glass layer.

## Critical — addressed in this pass

- **Keyboard access:** scrollable current text and logs lacked explicit keyboard focus targets. `accessibility.md › Speech`: “use the keyboard alone”. Add focusable, named scroll regions and visible focus rings.
- **Switch contrast:** in light mode the off-state knob (`#ede8f2`) against its track (`#d3cadb`) measured 1.32:1. `accessibility.md › Vision`: “Strive to meet color contrast minimum standards.” Change the light off-track to `#82748f`: 3.60:1 against the knob and 4.11:1 against the page.

## Improvements

- **High — short-window framing:** the old 630px minimum chat height plus the header cropped history on short laptop windows. `layout.md › Adaptability`: “Design a layout that adapts gracefully and consistently.” Allocate smaller graph/history rows in short windows; retain all content via scrolling at narrow sizes and browser zoom.
- **Medium — type hierarchy:** setup labels were 11px and some explanatory text 10px; the interface also mixed many one-off sizes. `typography.md › Conveying hierarchy`: “Minimize the number of typefaces”. Use explicit rem roles, comfortable 16px form text, and 13–14px supporting text. Current messages remain much larger than history.
- **Medium — controls:** icon targets were 36px and dialog close targets 30px. `buttons.md › Best practices`: “Make buttons easy for people to use.” Use 44px targets, consistent hover/press/focus feedback, and familiar native buttons/selects/dialogs.
- **Medium — appearance preferences:** add increased-contrast, forced-colors, and reduced-transparency treatments. `color.md › Best practices`: “light, dark, and increased contrast contexts.” Keep the user's explicit appearance toggle; don't impose the native-app no-toggle convention on this web demo.
- **Low — motion:** `motion.md › Providing feedback`: “Aim for brevity and precision”. Shorten the orb transition from 1100ms to 800ms. Live spectrum movement remains data, not decoration.

## Craft notes

Remove the decorative channel glyphs, the static frequency dot, and the external-link-style arrow on the in-page explanation button. This is editorial judgment, informed by `design-principles.md › Simplicity`: “Include just what’s necessary.” Keep words that communicate direction and delivery; they have a job in a two-laptop recording.

## What works

The 760px spectrum cap prevents a wide display from making the instrument dominate. The paired current messages reveal the relationship between spoken and encoded content. “Me” / “Other laptop”, arrows, and left/right bubble alignment communicate direction without relying on color. Preview data is explicitly labeled.

## Sources and verification

Read the skill plus its `cross-platform.md` and HIG references for accessibility, layout, typography, color, designing for macOS, buttons, dark mode, motion, writing, and design principles. File and heading citations above refer to the [skill's reference directory](https://github.com/dickwu/apple-design-skill/tree/main/references/hig), whose files link to the original Apple HIG pages. Design dimensions and palette choices are this project's decisions.

Verified on September 24, 2026:

- Production build and TypeScript checks pass; all 63 existing tests pass. The build retains the existing ggwave `fs` / `path` externalization warnings.
- Light/dark appearance and Encoded on/off checked in the browser. Revealing pairs the current spoken and encoded messages; hiding removes both encoded areas while preserving the spectrum.
- At measured browser viewports of 1076×605 and 1344×840, the chat fits without page overflow and the spectrum stays at 760px. At approximately 320px wide, content stacks with no horizontal overflow.
- Tab reaches current content and both history lists. Keyboard Home scrolls history to its start and focus is visible. Setup opens with focus inside; Escape closes it and restores focus to Setup.
- Setup controls measure 44×44px; supporting text and fields use the new rem scale. Hex contrast checks appear above.
- Reduced motion remains implemented in the orb and CSS. Reduced transparency, increased contrast, and forced colors were reviewed in code; OS preference combinations, a screen reader session, and actual 200% text enlargement were not exercised in this browser pass.

This is not a full accessibility certification. The remaining design judgment is readability in the actual camera framing; two-laptop acoustic reliability also needs device testing.

## Subsequent user corrections — September 25

The current implementation supersedes the separate logs in the diagram above:
one history pairs spoken and encoded text within each turn. Captions expire after
four seconds. Sender labels are This device / Other device, with Voice for speech
whose source has no encoded device identity. On phones the caption overlays a
fixed-height graph area, then disappears; the header stays on one row. The Encoded
switch explicitly hides captions, message cells, and captured fields. Spoken-only
turns have no encoded cell at all.

Follow-up browser checks covered 320×568, 390×844, 430×933, and 1280×800 with no
horizontal overflow. The 390 px view fits the graph and history without the old
empty caption area. At 320×568, vertical scrolling remains available. Setup fits
within the phone viewport, and both appearance modes were inspected. The full
suite now has 72 passing tests. Actual iPhone audio capture and service round
trips remain outside these responsive layout checks.

The next user iteration keeps each bubble's appearance identical in both modes:
Encoded adds a labelled line below the spoken text, using the same background and
font family. Both history and current caption now stack these parts. History has
no internal height cap; the page grows with the conversation. Revealing content
does not scroll to the end or shrink the spoken text's width. This supersedes the
horizontal-pair and fixed-height history decisions above.
