/**
 * No-op bundled workflow initializer.
 *
 * The closed-source build pre-bundles the workflow engine into this directory
 * and calls initBundledWorkflows() before loading the WorkflowTool. The open-source
 * build keeps the real implementation in src/services/workflow/ and src/tools/WorkflowTool/,
 * so this is a no-op.
 */
export function initBundledWorkflows(): void {
  // Real workflow implementation in src/services/workflow/ + src/tools/WorkflowTool/
}
