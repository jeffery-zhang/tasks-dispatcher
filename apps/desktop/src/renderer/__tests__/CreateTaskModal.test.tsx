import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { CreateTaskModal } from "../components/CreateTaskModal.js";

describe("CreateTaskModal", () => {
  it("renders the create task modal fields when open", () => {
    const markup = renderToStaticMarkup(
      <CreateTaskModal open={true} onClose={vi.fn()} onSubmit={vi.fn()} />
    );

    expect(markup).toContain("Add Task");
    expect(markup).toContain("Title");
    expect(markup).toContain("Description");
    expect(markup).toContain("Create Draft");
  });
});
