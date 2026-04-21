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
