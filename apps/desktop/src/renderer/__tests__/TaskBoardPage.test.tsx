import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { TaskBoardPage } from "../pages/TaskBoardPage.js";

describe("TaskBoardPage", () => {
  it("renders the board shell with grouped columns and add task entry", () => {
    const markup = renderToStaticMarkup(<TaskBoardPage />);

    expect(markup).toContain("Agent Task Board");
    expect(markup).toContain("Add Task");
    expect(markup).toContain("Draft");
    expect(markup).toContain("Archived");
  });
});
