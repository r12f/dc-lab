import { fallbackGateway } from './fallbackGateway';
import type { FileGateway } from './fileGateway';
import { fsAccessGateway, supportsFsAccess } from './fsAccessGateway';

/** The file gateway for this browser. */
export const projectFiles: FileGateway = supportsFsAccess() ? fsAccessGateway : fallbackGateway;
