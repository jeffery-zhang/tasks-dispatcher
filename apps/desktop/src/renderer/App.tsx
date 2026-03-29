import { DesktopStartupErrorState } from "./components/DesktopStartupErrorState.js";
import { TaskBoardPage } from "./pages/TaskBoardPage.js";
import { readDesktopStartupErrorFromLocation } from "./startup/desktopStartup.js";

export function App() {
  if (typeof window !== "undefined") {
    const locationError = readDesktopStartupErrorFromLocation(window.location.search);

    if (locationError) {
      return <DesktopStartupErrorState error={locationError} />;
    }

    if (typeof window.taskBoardApi === "undefined") {
      return (
        <DesktopStartupErrorState
          error={{
            code: "bridge_missing",
            message:
              "window.taskBoardApi is undefined. The desktop preload bridge did not initialize."
          }}
        />
      );
    }
  }

  return <TaskBoardPage />;
}
