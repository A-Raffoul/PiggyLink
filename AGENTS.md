<claude-mem-context>
# Memory Context

# [SottoLink/main] recent context, 2026-09-25 1:42am GMT+2

Legend: 🎯session 🔴bugfix 🟣feature 🔄refactor ✅change 🔵discovery ⚖️decision 🚨security_alert 🔐security_note
Format: ID TIME TYPE TITLE
Fetch details: get_observations([IDs]) | Search: mem-search skill

Stats: 35 obs (11,791t read) | 502,377t work | 98% savings

### Sep 19, 2026
2331 6:30p 🟣 SottoLink acoustic messaging application implemented end-to-end
2332 " 🔴 TypeScript type mismatches in audio capture and buffer operations resolved
2333 " 🔵 ggwave ultrasound encoding is frequency-agnostic at FFT-bin level
2334 " ✅ ggwave encoding power parameter tuned from 100 to 10
2335 " ✅ Production build validated and bundle size established
2336 8:56p 🟣 Default bundled example audio for ultrasonic transmission
2337 9:00p 🟣 Vercel Analytics integrated for SottoLink page-view tracking
### Sep 20, 2026
2338 10:05p ⚖️ Git bare-mother worktree migration strategy
2339 10:14p ✅ Repository agent instructions committed to main branch
2340 " ⚖️ Feature branch planned for robust communication development
### Sep 24, 2026
2341 8:58p 🔵 SottoLink acoustic demo application behavior analyzed
2342 " ✅ Frontend redesign documentation started
2343 " 🔵 Repository structure and worktree layout confirmed
2344 " ✅ Domain language documented in CONTEXT.md
2345 8:59p ✅ Terminology accuracy locked: "hidden message" replaces "encrypted message"
2346 " ✅ Frontend redesign isolated in git worktree claude-frontend
2347 9:00p ✅ Product renamed to PiggyLink for hackathon demo (on-screen only)
2348 9:03p ⚖️ Orb design locked: animates into waterfall on Start
2349 " 🔵 Audio frequency configuration and waterfall rendering details examined
2350 9:05p ✅ Domain terminology expanded: Channel defined
2351 9:09p ⚖️ Call participants and roles defined; Swisscom branding locked in
2353 9:19p 🟣 Frontend redesign with encoded conversation toggle
2354 " 🟣 Design preview mode for iteration without services
2355 " ⚖️ Presentation format changed to recorded video
2356 " ✅ Documentation updated for recorded video demo flow
S860 Fix frequency waterfall display to always be visible and enlarge text for remote filming of two side-by-side laptops (Sep 24 at 9:27 PM)
2361 10:21p 🟣 Waterfall frequency display for continuous acoustic monitoring
S861 Verify frequency waterfall display and enlarged text rendering in browser preview after implementation (Sep 24 at 10:22 PM)
S862 Verify waterfall frequency display and text sizing across viewport sizes (mobile and desktop) in live preview (Sep 24 at 10:22 PM)
S863 Verify waterfall frequency display and enlarged text rendering by inspecting live preview conversation DOM and visual screenshot (Sep 24 at 10:22 PM)
S864 Comprehensive verification of waterfall display, enlarged text, and responsive layout by toggling preview views and inspecting DOM, metrics, and screenshots (Sep 24 at 10:23 PM)
S865 Redesign frontend visualization for hackathon demo showing AI voice agents exchanging ultrasound-encoded data alongside normal conversation, optimized for recording two laptops side-by-side (Sep 24 at 10:23 PM)
2372 10:29p 🟣 Live spectrum trace and carrier-band highlight added above waterfall
S867 Frontend redesign for PiggyLink hackathon demo—simplify interface and optimize for two-laptop recording visibility (Sep 24 at 10:30 PM)
2381 10:36p 🟣 Simplified frequency visualization to live spectrum only
2382 " 🟣 Large conversation text sizing for two-laptop recording visibility
2383 " 🔴 Resolved TypeScript Float32Array type mismatch in spectrum renderer
S898 Start local dev server for SottoLink Vite project (Sep 24 at 10:37 PM)
### Sep 25, 2026
2395 12:59a 🔵 SottoLink: Browser-only Acoustic Chat via Ultrasonic FSK Protocol
2396 " 🔵 Dev Server Port Permission Error on Port 5173
S923 Deep review of SottoLink customer-support scenario orchestration; conversation not behaving as intended (Sep 25 at 12:59 AM)
2399 1:33a 🔵 Deterministic bug in auto-reply orchestration after scenario completion
2400 " 🔵 parseTurn accepts spoken account disclosure in violation of scenario design
2401 " 🔵 Live demo running older scenario brief different from current codebase
S924 Deep review of SottoLink customer-support scenario orchestration; conversation not behaving as intended; identify deployment vs. code issues (Sep 25 at 1:34 AM)
**Investigated**: Analyzed scenario setup across: auto-reply mechanism (src/main.ts maybeAutoReply function), turn parsing and validation (api/_lib/turn.ts), persona briefs (src/ai/personas.ts), audio encoding specifications, and git history comparing scenario briefs across commits. Created and executed test harnesses to verify maybeAutoReply behavior with controlled inputs. Reviewed live demo behavior report from user (hello/ok exchange instead of Trusted Admin prompt).

**Learned**: Three distinct issues identified: (1) maybeAutoReply bug—generates extra agent turn after "done" signal instead of stopping, confirmed by test showing "expected 0 next turns, got 1"; (2) parseTurn validation gap—accepts account PIN disclosures in spoken channel when scenario design restricts them to hidden encoded channel only; (3) deployment staleness—live demo exhibits hello/ok brief while current codebase has Trusted Admin first-prompt, suggesting outdated build or persisted Custom role override. Scenario intentionally includes naive trust of hidden-channel requests as deliberate security demo weakness.

**Completed**: Comprehensive code-path analysis identifying exact functions and behaviors. Test coverage created for scenario validation. Root causes isolated for all three issues. Confirmed auto-reply bug is deterministic.

**Next Steps**: Inspecting open Chrome tabs to retrieve deployed URL and build label shown on live demo page, which will determine whether issue is stale deployment (requiring redeploy) or persisted Custom role (requiring state reset).


Access 502k tokens of past work via get_observations([IDs]) or mem-search skill.
</claude-mem-context>