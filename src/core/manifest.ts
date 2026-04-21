export interface SurfaceManifest {
  surfaceId: string;
  title: string;
  contentType: string;
  entryPath: string;
  createdAt: string;
  updatedAt: string;
  sourceKind: 'html' | 'pdf' | 'artifact' | 'generated';
  renderMode: string;
}

export interface RuntimeState {
  activeSurfaceId: string | null;
  viewerOpen: boolean;
  updatedAt: string;
}

export function createManifest(input: {
  surfaceId: string;
  title: string;
  contentType: string;
  entryPath: string;
  sourceKind: SurfaceManifest['sourceKind'];
  renderMode: string;
}): SurfaceManifest {
  const now = new Date().toISOString();
  return {
    surfaceId: input.surfaceId,
    title: input.title,
    contentType: input.contentType,
    entryPath: input.entryPath,
    createdAt: now,
    updatedAt: now,
    sourceKind: input.sourceKind,
    renderMode: input.renderMode
  };
}
