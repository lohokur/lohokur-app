import { NextResponse } from 'next/server';
import { getProject, saveProject, deleteProject } from '@/lib/store';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const project = await getProject(id);
  return project
    ? NextResponse.json(project)
    : NextResponse.json({ error: 'not found' }, { status: 404 });
}

export async function PUT(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const patch = await req.json().catch(() => ({}));
  const project = await saveProject(id, patch);
  return project
    ? NextResponse.json(project)
    : NextResponse.json({ error: 'not found' }, { status: 404 });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  await deleteProject(id);
  return NextResponse.json({ ok: true });
}
