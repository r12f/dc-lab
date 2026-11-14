/** Item kinds a custom property can apply to. */
export type PropertyTarget = 'device' | 'rack';

export type PropertyType = 'text' | 'number' | 'boolean' | 'select';

export type PropertyValue = string | number | boolean;

/** A project-wide custom property; applies to every item of its targets as soon as it exists. */
export interface PropertyDef {
  id: string;
  name: string;
  appliesTo: PropertyTarget[];
  type: PropertyType;
  options?: string[];
  unit?: string;
  defaultValue?: PropertyValue;
  showInBom: boolean;
}

/** Items that carry custom property values. */
export interface HasProperties {
  properties?: Record<string, PropertyValue>;
}
