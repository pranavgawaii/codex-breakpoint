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
