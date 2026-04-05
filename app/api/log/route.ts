import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const logLine = `[${new Date().toISOString()}] ${JSON.stringify(body)}\n`;
    
    // Write to simulation.log in the root of the project
    const logFilePath = path.join(process.cwd(), 'simulation.log');
    await fs.appendFile(logFilePath, logLine);
    
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('Failed to write log', e);
    return NextResponse.json({ error: 'Failed to write log' }, { status: 500 });
  }
}
