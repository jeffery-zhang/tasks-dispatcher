import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { TaskSessionList } from "../components/TaskSessionList.js";

describe("TaskSessionList", () => {
  it("renders termination hints for failed attempts", () => {
    const markup = renderToStaticMarkup(
      <TaskSessionList
        attempts={[
          {
            id: "attempt-1",
            status: "failed",
            stage: "self_check",
            terminationReason: "protocol_failure"
          },
          {
            id: "attempt-2",
            status: "completed",
            stage: "self_check",
            terminationReason: null
          }
        ]}
        onOpenSessionDetails={vi.fn()}
      />
    );

    expect(markup).toContain("Protocol Failure");
    expect(markup).toContain("attempt-1");
    expect(markup).toContain("attempt-2");
  });
});
