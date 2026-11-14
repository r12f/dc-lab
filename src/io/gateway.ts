import { fallbackGateway } from './fallback-gateway';
import type { FileGateway } from './file-gateway';
import { fsAccessGateway, supportsFsAccess } from './fs-access-gateway';

/** The file gateway for this browser. */
export const projectFiles: FileGateway = supportsFsAccess() ? fsAccessGateway : fallbackGateway;
