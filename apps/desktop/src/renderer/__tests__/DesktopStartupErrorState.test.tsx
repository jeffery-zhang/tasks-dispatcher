import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { DesktopStartupErrorState } from "../components/DesktopStartupErrorState.js";

describe("DesktopStartupErrorState", () => {
  it("renders the startup failure code and developer-facing details", () => {
    const markup = renderToStaticMarkup(
      <DesktopStartupErrorState
        error={{
          code: "runtime_bootstrap_failed",
          message: "Timed out waiting for workspace runtime to start.",
          workspaceRoot: "D:/Code/test/testdir"
        }}
      />
    );

    expect(markup).toContain("Workspace runtime failed to start");
    expect(markup).toContain("runtime_bootstrap_failed");
    expect(markup).toContain("D:/Code/test/testdir");
  });
});
