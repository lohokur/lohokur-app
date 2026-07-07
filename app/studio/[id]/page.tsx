import StudioCanvas from '../StudioCanvas';

export default async function StudioPage(ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return <StudioCanvas projectId={id} />;
}
