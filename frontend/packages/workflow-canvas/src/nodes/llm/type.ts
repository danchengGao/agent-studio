import { JsonSchema } from '../../typings'

export enum ValueExpressionType {
  LITERAL = 'literal',
  REF = 'ref',
  OBJECT_REF = 'object_ref',
}

export type FormData = {
  title: string
  inputs: {
    inputParameters: JsonSchema
    llmParam: JsonSchema
    fcParamVar: JsonSchema
  }
  outputs: JsonSchema
  [key: string]: any
}

export interface IModelValue {
  modelName?: string
  modelType?: number
}
