// In its own file to avoid circular dependencies
export const FILE_EDIT_TOOL_NAME = 'Edit'

// Permission pattern for granting session-level access to the project's .gakrcli/ folder
export const GAKR_FOLDER_PERMISSION_PATTERN = '/.gakrcli/**'

// Permission pattern for granting session-level access to the global ~/.gakrcli/ folder
export const GLOBAL_GAKR_FOLDER_PERMISSION_PATTERN = '~/.gakrcli/**'

// Legacy alias kept so existing session-level rules still work during migration.
export const LEGACY_GLOBAL_GAKR_FOLDER_PERMISSION_PATTERN = '~/.gakrcli/**'

export const FILE_UNEXPECTEDLY_MODIFIED_ERROR =
  'File has been unexpectedly modified. Read it again before attempting to write it.'
