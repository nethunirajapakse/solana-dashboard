import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { createPersistedList } from "@/lib/persistedList";

const Item = z.object({ id: z.string(), label: z.string() });
type Item = z.infer<typeof Item>;
const KEY = "test:list";

function make(over: Partial<Parameters<typeof createPersistedList<Item>>[0]> = {}) {
  return createPersistedList<Item>({
    key: KEY,
    schema: Item,
    idOf: (i) => i.id,
    max: 3,
    onFull: "reject",
    ...over,
  });
}

beforeEach(() => localStorage.clear());

describe("createPersistedList", () => {
  it("adds newest first and persists to localStorage", () => {
    const list = make();
    list.add({ id: "a", label: "A" });
    list.add({ id: "b", label: "B" });
    expect(list.getSnapshot().map((i) => i.id)).toEqual(["b", "a"]);
    expect(JSON.parse(localStorage.getItem(KEY)!)).toHaveLength(2);
  });

  it("restores saved data in a new instance (page reload)", () => {
    make().add({ id: "a", label: "A" });
    expect(make().getSnapshot()).toEqual([{ id: "a", label: "A" }]);
  });

  it("returns a referentially stable snapshot until something changes", () => {
    const list = make();
    list.add({ id: "a", label: "A" });
    expect(list.getSnapshot()).toBe(list.getSnapshot());
  });

  it("rejects when full, or evicts the oldest, depending on config", () => {
    const strict = make();
    for (const id of ["a", "b", "c"]) strict.add({ id, label: id });
    expect(strict.add({ id: "d", label: "d" })).toEqual({ ok: false, reason: "limit" });
    expect(strict.getSnapshot()).toHaveLength(3);

    localStorage.clear();
    const rolling = make({ onFull: "evict-oldest" });
    for (const id of ["a", "b", "c", "d"]) rolling.add({ id, label: id });
    expect(rolling.getSnapshot().map((i) => i.id)).toEqual(["d", "c", "b"]);
  });

  it("replaces an existing id in place, or bumps it to the front", () => {
    const list = make();
    list.add({ id: "a", label: "A" });
    list.add({ id: "b", label: "B" });
    list.add({ id: "a", label: "A2" });
    expect(list.getSnapshot().map((i) => i.label)).toEqual(["B", "A2"]);

    localStorage.clear();
    const bump = make({ bumpExisting: true });
    bump.add({ id: "a", label: "A" });
    bump.add({ id: "b", label: "B" });
    bump.add({ id: "a", label: "A2" });
    expect(bump.getSnapshot().map((i) => i.label)).toEqual(["A2", "B"]);
  });

  it("updates, removes, checks membership and clears", () => {
    const list = make();
    list.add({ id: "a", label: "A" });
    list.update("a", { label: "Renamed" });
    expect(list.getSnapshot()[0].label).toBe("Renamed");
    expect(list.has("a")).toBe(true);
    list.remove("a");
    expect(list.has("a")).toBe(false);
    list.add({ id: "b", label: "B" });
    list.clear();
    expect(list.getSnapshot()).toEqual([]);
  });

  it("notifies subscribers and stops after unsubscribe", () => {
    const list = make();
    const listener = vi.fn();
    const unsubscribe = list.subscribe(listener);
    list.add({ id: "a", label: "A" });
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    list.add({ id: "b", label: "B" });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("syncs when another tab changes storage", () => {
    const list = make();
    const listener = vi.fn();
    list.subscribe(listener);
    list.getSnapshot();
    localStorage.setItem(KEY, JSON.stringify([{ id: "x", label: "From other tab" }]));
    window.dispatchEvent(new StorageEvent("storage", { key: KEY }));
    expect(listener).toHaveBeenCalled();
    expect(list.getSnapshot()).toEqual([{ id: "x", label: "From other tab" }]);
  });

  it("survives corrupt JSON, wrong types and invalid items", () => {
    localStorage.setItem(KEY, "{not json");
    expect(make().getSnapshot()).toEqual([]);

    localStorage.setItem(KEY, JSON.stringify({ not: "an array" }));
    expect(make().getSnapshot()).toEqual([]);

    localStorage.setItem(
      KEY,
      JSON.stringify([{ id: "ok", label: "fine" }, { id: 7 }, null, "str"])
    );
    expect(make().getSnapshot()).toEqual([{ id: "ok", label: "fine" }]);
  });

  it("keeps working in memory when localStorage throws", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("quota", "QuotaExceededError");
    });
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });
    const list = make();
    expect(() => list.add({ id: "a", label: "A" })).not.toThrow();
    expect(list.getSnapshot()).toEqual([{ id: "a", label: "A" }]);
  });

  it("serves a stable empty list for server rendering", () => {
    const list = make();
    expect(list.getServerSnapshot()).toEqual([]);
    expect(list.getServerSnapshot()).toBe(list.getServerSnapshot());
  });
});
