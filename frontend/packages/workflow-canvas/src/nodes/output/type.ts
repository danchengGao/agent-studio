import { JsonSchema } from '../../typings'

export type FormData = {
  title: string
  inputs: {
    inputParameters: JsonSchema
    content?: JsonSchema
  }
  [key: string]: any
}
