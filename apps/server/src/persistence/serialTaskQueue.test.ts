import { describe, expect, it, vi } from "vitest";
import { SerialTaskQueue } from "./serialTaskQueue";

describe("SerialTaskQueue", () => {
  it("runs tasks in enqueue order", async () => {
    const queue = new SerialTaskQueue();
    const calls: number[] = [];
    const onError = vi.fn();

    queue.enqueue(async () => {
      calls.push(1);
    }, onError);
    queue.enqueue(async () => {
      calls.push(2);
    }, onError);

    await queue.flush();

    expect(calls).toEqual([1, 2]);
    expect(onError).not.toHaveBeenCalled();
  });

  it("reports errors and continues with later tasks", async () => {
    const queue = new SerialTaskQueue();
    const calls: string[] = [];
    const onError = vi.fn();

    queue.enqueue(async () => {
      calls.push("first");
      throw new Error("failed");
    }, onError);
    queue.enqueue(async () => {
      calls.push("second");
    }, onError);

    await queue.flush();

    expect(calls).toEqual(["first", "second"]);
    expect(onError).toHaveBeenCalledTimes(1);
  });
});
