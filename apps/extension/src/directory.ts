import { DIRECTORY_KEY, localStore } from "./local-store";

export type DirectoryPermission = "none" | PermissionState | "error";
export interface DirectorySelection {
  handle?: FileSystemDirectoryHandle;
  permission: DirectoryPermission;
}

export class DirectoryProbeError extends Error {
  constructor(message: string) { super(message); this.name = "DirectoryProbeError"; }
}

export function pickerSupported() {
  return typeof window !== "undefined" && window.isSecureContext && typeof window.showDirectoryPicker === "function";
}

/** Reopening checks only: permission prompts require a later explicit user gesture. */
export async function inspectDirectory(handle?: FileSystemDirectoryHandle): Promise<DirectorySelection> {
  if (!handle) return { permission: "none" };
  try { return { handle, permission: await handle.queryPermission({ mode: "readwrite" }) }; }
  catch { return { handle, permission: "error" }; }
}

export async function restoreDirectory() {
  const handle = await localStore().get<FileSystemDirectoryHandle>(DIRECTORY_KEY);
  return inspectDirectory(handle);
}

/** Called directly from the button handler, before any asynchronous storage operation. */
export async function chooseDirectory(): Promise<DirectorySelection> {
  if (!pickerSupported()) throw new DirectoryProbeError("Directory picking is unsupported in this browser/context.");
  let handle: FileSystemDirectoryHandle;
  try { handle = await window.showDirectoryPicker({ id: "candidate-phase0-root", mode: "readwrite" }); }
  catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw new DirectoryProbeError("Selection cancelled. The previous folder remains selected.");
    throw new DirectoryProbeError("Folder selection was denied or could not complete. No folder was replaced.");
  }
  try { await localStore().put(DIRECTORY_KEY, handle); }
  catch { throw new DirectoryProbeError("Folder was chosen but its handle could not be persisted. Select it again after fixing local storage."); }
  return inspectDirectory(handle);
}

/** Invoke directly on a click with the already-loaded handle; never auto-prompt on reopen. */
export async function renewDirectory(handle: FileSystemDirectoryHandle) {
  try {
    const permission = await handle.requestPermission({ mode: "readwrite" });
    return { handle, permission };
  } catch { throw new DirectoryProbeError("Permission renewal failed. Reselect the folder or check browser restrictions."); }
}

export async function requireDirectoryWritePermission(handle: FileSystemDirectoryHandle) {
  const status = await inspectDirectory(handle);
  if (status.permission !== "granted") {
    throw new DirectoryProbeError(status.permission === "error"
      ? "Folder permission could not be checked. No write was attempted."
      : "Folder write permission is required. Renew it explicitly before retrying.");
  }
}
