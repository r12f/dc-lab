import { useState } from 'react';
import type { Library } from '../../domain/library/library';
import { Button } from '../../ui/button';
import { SelectField, TextField } from '../../ui/fields';

interface Props {
  lib: Library;
  onCreate(name: string, templateId: string): void;
  onCancel(): void;
}

export function NewDesignForm({ lib, onCreate, onCancel }: Props) {
  const racks = lib.racks.items();
  const [name, setName] = useState('New rack design');
  const [templateId, setTemplateId] = useState(racks[0]?.id ?? '');
  return (
    <div className="card">
      <TextField label="Name" value={name} onChange={setName} />
      <SelectField label="Rack template" value={templateId}
        options={racks.map((r) => ({ value: r.id, label: r.name }))} onChange={setTemplateId} />
      <div className="row2">
        <Button variant="primary" disabled={!templateId} onClick={() => onCreate(name, templateId)}>Create</Button>
        <Button onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}
