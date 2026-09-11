// The base models you can dress — the same identities that orbit the lohokur.com
// homepage halo. Each is a full-body, front-facing figure; a design gets placed
// onto the chosen one in the Model node. Images live in /public/identities.
export type Identity = { id: string; image: string };

export const IDENTITIES: Identity[] = [
  'LK-016', 'LK-017', 'LK-018', 'LK-019', 'LK-020',
  'LK-021', 'LK-022', 'LK-023', 'LK-024', 'LK-025',
].map((id) => ({ id, image: `/identities/${id}.jpg` }));

export function identityImage(id?: string | null): string | undefined {
  if (!id) return undefined;
  return IDENTITIES.find((m) => m.id === id)?.image;
}
