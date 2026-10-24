# Breakpoint

**Evidence-first debugging, powered by Codex.**

Breakpoint is a developer tool designed to help investigate inconsistent test failures. It helps developers reproduce a failure, compare test runs, inspect evidence, explore potential causes, and verify whether a proposed fix actually works.

## The Problem

Tests sometimes pass in isolation but fail under different execution conditions. Developers can waste hours rerunning tests, inspecting logs, and guessing at root causes.

## Our Approach

Breakpoint turns debugging into a structured investigation:

1. **Reproduce** — Run a test under controlled conditions.
2. **Compare** — Inspect differences between passing and failing runs.
3. **Investigate** — Review logs, execution order, and evidence-backed hypotheses.
4. **Propose** — Generate a minimal, reviewable fix.
5. **Verify** — Rerun the test and report the actual result.

## Working local prototype

The product view is connected to a small, trusted Node test project at `sample-project/`. Click **Run real investigation** to execute the fixed five-step workflow: the target test in isolation, the preceding authentication test in isolation, the ordered pair, the reversed pair, and the ordered pair again. Each run persists its command, captured output, exit code, timing, test results and non-secret environment metadata to `.breakpoint/investigations.json`. The comparison engine only creates findings tied to stored run-evidence IDs; it explicitly records unavailable state as unknown.

The runner does **not** accept a browser-supplied command or working directory. It uses `spawn` without a shell, an allowlist of five Node test commands, a 10-second timeout, output cap, minimal environment, and Node heap cap. This is a trusted-local-demo boundary, not a sandbox: Node processes cannot be completely filesystem/network isolated without OS/container support. Do not point this prototype at untrusted repositories or secrets.

The deterministic investigation agent exposes a narrow tool vocabulary in `lib/agent.ts` and has an optional `AiProvider` interface. The deterministic workflow runs without an LLM. Optional AI review can only record an evidence-cited hypothesis; it cannot execute commands or verify a fix.

## Environment

`OPENAI_API_KEY` is optional for local execution but required for AI evidence review. `OPENAI_MODEL` optionally overrides the default `gpt-5.4`. The server-only adapter uses the official OpenAI JavaScript SDK and Responses API; without credentials the endpoint returns a visible `503` unavailable state.

`POST /api/investigations` supports `run-demo`, `run-workflow` (isolated, predecessor, ordered pair, reversed pair, repeat), `ai-review`, `propose-patch`, `approve-patch`, and `revert-patch`. It never accepts a shell command, project path, or patch body from the browser.

Proposed patches are approval-gated in `lib/patch-review.ts`. Applying is restricted to the trusted demo source and its recorded baseline, and reverting restores the original content. Verification records are based only on the result of a subsequent recorded run.

## Core Features

- Local debugging workspace
- Test execution and run comparison
- Evidence-based investigation reports
- Potential cause analysis with explicit uncertainty
- Reviewable code-fix suggestions
- Test reruns to verify proposed fixes

## Example Use Case

A session test passes when executed alone but fails after another test modifies shared state.

Breakpoint helps reproduce the sequence, inspect the run evidence, identify a potential state-leak issue, review a cleanup fix, and verify the result with another test run.

## Built With

- Next.js
- TypeScript
- Node.js test runner
- OpenAI Codex for development and optional AI-assisted workflows

*The technology stack and features above describe the intended implementation and may change during development.*

## Project Status

Built during the DevDay Exchange Community Metro Hackathon: Pune, a Codex-powered AI build sprint.

## Vision

**Don't guess the bug. Gather evidence, test the hypothesis, and verify the fix.**
