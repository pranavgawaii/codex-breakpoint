import test from "node:test";
import assert from "node:assert/strict";
import { authenticate, currentUser } from "../src/session.js";

test("session starts without a user", () => { assert.equal(currentUser(), null); });
test("authentication establishes the demo user", () => { authenticate("demo-user-1"); assert.equal(currentUser(), "demo-user-1"); });
