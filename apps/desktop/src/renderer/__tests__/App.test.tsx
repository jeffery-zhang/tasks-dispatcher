import { afterEach, describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { App } from "../App.js";

const windowHolder = globalThis as { window?: any };

const originalWindow = windowHolder.window;

afterEach(() => {
  if (originalWindow) {
    windowHolder.window = originalWindow;
    return;
  }

  delete windowHolder.window;
});

describe("App startup guards", () => {
  it("renders the startup error page when main passes preload failure details", () => {
    windowHolder.window = {
      location: {
        search:
          "?startupErrorCode=preload_missing&startupErrorMessage=Missing%20desktop%20preload%20artifact&startupErrorPath=C%3A%5C%5Ctmp%5C%5CtaskBoardApi.mjs"
      }
    };

    const markup = renderToStaticMarkup(<App />);

    expect(markup).toContain("Desktop preload failed to load");
    expect(markup).toContain("preload_missing");
    expect(markup).toContain("taskBoardApi.mjs");
  });

  it("renders a bridge error instead of the task board when preload never exposed taskBoardApi", () => {
    windowHolder.window = {
      location: { search: "" }
    };

    const markup = renderToStaticMarkup(<App />);

    expect(markup).toContain("Desktop bridge is unavailable");
    expect(markup).toContain("bridge_missing");
  });
});
