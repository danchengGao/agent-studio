import json

from openjiuwen.core.utils.tool.param import Param

data = {
	"type": "function",
	"function": {
		"name": "food_res",
		"description": "食物推荐",
		"parameters": {
			"type": "object",
			"properties": {
				"location": {
					"type": "object",
					"properties": {
						"city": {
							"type": "string",
							"description": "城市名称，如：北京市、上海市"
						},
						"district": {
							"type": "string",
							"description": "行政区或商圈，如：朝阳区、陆家嘴"
						},
						"address_keyword": {
							"type": "string",
							"description": "地址关键词，如： near 地铁站、商场名称"
						}
					},
					"required": [
						"city"
					],
					"additionalProperties": False
				},
				"cuisine": {
					"type": "array",
					"items": {
						"type": "string",
						"enum": [
							"中餐",
							"西餐",
							"火锅",
							"烧烤",
							"粤菜",
							"川菜",
							"湘菜"
						]
					},
					"description": "偏好菜系，可多选"
				},
				"budget_per_person": {
					"type": "integer",
					"minimum": 0,
					"maximum": 2000,
					"description": "人均预算（元）"
				},
				"occasion": {
					"type": "string",
					"enum": [
						"日常用餐",
						"朋友聚会",
						"商务宴请",
						"家庭聚餐",
						"生日庆祝",
						"公司团建"
					],
					"description": "用餐场合"
				},
				"min_rating": {
					"type": "number",
					"minimum": 3,
					"maximum": 5,
					"description": "最低评分要求"
				}
			},
			"required": [
				"location",
				"budget_per_person"
			],
			"additionalProperties": False
		}
	}
}

def is_nested_type(type):
    return type in ["object", "array"]


def parse_to_param(field_name: str, field_schema: dict, is_required: bool = False) -> Param:
    type = field_schema.get('type', 'string')
    if not is_nested_type(type):
        return Param(name=field_name,
                     description=field_schema.get('description', ''),
                     param_type=type,
                     default_value=field_schema.get('default', ''),
                     required=field_schema.get('required', is_required),
                     minimum=field_schema.get('minimum', 0),
                     maximum=field_schema.get('maximum', 2000),
                     enum=field_schema.get('enum', []))

    required = field_schema.get('required', [])
    schemas = []
    if type == "object":
        properties = field_schema.get('properties', {})
        for name, schema in properties.items():
            if field_name in required:
                schemas.append(parse_to_param(name, schema, True))
            else:
                schemas.append(parse_to_param(name, schema))
        return Param(name=field_name,
                     description=field_schema.get('description', ''),
                     param_type=type,
                     schema=schemas)
    else:
        items = field_schema.get('items', {})
        schemas.append(Param(name=field_name,
                     description=items.get('description', ''),
                     param_type=type,
                     default_value=items.get('default', ''),
                     required=items.get('required', is_required),
                     minimum=items.get('minimum', 0),
                     maximum=items.get('maximum', 2000),
                     enum=items.get('enum', [])))
        return Param(name=field_name,
                     description=field_schema.get('description', ''),
                     param_type=type,
                     schema=schemas)



parameters = data.get('function').get('parameters', {}).get('properties', {})
params = []
for field_name, field_schema in parameters.items():
    params.append(parse_to_param(field_name, field_schema))


print("========================")
for param in params:
    print()