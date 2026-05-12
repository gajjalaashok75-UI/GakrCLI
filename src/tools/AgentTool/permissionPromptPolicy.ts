export function shouldBubbleAsyncAgentPermissionPrompts({
  shouldRunAsync,
  isNonInteractiveSession,
  shouldAvoidPermissionPrompts,
}: {
  shouldRunAsync: boolean
  isNonInteractiveSession?: boolean
  shouldAvoidPermissionPrompts?: boolean
}): boolean {
  return (
    shouldRunAsync &&
    !isNonInteractiveSession &&
    !shouldAvoidPermissionPrompts
  )
}
