import { useState } from 'react';
import type { Library } from '../../domain/library/library';
import { ABBR_MAX, abbrFromName, abbrProblem, cleanAbbr } from '../../domain/design/abbr';
import { Button } from '../../ui/button';
import { SelectField, TextField } from '../../ui/fields';

interface Props {
  lib: Library;
  onCreate(name: string, templateId: string, abbr: string): void;
  onCancel(): void;
}

export function NewDesignForm({ lib, onCreate, onCancel }: Props) {
  const racks = lib.racks.items();
  const [name, setName] = useState('New rack design');
  // Follows the name until the user types an abbreviation.
  const [abbr, setAbbr] = useState<string>();
  const [templateId, setTemplateId] = useState(racks[0]?.id ?? '');
  const effective = abbr ?? abbrFromName(name);
  const problem = abbrProblem(effective);
  return (
    <div className="card">
      <div className="row2">
        <TextField label="Name" value={name} onChange={setName} />
        <TextField label={`Abbreviation (≤ ${ABBR_MAX})`} value={effective} onChange={(t) => setAbbr(cleanAbbr(t))} />
      </div>
      {problem && <p className="error">{problem}</p>}
      <SelectField label="Rack template" value={templateId}
        options={racks.map((r) => ({ value: r.id, label: r.name }))} onChange={setTemplateId} />
      <div className="row2">
        <Button variant="primary" disabled={!templateId || !!problem} onClick={() => onCreate(name, templateId, effective)}>Create</Button>
        <Button onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}
