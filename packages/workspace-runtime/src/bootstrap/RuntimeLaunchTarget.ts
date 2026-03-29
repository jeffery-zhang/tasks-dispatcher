export type RuntimeLaunchMode = "tsx-source" | "node-bundled";

export interface RuntimeLaunchTarget {
  entryPath: string;
  executablePath?: string;
  mode: RuntimeLaunchMode;
}
