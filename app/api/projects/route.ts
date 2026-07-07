import { NextResponse } from 'next/server';
import { listProjects, createProject } from '@/lib/store';

export async function GET() {
  return NextResponse.json(await listProjects());
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const project = await createProject(body?.name);
  return NextResponse.json(project, { status: 201 });
}
