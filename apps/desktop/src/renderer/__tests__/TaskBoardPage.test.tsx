import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { TaskBoardPage } from "../pages/TaskBoardPage.js";

describe("TaskBoardPage", () => {
  it("renders the board shell with workspace and task creation sections", () => {
    const markup = renderToStaticMarkup(<TaskBoardPage />);

    expect(markup).toContain("Agent Task Board");
    expect(markup).toContain("Workspace:");
    expect(markup).toContain("Create Task");
  });
});

