import { z } from 'zod/v4'
import * as controlSchemas from './controlSchemas.js'

export type SDKControlRequest = z.infer<typeof controlSchemas.SDKControlRequestSchema>
export type SDKControlResponse = z.infer<typeof controlSchemas.SDKControlResponseSchema>
export type SDKControlCancelRequest = z.infer<
  typeof controlSchemas.SDKControlCancelRequestSchema
>
export type StdoutMessage = z.infer<typeof controlSchemas.StdoutMessageSchema>
export type StdinMessage = z.infer<typeof controlSchemas.StdinMessageSchema>
export type SDKKeepAliveMessage = z.infer<
  typeof controlSchemas.SDKKeepAliveMessageSchema
>
export type SDKUpdateEnvironmentVariablesMessage = z.infer<
  typeof controlSchemas.SDKUpdateEnvironmentVariablesMessageSchema
>
