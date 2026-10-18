import assert from "node:assert/strict";
import test from "node:test";
import { IDBFactory } from "fake-indexeddb";
import { localStore } from "../src/local-store";
import { inspectDirectory, renewDirectory, requireDirectoryWritePermission } from "../src/directory";

test("IndexedDB survives a fresh store instance and rejects immutable-key replacement", async () => {
  const factory = new IDBFactory();
  const first = localStore(factory);
  await first.put("fixture", { name: "synthetic-folder", kind: "directory" });
  assert.deepEqual(await localStore(factory).get("fixture"), { name: "synthetic-folder", kind: "directory" });
  await first.add("immutable-operation", { id: "synthetic-id", bytes: new Uint8Array([1, 2, 3]) });
  await assert.rejects(first.add("immutable-operation", { id: "replacement" }), /transaction failed/);
  const stored = await localStore(factory).get<{ bytes: Uint8Array }>("immutable-operation");
  assert.deepEqual(stored?.bytes, new Uint8Array([1, 2, 3]));
  await Promise.all([
    first.merge("outcome", { local: "idle", sync: "idle" }, { local: "succeeded" }),
    localStore(factory).merge("outcome", { local: "idle", sync: "idle" }, { sync: "failed" }),
  ]);
  assert.deepEqual(await first.get("outcome"), { local: "succeeded", sync: "failed" });
});

test("reopen queries permission without prompting; explicit renewal and every write recheck it", async () => {
  let state: PermissionState = "prompt";
  let queries = 0;
  let prompts = 0;
  const handle = {
    name: "synthetic-folder", kind: "directory",
    async queryPermission() { queries++; return state; },
    async requestPermission() { prompts++; state = "granted"; return state; },
  } as unknown as FileSystemDirectoryHandle;
  assert.equal((await inspectDirectory(handle)).permission, "prompt");
  assert.equal(prompts, 0);
  await assert.rejects(requireDirectoryWritePermission(handle), /permission is required/);
  assert.equal((await renewDirectory(handle)).permission, "granted");
  assert.equal(prompts, 1);
  await requireDirectoryWritePermission(handle);
  state = "denied";
  await assert.rejects(requireDirectoryWritePermission(handle), /permission is required/);
  assert.equal(queries, 4);
});

test("permission errors remain check failures rather than no-folder or access-granted results", async () => {
  const handle = { async queryPermission() { throw new Error("Synthetic failure"); } } as unknown as FileSystemDirectoryHandle;
  assert.equal((await inspectDirectory(handle)).permission, "error");
  await assert.rejects(requireDirectoryWritePermission(handle), /could not be checked/);
  assert.equal((await inspectDirectory()).permission, "none");
});
