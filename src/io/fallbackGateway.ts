import { downloadText, pickTextFile } from './download';
import type { FileGateway } from './fileGateway';

/** Browsers without File System Access: upload dialog to open, download to save. */
export const fallbackGateway: FileGateway = {
  canWriteBack: false,
  async open() {
    const file = await pickTextFile();
    return file && { ref: { name: file.name }, text: file.text };
  },
  async save(ref, text) {
    downloadText(ref.name, text);
  },
  async saveAs(suggestedName, text) {
    const name = prompt('Save as', suggestedName)?.trim();
    if (!name) return undefined;
    const fileName = name.endsWith('.json') ? name : `${name}.dclab.json`;
    downloadText(fileName, text);
    return { name: fileName };
  },
};
