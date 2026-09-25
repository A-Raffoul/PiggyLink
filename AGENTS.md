<claude-mem-context>
# Memory Context

# [SottoLink/main] recent context, 2026-09-25 12:44pm GMT+2

Legend: 🎯session 🔴bugfix 🟣feature 🔄refactor ✅change 🔵discovery ⚖️decision 🚨security_alert 🔐security_note
Format: ID TIME TYPE TITLE
Fetch details: get_observations([IDs]) | Search: mem-search skill

Stats: 50 obs (15,188t read) | 523,836t work | 97% savings

### Sep 25, 2026
2404 8:50a ✅ Updated test suite to verify deterministic script-based demo message sequencing
2405 " ✅ Fixed test imports and verified all tests pass with new deterministic demo implementation
2428 9:15a 🔵 Demo timing sources identified in audio transcription flow
2429 " 🔵 10-second channel-clear timeout identified as major demo bottleneck
2430 " 🔵 Speech detection timing pipeline adds secondary delays: 900ms silence detection and polling overhead
2431 9:17a 🔵 Preview mode flag exists but may not fully optimize demo timing; TTS synthesis and audio decoding identified as potential delays
2432 9:18a 🔵 Demo execution flow mapped: waitForClearChannel 10-second delay triggered per spoken turn in sendSpokenTurn()
2433 " 🟣 Pre-scripted spoken lines added to eliminate TTS synthesis and transcription delays in demo
2434 9:19a ✅ Engine interface extended with optional maxWaitForClearMs parameter for demo timing control
2435 9:20a ✅ Demo optimization functions wired into main flow; waitForClearChannel timeout made configurable
2436 " ✅ Fast demo mode flag and speech cache infrastructure added to main.ts
2437 " ✅ demoRole() function added to gate scripted demo activation based on fastDemo flag and built-in roles
2438 " ✅ spokenAudio() implements TTS caching for fast demo mode with promise deduplication
2439 " ✅ agentTurn() integrated with demo shortcut: skips voice requirement and AI model calls for scripted path
2440 9:21a ✅ handleData() skips STT transcription in demo mode by using pre-mapped peer spoken lines
2445 10:24a ✅ Enhanced persona briefs with detailed red-team attack scenario
2446 " ⚖️ Fast demo changes isolated to separate branch before main revert
S936 Investigate why fast-demo still appears live despite local revert; plan push to origin and production deployment (Sep 25 at 10:48 AM)
S937 Deploy fast-demo revert to production; understand resulting behavior on live link (Sep 25 at 10:49 AM)
S938 Re-apply faster encoded message optimization to main branch and verify it works (Sep 25 at 10:51 AM)
2450 10:56a ✅ Switch ultrasound protocol to FASTEST for faster encoded message transmission
2451 " 🔵 FASTEST ultrasound protocol change verified by complete test suite
S939 Re-apply faster encoded message optimization and verify live deployment (Sep 25 at 10:56 AM)
2452 10:58a 🔵 Vercel deployment status check reveals 404 error on live site
2453 " 🔵 Vercel deployment of FASTEST protocol change confirmed successful
2454 " ✅ Add .gstack/ to main branch .gitignore and deploy
S940 Update README documentation to reflect FASTEST protocol deployment and clarify built-in demo turn flow (Sep 25 at 10:58 AM)
2455 10:59a 🔵 README documentation references outdated Ultrasound Normal protocol
S941 Update README documentation to remove demo-specific references and verify frequency documentation accuracy (Sep 25 at 10:59 AM)
2456 11:01a 🔵 Frequency presets are decoupled from protocol selection; FASTEST change does not affect frequency spans
2457 " ✅ README refactored to remove demo-specific references and simplify documentation
S942 Add live site link to README documentation (Sep 25 at 11:01 AM)
2458 11:03a ✅ Add live site URL to README documentation
S943 Simplify README to be demo-ready, following gibberlink structure with prominent demo showcase (Sep 25 at 11:03 AM)
2459 11:20a ✅ Demo videos added to project
2460 " 🔵 SottoLink demo is security vulnerability demonstration
2461 11:21a ✅ Technical details extracted to separate documentation file
2462 " ✅ README restructured to demo-focused format
S944 Simplify README to demo-ready format with embedded videos and author credits; verify video playback and GitHub markdown rendering (Sep 25 at 11:22 AM)
2463 11:22a ✅ README enhanced with video embeds and author credits
2467 11:24a ✅ Working tree ready for commit with README and technical notes
2468 11:28a 🔵 Located institutional logos from Wikimedia Commons for README
2470 " 🟣 Persona Selection Moved to Landing Page
2471 " 🔄 Agent Mode Type Simplified by Removing Automatic Role Detection
2472 " ✅ Added CUSTOM_SUPPORT_BRIEF System Prompt Constant
2473 " ✅ Persona Selection Styling and Responsive Layout Added
2474 " 🔵 Build and Test Suite Pass After UI Refactor
2469 " 🔵 Wikimedia Commons thumbnail downloads require specific allowed sizes
S945 Redesign demo persona selection: move role choice from Settings to landing page with three selectable personas (Customer, Support bot, Custom support bot), each with description and default voice (Sep 25 at 11:29 AM)
2475 11:30a 🔵 SottoLink repository contains no image assets; README simplification underway
2476 " 🔵 Team headshot images added to assets directory
2477 " 🔵 Team headshots optimized to uniform 800x800 square format
2478 11:34a ✅ Assets organized in main worktree for README update
2479 " ✅ PoliMi logo flattened and processed for README consistency
2480 " 🔵 Logo content bounding boxes analyzed for README optimization
2481 11:35a 🔵 PoliMi logo has composite background (light gray + black)
2482 " ✅ Logo processing script created for README asset optimization
2483 11:36a ✅ All three logos flattened, cropped, and padded for README consistency
2485 11:37a 🔵 PoliMi logo analyzed: content boundaries and padding distribution confirmed
2486 " ✅ Headshot filename corrected: rodriguo → rodrigo

Access 524k tokens of past work via get_observations([IDs]) or mem-search skill.
</claude-mem-context>